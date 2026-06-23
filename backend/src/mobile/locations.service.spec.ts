import type { Trip } from '@prisma/client';
import { LocationsService } from './locations.service';
import { IngestBatchDto } from './dto/ingest-batch.dto';

describe('LocationsService.addBatch', () => {
  let prisma: {
    location: { createMany: jest.Mock; findMany: jest.Mock };
    trip: { updateMany: jest.Mock; findUnique: jest.Mock };
  };
  let service: LocationsService;

  beforeEach(() => {
    prisma = {
      location: {
        createMany: jest.fn().mockResolvedValue({ count: 0 }),
        findMany: jest.fn().mockResolvedValue([]), // por defecto: sin candidatos → no cierra
      },
      trip: {
        updateMany: jest.fn().mockResolvedValue({ count: 1 }),
        findUnique: jest.fn().mockResolvedValue({ status: 'CONCLUIDO' }),
      },
    };
    service = new LocationsService(prisma as never);
  });

  // Viaje EN_RUTA con geocerca en (25.6,-100.3) r=300 m (lejos de los puntos de prueba).
  const trip = (over: Partial<Trip> = {}): Trip =>
    ({
      id: 'trip-1',
      status: 'EN_RUTA',
      destinationLat: 25.6,
      destinationLng: -100.3,
      destinationRadiusMeters: 300,
      ...over,
    }) as Trip;

  const batch = (points: IngestBatchDto['points']): IngestBatchDto => ({
    batchId: '11111111-1111-4111-8111-111111111111',
    points,
  });

  it('persiste puntos válidos con skipDuplicates y batchId del lote', async () => {
    prisma.location.createMany.mockResolvedValue({ count: 2 });
    const dto = batch([
      {
        lat: 25.67,
        lng: -100.3,
        accuracyMeters: 12,
        recordedAt: '2026-06-22T15:00:00.000Z',
      },
      {
        lat: 25.68,
        lng: -100.31,
        accuracyMeters: 20,
        recordedAt: '2026-06-22T15:05:00.000Z',
      },
    ]);

    const res = await service.addBatch(trip(), dto);

    expect(res.accepted).toBe(2);
    expect(res.duplicateBatch).toBe(false);
    expect(res.trip).toEqual({ status: 'EN_RUTA', stopTracking: false });
    const calls = prisma.location.createMany.mock.calls as Array<
      [
        {
          data: Array<{ tripId: string; batchId: string; recordedAt: Date }>;
          skipDuplicates: boolean;
        },
      ]
    >;
    const call = calls[0][0];
    expect(call.skipDuplicates).toBe(true);
    expect(call.data).toHaveLength(2);
    expect(call.data[0].tripId).toBe('trip-1');
    expect(call.data[0].batchId).toBe(dto.batchId);
    expect(call.data[0].recordedAt).toBeInstanceOf(Date);
  });

  it('descarta puntos fuera de México o con timestamp futuro (no se insertan)', async () => {
    const future = new Date(Date.now() + 5 * 60_000).toISOString();
    const dto = batch([
      {
        lat: 25.67,
        lng: -100.3,
        accuracyMeters: 12,
        recordedAt: '2026-06-22T15:00:00.000Z',
      }, // ok
      {
        lat: 48.85,
        lng: 2.35,
        accuracyMeters: 10,
        recordedAt: '2026-06-22T15:00:00.000Z',
      }, // París
      { lat: 25.67, lng: -100.3, accuracyMeters: 12, recordedAt: future }, // futuro
    ]);
    prisma.location.createMany.mockResolvedValue({ count: 1 });

    const res = await service.addBatch(trip(), dto);

    expect(res.accepted).toBe(1);
    expect(res.duplicateBatch).toBe(false);
    const calls = prisma.location.createMany.mock.calls as Array<
      [{ data: unknown[] }]
    >;
    expect(calls[0][0].data).toHaveLength(1); // sólo el válido llega a la BD
  });

  it('lote repetido (válidos pero todos duplicados) → accepted 0, duplicateBatch true', async () => {
    prisma.location.createMany.mockResolvedValue({ count: 0 }); // índice único descartó todo
    const dto = batch([
      {
        lat: 25.67,
        lng: -100.3,
        accuracyMeters: 12,
        recordedAt: '2026-06-22T15:00:00.000Z',
      },
    ]);

    const res = await service.addBatch(trip(), dto);

    expect(res.accepted).toBe(0);
    expect(res.duplicateBatch).toBe(true);
  });

  it('sin puntos válidos → no inserta ni toca lastLocationAt', async () => {
    const dto = batch([
      {
        lat: 0,
        lng: 0,
        accuracyMeters: 5,
        recordedAt: '2026-06-22T15:00:00.000Z',
      }, // 0,0 fuera MX
    ]);

    const res = await service.addBatch(trip(), dto);

    expect(res.accepted).toBe(0);
    expect(prisma.location.createMany).not.toHaveBeenCalled();
    expect(prisma.trip.updateMany).not.toHaveBeenCalled();
  });

  it('punto dentro de la geocerca → cierra el viaje (AUTO_GEOFENCE) y stopTracking true', async () => {
    prisma.location.createMany.mockResolvedValue({ count: 1 });
    // El candidato más reciente cae justo en el centro del destino (distancia 0 ≤ 300 m).
    prisma.location.findMany.mockResolvedValue([{ lat: 25.6, lng: -100.3 }]);
    const dto = batch([
      {
        lat: 25.6,
        lng: -100.3,
        accuracyMeters: 8,
        recordedAt: '2026-06-22T15:10:00.000Z',
      },
    ]);

    const res = await service.addBatch(trip(), dto);

    expect(res.trip).toEqual({ status: 'CONCLUIDO', stopTracking: true });
    const upd = prisma.trip.updateMany.mock.calls.find(
      (c: unknown[]) =>
        (c[0] as { data?: { status?: string } }).data?.status === 'CONCLUIDO',
    ) as
      | [{ where: { status: string }; data: { closureType: string } }]
      | undefined;
    expect(upd).toBeDefined();
    expect(upd![0].where.status).toBe('EN_RUTA'); // cierre atómico
    expect(upd![0].data.closureType).toBe('AUTO_GEOFENCE');
  });

  it('punto fuera del radio → no cierra (sigue EN_RUTA)', async () => {
    prisma.location.createMany.mockResolvedValue({ count: 1 });
    prisma.location.findMany.mockResolvedValue([{ lat: 25.67, lng: -100.3 }]); // ~7.7 km
    const dto = batch([
      {
        lat: 25.67,
        lng: -100.3,
        accuracyMeters: 8,
        recordedAt: '2026-06-22T15:10:00.000Z',
      },
    ]);

    const res = await service.addBatch(trip(), dto);

    expect(res.trip.status).toBe('EN_RUTA');
    expect(res.trip.stopTracking).toBe(false);
  });

  it('viaje ya CONCLUIDO → descarta puntos, stopTracking true, no inserta', async () => {
    const dto = batch([
      {
        lat: 25.6,
        lng: -100.3,
        accuracyMeters: 8,
        recordedAt: '2026-06-22T15:10:00.000Z',
      },
    ]);

    const res = await service.addBatch(trip({ status: 'CONCLUIDO' }), dto);

    expect(res).toEqual({
      accepted: 0,
      duplicateBatch: false,
      trip: { status: 'CONCLUIDO', stopTracking: true },
    });
    expect(prisma.location.createMany).not.toHaveBeenCalled();
  });
});
