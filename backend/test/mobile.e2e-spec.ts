import { INestApplication } from '@nestjs/common';
import { Test } from '@nestjs/testing';
import request from 'supertest';
import { App } from 'supertest/types';
import { PrismaClient } from '@prisma/client';
import { randomUUID } from 'node:crypto';
import { AppModule } from '../src/app.module';
import { setupApp } from '../src/main';

/**
 * E2E del flujo móvil real contra la app endurecida (8.1) + Postgres.
 * Cubre: AppKeyGuard, POST /trips (multipart, idempotencia RN-15, RN-11),
 * WebTripsService (GET /api/web/trips) y la ingesta por tripToken (1.5 / TripTokenGuard).
 */

interface ErrorBody {
  error: string;
  message: string;
  details?: unknown;
}
interface TripResp {
  tripId: string;
  tripToken: string;
  status: string;
  geofence: { radiusMeters: number };
}
interface IngestResp {
  accepted: number;
  duplicateBatch: boolean;
  trip: { status: string; stopTracking: boolean };
}
interface WebTrip {
  id: string;
  destination: { name: string } | null;
  lastLocation: { lat: number; lng: number } | null;
}

describe('Flujo móvil (e2e)', () => {
  let app: INestApplication<App>;
  let prisma: PrismaClient;
  let appKey: string;
  let destId: string;
  let tripId: string;
  let tripToken: string;

  const deviceId = `e2e-${Date.now()}`;
  const crid = `crid-${Date.now()}`;
  const batchId = randomUUID();
  // Bytes arbitrarios; el ParseFilePipe valida por mimetype declarado (skipMagicNumbers).
  const photo = Buffer.from([0xff, 0xd8, 0xff, 0xe0, 0x00, 0x10]);

  function postTrip(over: Record<string, string> = {}) {
    return request(app.getHttpServer())
      .post('/api/mobile/trips')
      .set('x-app-key', appKey)
      .field('providerNumber', over.providerNumber ?? 'PRV-001')
      .field('providerName', over.providerName ?? 'Transporte e2e')
      .field('folio', over.folio ?? 'F-E2E')
      .field('frontPlate', over.frontPlate ?? 'ABC-12-34')
      .field('destinationId', over.destinationId ?? destId)
      .field('deviceId', over.deviceId ?? deviceId)
      .field('clientRequestId', over.clientRequestId ?? crid)
      .attach('photo', photo, {
        filename: 'carga.jpg',
        contentType: 'image/jpeg',
      });
  }

  // recordedAt fijo (1 min atrás) → reenviar el lote por defecto es byte-idéntico, así el
  // índice único tripId+batchId+recordedAt puede demostrar idempotencia.
  const recordedAt = new Date(Date.now() - 60_000).toISOString();
  function point() {
    return { lat: 25.67, lng: -100.3, accuracyMeters: 12, recordedAt };
  }

  // Lote de ingesta (3.4): un batchId + array de puntos. `batchId` fijo por defecto para
  // poder probar idempotencia (reenviar el mismo lote no duplica).
  function batch(
    over: { batchId?: string; points?: ReturnType<typeof point>[] } = {},
  ) {
    return {
      batchId: over.batchId ?? batchId,
      points: over.points ?? [point()],
    };
  }

  beforeAll(async () => {
    const mod = await Test.createTestingModule({
      imports: [AppModule],
    }).compile();
    app = mod.createNestApplication({ bodyParser: false });
    setupApp(app);
    await app.init();

    appKey = process.env.APP_KEY ?? 'dev-app-key-cambia-en-prod';
    prisma = new PrismaClient();
    const dest = await prisma.destination.create({
      data: {
        name: 'E2E Destino',
        centerLat: 25.6,
        centerLng: -100.3,
        radiusMeters: 300,
      },
    });
    destId = dest.id;
  });

  afterAll(async () => {
    await prisma.trip.deleteMany({ where: { deviceId } }); // cascada borra locations
    await prisma.destination
      .delete({ where: { id: destId } })
      .catch(() => undefined);
    await prisma.$disconnect();
    await app.close();
  });

  it('GET /destinations sin X-App-Key → 401 con formato de error único', async () => {
    const res = await request(app.getHttpServer()).get(
      '/api/mobile/destinations',
    );
    const body = res.body as ErrorBody;
    expect(res.status).toBe(401);
    expect(body.error).toBe('Unauthorized');
    expect(typeof body.message).toBe('string');
  });

  it('GET /destinations con X-App-Key → 200 incluye el destino sembrado', async () => {
    const res = await request(app.getHttpServer())
      .get('/api/mobile/destinations')
      .set('x-app-key', appKey);
    const body = res.body as Array<{ id: string }>;
    expect(res.status).toBe(200);
    expect(Array.isArray(body)).toBe(true);
    expect(body.some((d) => d.id === destId)).toBe(true);
  });

  it('POST /trips sin X-App-Key → 401', async () => {
    const res = await request(app.getHttpServer())
      .post('/api/mobile/trips')
      .field('providerNumber', 'x');
    expect(res.status).toBe(401);
  });

  it('POST /trips con campos faltantes → 400 con details', async () => {
    const res = await postTrip({ providerNumber: '' });
    const body = res.body as ErrorBody;
    expect(res.status).toBe(400);
    expect(body.error).toBe('BadRequest');
    expect(body.details).toBeDefined();
  });

  it('POST /trips válido → 201 con tripToken y geocerca (snapshot)', async () => {
    const res = await postTrip();
    const body = res.body as TripResp;
    expect(res.status).toBe(201);
    expect(body.status).toBe('EN_RUTA');
    expect(body.tripToken).toMatch(/^trk_live_[a-f0-9]{64}$/);
    expect(body.geofence.radiusMeters).toBe(300);
    tripId = body.tripId;
    tripToken = body.tripToken;
  });

  it('idempotencia RN-15: misma solicitud → mismo tripId, no duplica', async () => {
    const res = await postTrip();
    const body = res.body as TripResp;
    expect(res.status).toBe(201);
    expect(body.tripId).toBe(tripId);
    const count = await prisma.trip.count({ where: { clientRequestId: crid } });
    expect(count).toBe(1);
  });

  it('mismo clientRequestId con payload distinto → 409', async () => {
    const res = await postTrip({ providerName: 'OTRA EMPRESA' });
    expect(res.status).toBe(409);
  });

  it('RN-11: otro clientRequestId, mismo deviceId con viaje activo → 409', async () => {
    const res = await postTrip({ clientRequestId: `crid-otro-${Date.now()}` });
    expect(res.status).toBe(409);
  });

  it('GET /api/web/trips → 200, el viaje aparece con destino y sin ubicación aún', async () => {
    const res = await request(app.getHttpServer()).get('/api/web/trips');
    const body = res.body as WebTrip[];
    expect(res.status).toBe(200);
    const trip = body.find((t) => t.id === tripId);
    expect(trip).toBeDefined();
    expect(trip?.destination?.name).toBe('E2E Destino');
    expect(trip?.lastLocation).toBeNull();
  });

  it('POST /trips/:id/locations sin Bearer → 401', async () => {
    const res = await request(app.getHttpServer())
      .post(`/api/mobile/trips/${tripId}/locations`)
      .send(batch());
    expect(res.status).toBe(401);
  });

  it('POST /trips/:id/locations con tripToken válido → 200, almacena el lote', async () => {
    const res = await request(app.getHttpServer())
      .post(`/api/mobile/trips/${tripId}/locations`)
      .set('Authorization', `Bearer ${tripToken}`)
      .send(batch());
    const body = res.body as IngestResp;
    expect(res.status).toBe(200);
    expect(body.accepted).toBe(1);
    expect(body.duplicateBatch).toBe(false);
    expect(body.trip.status).toBe('EN_RUTA');
    expect(body.trip.stopTracking).toBe(false);
  });

  it('reenviar el mismo batchId es idempotente → accepted 0, duplicateBatch true', async () => {
    const res = await request(app.getHttpServer())
      .post(`/api/mobile/trips/${tripId}/locations`)
      .set('Authorization', `Bearer ${tripToken}`)
      .send(batch()); // mismo batchId + mismo punto que el test anterior
    const body = res.body as IngestResp;
    expect(res.status).toBe(200);
    expect(body.accepted).toBe(0);
    expect(body.duplicateBatch).toBe(true);
  });

  it('descarta puntos fuera de México (no se persisten), no rompe el lote', async () => {
    const res = await request(app.getHttpServer())
      .post(`/api/mobile/trips/${tripId}/locations`)
      .set('Authorization', `Bearer ${tripToken}`)
      .send(
        batch({
          batchId: randomUUID(),
          points: [
            {
              lat: 48.85,
              lng: 2.35,
              accuracyMeters: 10,
              recordedAt: new Date().toISOString(),
            },
          ],
        }),
      );
    const body = res.body as IngestResp;
    expect(res.status).toBe(200);
    expect(body.accepted).toBe(0);
    expect(body.duplicateBatch).toBe(false); // inválido ≠ duplicado
  });

  it('tripToken de un viaje no corresponde a otro :id → 403', async () => {
    const res = await request(app.getHttpServer())
      .post(`/api/mobile/trips/${randomUUID()}/locations`)
      .set('Authorization', `Bearer ${tripToken}`)
      .send(batch());
    expect(res.status).toBe(403);
  });

  it('GET /api/web/trips → el viaje ya trae lastLocation tras la ingesta', async () => {
    const res = await request(app.getHttpServer()).get('/api/web/trips');
    const body = res.body as WebTrip[];
    const trip = body.find((t) => t.id === tripId);
    expect(trip?.lastLocation).not.toBeNull();
    expect(trip?.lastLocation?.lat).toBeCloseTo(25.67, 2);
  });

  // --- Cierre automático por geocerca (4.1). El destino e2e está en (25.6, -100.3) r=300 m. ---
  it('punto dentro de la geocerca → cierra el viaje y responde stopTracking true', async () => {
    const res = await request(app.getHttpServer())
      .post(`/api/mobile/trips/${tripId}/locations`)
      .set('Authorization', `Bearer ${tripToken}`)
      .send(
        batch({
          batchId: randomUUID(),
          points: [
            {
              lat: 25.6,
              lng: -100.3,
              accuracyMeters: 8,
              recordedAt: new Date().toISOString(),
            },
          ],
        }),
      );
    const body = res.body as IngestResp;
    expect(res.status).toBe(200);
    expect(body.trip.status).toBe('CONCLUIDO');
    expect(body.trip.stopTracking).toBe(true);
    const closed = await prisma.trip.findUnique({ where: { id: tripId } });
    expect(closed?.status).toBe('CONCLUIDO');
    expect(closed?.closureType).toBe('AUTO_GEOFENCE');
  });

  it('ingesta a un viaje ya CONCLUIDO → 200, descarta puntos, stopTracking true', async () => {
    const res = await request(app.getHttpServer())
      .post(`/api/mobile/trips/${tripId}/locations`)
      .set('Authorization', `Bearer ${tripToken}`)
      .send(batch({ batchId: randomUUID() }));
    const body = res.body as IngestResp;
    expect(res.status).toBe(200);
    expect(body.accepted).toBe(0);
    expect(body.trip.status).toBe('CONCLUIDO');
    expect(body.trip.stopTracking).toBe(true);
  });
});
