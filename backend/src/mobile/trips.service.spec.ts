import { BadRequestException, ConflictException } from '@nestjs/common';
import { Prisma, type Trip } from '@prisma/client';
import { TripsService } from './trips.service';
import { CreateTripDto } from './dto/create-trip.dto';

// Evita tocar el disco al limpiar huérfanos (discardOrphan).
jest.mock('node:fs/promises', () => ({
  unlink: jest.fn().mockResolvedValue(undefined),
}));
import { unlink } from 'node:fs/promises';

const PHOTO = '/uploads/foto.jpg';

function makeDto(overrides: Partial<CreateTripDto> = {}): CreateTripDto {
  return {
    providerNumber: 'PRV-001',
    providerName: 'Transporte del Norte SA',
    folio: '100294',
    frontPlate: 'ABC-12-34',
    rearPlate: undefined,
    destinationId: 'dest-1',
    deviceId: 'device-1',
    clientRequestId: 'crid-1',
    ...overrides,
  };
}

function makeTrip(dto: CreateTripDto, overrides: Partial<Trip> = {}): Trip {
  return {
    id: 'trip-1',
    status: 'EN_RUTA',
    startedAt: new Date('2026-06-22T10:00:00Z'),
    endedAt: null,
    providerNumber: dto.providerNumber,
    providerName: dto.providerName,
    folio: dto.folio,
    frontPlate: dto.frontPlate,
    rearPlate: dto.rearPlate ?? null,
    destinationId: dto.destinationId,
    destinationLat: 25.6866,
    destinationLng: -100.3161,
    destinationRadiusMeters: 300,
    photoPath: PHOTO,
    deviceId: dto.deviceId,
    clientRequestId: dto.clientRequestId,
    tripTokenHash: 'hash',
    closureType: null,
    observations: null,
    closedById: null,
    closeRequestId: null,
    lastLocationAt: null,
    createdAt: new Date('2026-06-22T10:00:00Z'),
    updatedAt: new Date('2026-06-22T10:00:00Z'),
    ...overrides,
  };
}

describe('TripsService', () => {
  let prisma: {
    trip: { findUnique: jest.Mock; create: jest.Mock };
    destination: { findFirst: jest.Mock };
  };
  let service: TripsService;

  beforeEach(() => {
    jest.clearAllMocks();
    prisma = {
      trip: { findUnique: jest.fn(), create: jest.fn() },
      destination: { findFirst: jest.fn() },
    };
    const config = { get: jest.fn().mockReturnValue('test-secret') };
    service = new TripsService(prisma as never, config as never);
  });

  it('crea un viaje nuevo: snapshot de geocerca + tripToken determinista', async () => {
    const dto = makeDto();
    const activeDest = {
      id: 'dest-1',
      centerLat: 25.6866,
      centerLng: -100.3161,
      radiusMeters: 300,
    };
    prisma.trip.findUnique.mockResolvedValue(null);
    prisma.destination.findFirst.mockResolvedValue(activeDest);
    prisma.trip.create.mockResolvedValue(makeTrip(dto));

    const res = await service.create(dto, PHOTO);

    expect(res.status).toBe('EN_RUTA');
    expect(res.tripToken).toMatch(/^trk_live_[a-f0-9]{64}$/);
    expect(res.geofence).toEqual({
      centerLat: 25.6866,
      centerLng: -100.3161,
      radiusMeters: 300,
    });
    // RN-16: el viaje copia centro+radio del destino (snapshot inmutable).
    const calls = prisma.trip.create.mock.calls as Array<
      [{ data: { destinationLat: number; destinationRadiusMeters: number } }]
    >;
    const createArg = calls[0][0].data;
    expect(createArg.destinationLat).toBe(activeDest.centerLat);
    expect(createArg.destinationRadiusMeters).toBe(activeDest.radiusMeters);
    expect(unlink).not.toHaveBeenCalled();
  });

  it('idempotencia RN-15: misma solicitud → mismo viaje, sin crear, descarta la foto nueva', async () => {
    const dto = makeDto();
    prisma.trip.findUnique.mockResolvedValue(makeTrip(dto));

    const res = await service.create(dto, PHOTO);

    expect(res.tripId).toBe('trip-1');
    expect(prisma.trip.create).not.toHaveBeenCalled();
    expect(unlink).toHaveBeenCalledTimes(1); // huérfano descartado
  });

  it('mismo clientRequestId con payload distinto → 409', async () => {
    const dto = makeDto();
    const existing = makeTrip(makeDto({ providerName: 'OTRA EMPRESA' }));
    prisma.trip.findUnique.mockResolvedValue(existing);

    await expect(service.create(dto, PHOTO)).rejects.toBeInstanceOf(
      ConflictException,
    );
    expect(prisma.trip.create).not.toHaveBeenCalled();
  });

  it('destino inexistente o inactivo → 400 y descarta la foto', async () => {
    const dto = makeDto();
    prisma.trip.findUnique.mockResolvedValue(null);
    prisma.destination.findFirst.mockResolvedValue(null);

    await expect(service.create(dto, PHOTO)).rejects.toBeInstanceOf(
      BadRequestException,
    );
    expect(unlink).toHaveBeenCalledTimes(1);
  });

  it('RN-11: carrera P2002 sin idempotencia → 409 viaje activo', async () => {
    const dto = makeDto();
    prisma.trip.findUnique
      .mockResolvedValueOnce(null)
      .mockResolvedValueOnce(null);
    prisma.destination.findFirst.mockResolvedValue({
      id: 'dest-1',
      centerLat: 1,
      centerLng: 2,
      radiusMeters: 100,
    });
    prisma.trip.create.mockRejectedValue(
      new Prisma.PrismaClientKnownRequestError('dup', {
        code: 'P2002',
        clientVersion: 'test',
      }),
    );

    await expect(service.create(dto, PHOTO)).rejects.toBeInstanceOf(
      ConflictException,
    );
    expect(unlink).toHaveBeenCalledTimes(1);
  });

  it('P2002 que sí era duplicado idempotente → devuelve el viaje existente', async () => {
    const dto = makeDto();
    const existing = makeTrip(dto);
    prisma.trip.findUnique
      .mockResolvedValueOnce(null)
      .mockResolvedValueOnce(existing);
    prisma.destination.findFirst.mockResolvedValue({
      id: 'dest-1',
      centerLat: 1,
      centerLng: 2,
      radiusMeters: 100,
    });
    prisma.trip.create.mockRejectedValue(
      new Prisma.PrismaClientKnownRequestError('dup', {
        code: 'P2002',
        clientVersion: 'test',
      }),
    );

    const res = await service.create(dto, PHOTO);
    expect(res.tripId).toBe('trip-1');
  });
});
