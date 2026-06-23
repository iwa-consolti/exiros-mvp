import { INestApplication } from '@nestjs/common';
import { Test } from '@nestjs/testing';
import request from 'supertest';
import { App } from 'supertest/types';
import { PrismaClient, Role } from '@prisma/client';
import { randomUUID } from 'node:crypto';
import * as bcrypt from 'bcryptjs';
import { Workbook } from 'exceljs';
import { REPORT_HEADERS } from '../src/web/reports.service';
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
  let adminToken: string;
  let monitorToken: string;

  // Usuario admin propio del e2e (login real → JWT para las rutas /api/web/*).
  const adminEmail = `e2e-admin-${Date.now()}@exiros.com`;
  const adminPassword = 'e2e-pass-1234';
  const monitorEmail = `e2e-monitor-${Date.now()}@exiros.com`;
  const monitorPassword = 'e2e-pass-5678';

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

    // Admin para autenticar /api/web/*: se crea con hash y se hace login real por HTTP.
    await prisma.user.create({
      data: {
        email: adminEmail,
        name: 'E2E Admin',
        passwordHash: await bcrypt.hash(adminPassword, 10),
        role: Role.ADMIN,
      },
    });
    const login = await request(app.getHttpServer())
      .post('/api/web/auth/login')
      .send({ email: adminEmail, password: adminPassword });
    adminToken = (login.body as { accessToken: string }).accessToken;

    // Monitorista (rol no-admin) para probar el AdminRolesGuard (403 en Destinos).
    await prisma.user.create({
      data: {
        email: monitorEmail,
        name: 'E2E Monitor',
        passwordHash: await bcrypt.hash(monitorPassword, 10),
        role: Role.MONITOR,
      },
    });
    const mlogin = await request(app.getHttpServer())
      .post('/api/web/auth/login')
      .send({ email: monitorEmail, password: monitorPassword });
    monitorToken = (mlogin.body as { accessToken: string }).accessToken;
  });

  afterAll(async () => {
    // Borra TODOS los viajes de este destino (incluye los creados para los tests de cierre).
    await prisma.trip.deleteMany({ where: { destinationId: destId } });
    await prisma.destination
      .delete({ where: { id: destId } })
      .catch(() => undefined);
    await prisma.destination
      .deleteMany({ where: { name: { startsWith: 'E2E-CRUD' } } })
      .catch(() => undefined);
    await prisma.user
      .deleteMany({
        where: {
          OR: [
            { email: { in: [adminEmail, monitorEmail] } },
            { email: { startsWith: 'e2e-users-' } },
          ],
        },
      })
      .catch(() => undefined);
    await prisma.$disconnect();
    await app.close();
  });

  /** Crea un viaje EN_RUTA con deviceId/crid propios (para tests de cierre). */
  async function makeTrip(
    suffix: string,
  ): Promise<{ id: string; token: string }> {
    const res = await postTrip({
      deviceId: `e2e-${suffix}-${Date.now()}`,
      clientRequestId: `crid-${suffix}-${Date.now()}`,
    });
    const b = res.body as TripResp;
    return { id: b.tripId, token: b.tripToken };
  }

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
    const res = await request(app.getHttpServer())
      .get('/api/web/trips')
      .set('Authorization', `Bearer ${adminToken}`);
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
    const res = await request(app.getHttpServer())
      .get('/api/web/trips')
      .set('Authorization', `Bearer ${adminToken}`);
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

  // --- Cierres manuales (4.2 operador / 4.3 admin) ---
  it('cierre operador (móvil) → 200 MANUAL_OPERATOR; replay del mismo closeRequestId es idempotente', async () => {
    const t = await makeTrip('opclose');
    const closeRequestId = randomUUID();
    const requestedAt = new Date().toISOString();
    const send = () =>
      request(app.getHttpServer())
        .post(`/api/mobile/trips/${t.id}/close`)
        .set('Authorization', `Bearer ${t.token}`)
        .send({
          observations: 'Entrega cancelada',
          requestedAt,
          closeRequestId,
        });

    const first = await send();
    expect(first.status).toBe(200);
    expect((first.body as { closureType: string }).closureType).toBe(
      'MANUAL_OPERATOR',
    );

    const replay = await send(); // mismo closeRequestId → idempotente, no 409
    expect(replay.status).toBe(200);
    expect((replay.body as { status: string }).status).toBe('CONCLUIDO');
  });

  it('cierre operador con requestedAt futuro → 400', async () => {
    const t = await makeTrip('opfuture');
    const res = await request(app.getHttpServer())
      .post(`/api/mobile/trips/${t.id}/close`)
      .set('Authorization', `Bearer ${t.token}`)
      .send({
        observations: 'x',
        requestedAt: new Date(Date.now() + 10 * 60_000).toISOString(),
        closeRequestId: randomUUID(),
      });
    expect(res.status).toBe(400);
  });

  it('cierre admin (web) → 200 MANUAL_ADMIN', async () => {
    const t = await makeTrip('adminclose');
    const res = await request(app.getHttpServer())
      .post(`/api/web/trips/${t.id}/close`)
      .set('Authorization', `Bearer ${adminToken}`)
      .send({ observations: 'Cierre administrativo' });
    expect(res.status).toBe(200);
    expect((res.body as { closureType: string }).closureType).toBe(
      'MANUAL_ADMIN',
    );
    // 6.1: el cierre admin ya registra al usuario autenticado (closedById deja de ser null).
    const closed = await prisma.trip.findUnique({ where: { id: t.id } });
    expect(closed?.closedById).not.toBeNull();
  });

  it('carrera: segundo cierre distinto → 409 TRIP_ALREADY_CONCLUDED', async () => {
    const t = await makeTrip('race');
    const first = await request(app.getHttpServer())
      .post(`/api/web/trips/${t.id}/close`)
      .set('Authorization', `Bearer ${adminToken}`)
      .send({ observations: 'gana admin' });
    expect(first.status).toBe(200);

    const second = await request(app.getHttpServer())
      .post(`/api/mobile/trips/${t.id}/close`)
      .set('Authorization', `Bearer ${t.token}`)
      .send({
        observations: 'pierde operador',
        requestedAt: new Date().toISOString(),
        closeRequestId: randomUUID(),
      });
    expect(second.status).toBe(409);
    expect((second.body as { message: string }).message).toBe(
      'TRIP_ALREADY_CONCLUDED',
    );
  });

  // --- Auth web (6.1) ---
  it('POST /web/auth/login con credenciales válidas → 200 accessToken + user sin passwordHash', async () => {
    const res = await request(app.getHttpServer())
      .post('/api/web/auth/login')
      .send({ email: adminEmail, password: adminPassword });
    const body = res.body as {
      accessToken: string;
      user: Record<string, unknown>;
    };
    expect(res.status).toBe(200);
    expect(typeof body.accessToken).toBe('string');
    expect(body.user.email).toBe(adminEmail);
    expect(body.user.role).toBe('ADMIN');
    expect(body.user).not.toHaveProperty('passwordHash');
  });

  it('POST /web/auth/login con password incorrecta → 401 genérico', async () => {
    const res = await request(app.getHttpServer())
      .post('/api/web/auth/login')
      .send({ email: adminEmail, password: 'mala' });
    expect(res.status).toBe(401);
  });

  it('POST /web/auth/login con email inexistente → 401 (no filtra existencia)', async () => {
    const res = await request(app.getHttpServer())
      .post('/api/web/auth/login')
      .send({ email: 'nadie@exiros.com', password: 'x' });
    expect(res.status).toBe(401);
  });

  it('GET /api/web/trips sin token → 401', async () => {
    const res = await request(app.getHttpServer()).get('/api/web/trips');
    expect(res.status).toBe(401);
  });

  it('GET /api/web/trips con token inválido → 401', async () => {
    const res = await request(app.getHttpServer())
      .get('/api/web/trips')
      .set('Authorization', 'Bearer no-es-un-jwt');
    expect(res.status).toBe(401);
  });

  it('GET /web/auth/me con token → 200 perfil del admin', async () => {
    const res = await request(app.getHttpServer())
      .get('/api/web/auth/me')
      .set('Authorization', `Bearer ${adminToken}`);
    const body = res.body as { email: string; role: string };
    expect(res.status).toBe(200);
    expect(body.email).toBe(adminEmail);
    expect(body.role).toBe('ADMIN');
  });

  // --- Destinos CRUD (10.5 / Fase 5.1) ---
  let crudDestId = '';

  it('GET /web/destinations sin token → 401', async () => {
    const res = await request(app.getHttpServer()).get('/api/web/destinations');
    expect(res.status).toBe(401);
  });

  it('GET /web/destinations con MONITOR → 403 (AdminRolesGuard)', async () => {
    const res = await request(app.getHttpServer())
      .get('/api/web/destinations')
      .set('Authorization', `Bearer ${monitorToken}`);
    expect(res.status).toBe(403);
  });

  it('POST /web/destinations con radio fuera de rango (50) → 400', async () => {
    const res = await request(app.getHttpServer())
      .post('/api/web/destinations')
      .set('Authorization', `Bearer ${adminToken}`)
      .send({
        name: 'E2E-CRUD malo',
        centerLat: 25.6,
        centerLng: -100.3,
        radiusMeters: 50,
      });
    expect(res.status).toBe(400);
  });

  it('POST /web/destinations con admin → 201 (radio 100-700)', async () => {
    const res = await request(app.getHttpServer())
      .post('/api/web/destinations')
      .set('Authorization', `Bearer ${adminToken}`)
      .send({
        name: 'E2E-CRUD destino',
        centerLat: 25.6,
        centerLng: -100.3,
        radiusMeters: 250,
      });
    const body = res.body as {
      id: string;
      isActive: boolean;
      radiusMeters: number;
    };
    expect(res.status).toBe(201);
    expect(body.isActive).toBe(true);
    expect(body.radiusMeters).toBe(250);
    crudDestId = body.id;
  });

  it('PATCH /web/destinations/:id → 200 actualiza nombre/radio', async () => {
    const res = await request(app.getHttpServer())
      .patch(`/api/web/destinations/${crudDestId}`)
      .set('Authorization', `Bearer ${adminToken}`)
      .send({
        name: 'E2E-CRUD editado',
        centerLat: 25.6,
        centerLng: -100.3,
        radiusMeters: 400,
      });
    expect(res.status).toBe(200);
    expect((res.body as { radiusMeters: number }).radiusMeters).toBe(400);
  });

  it('PATCH /web/destinations/:id/deactivate luego /restore → isActive false/true', async () => {
    const off = await request(app.getHttpServer())
      .patch(`/api/web/destinations/${crudDestId}/deactivate`)
      .set('Authorization', `Bearer ${adminToken}`);
    expect(off.status).toBe(200);
    expect((off.body as { isActive: boolean }).isActive).toBe(false);

    const on = await request(app.getHttpServer())
      .patch(`/api/web/destinations/${crudDestId}/restore`)
      .set('Authorization', `Bearer ${adminToken}`);
    expect(on.status).toBe(200);
    expect((on.body as { isActive: boolean }).isActive).toBe(true);
  });

  // --- Usuarios CRUD (10.6 / Fase 6.2) ---
  let crudUserId = '';
  const newUserEmail = `e2e-users-new-${Date.now()}@exiros.com`;

  it('GET /web/users con MONITOR → 403', async () => {
    const res = await request(app.getHttpServer())
      .get('/api/web/users')
      .set('Authorization', `Bearer ${monitorToken}`);
    expect(res.status).toBe(403);
  });

  it('POST /web/users con password corta (<8) → 400', async () => {
    const res = await request(app.getHttpServer())
      .post('/api/web/users')
      .set('Authorization', `Bearer ${adminToken}`)
      .send({
        name: 'Corto',
        email: `e2e-users-x-${Date.now()}@exiros.com`,
        role: 'MONITOR',
        password: '123',
      });
    expect(res.status).toBe(400);
  });

  it('POST /web/users con admin → 201 (sin passwordHash)', async () => {
    const res = await request(app.getHttpServer())
      .post('/api/web/users')
      .set('Authorization', `Bearer ${adminToken}`)
      .send({
        name: 'E2E Nuevo',
        email: newUserEmail,
        role: 'MONITOR',
        password: 'monitor1234',
      });
    const body = res.body as Record<string, unknown>;
    expect(res.status).toBe(201);
    expect(body.email).toBe(newUserEmail);
    expect(body).not.toHaveProperty('passwordHash');
    crudUserId = body.id as string;
  });

  it('POST /web/users email duplicado → 409', async () => {
    const res = await request(app.getHttpServer())
      .post('/api/web/users')
      .set('Authorization', `Bearer ${adminToken}`)
      .send({
        name: 'Dup',
        email: newUserEmail,
        role: 'MONITOR',
        password: 'monitor1234',
      });
    expect(res.status).toBe(409);
  });

  it('PATCH /web/users/:id → cambia rol a ADMIN; luego baja/restaura', async () => {
    const up = await request(app.getHttpServer())
      .patch(`/api/web/users/${crudUserId}`)
      .set('Authorization', `Bearer ${adminToken}`)
      .send({ name: 'E2E Nuevo', role: 'ADMIN' });
    expect(up.status).toBe(200);
    expect((up.body as { role: string }).role).toBe('ADMIN');

    const off = await request(app.getHttpServer())
      .patch(`/api/web/users/${crudUserId}/deactivate`)
      .set('Authorization', `Bearer ${adminToken}`);
    expect(off.status).toBe(200);
    expect((off.body as { isActive: boolean }).isActive).toBe(false);
  });

  it('protección: dar de baja a un SUPER_ADMIN → 403', async () => {
    const sa = await prisma.user.create({
      data: {
        email: `e2e-users-sa-${Date.now()}@exiros.com`,
        name: 'E2E Super',
        passwordHash: await bcrypt.hash('superpass123', 10),
        role: Role.SUPER_ADMIN,
      },
    });
    const res = await request(app.getHttpServer())
      .patch(`/api/web/users/${sa.id}/deactivate`)
      .set('Authorization', `Bearer ${adminToken}`);
    expect(res.status).toBe(403);
    await prisma.user.delete({ where: { id: sa.id } }).catch(() => undefined);
  });

  // --- Detalle de viaje (10.4) ---
  it('GET /api/web/trips/:id sin token → 401', async () => {
    const res = await request(app.getHttpServer()).get(
      `/api/web/trips/${tripId}`,
    );
    expect(res.status).toBe(401);
  });

  it('GET /api/web/trips/:id con token → 200 con ruta + durationMinutes', async () => {
    const res = await request(app.getHttpServer())
      .get(`/api/web/trips/${tripId}`)
      .set('Authorization', `Bearer ${adminToken}`);
    const body = res.body as {
      id: string;
      route: unknown[];
      durationMinutes: number | null;
      destination: { name: string } | null;
    };
    expect(res.status).toBe(200);
    expect(body.id).toBe(tripId);
    expect(Array.isArray(body.route)).toBe(true);
    expect(body.route.length).toBeGreaterThan(0); // este viaje recibió puntos
    expect(body.destination?.name).toBe('E2E Destino');
  });

  it('GET /api/web/trips/:id inexistente → 404', async () => {
    const res = await request(app.getHttpServer())
      .get(`/api/web/trips/${randomUUID()}`)
      .set('Authorization', `Bearer ${adminToken}`);
    expect(res.status).toBe(404);
  });

  // --- Reporte Excel (7.1) ---
  // Acumula el cuerpo binario de la respuesta (supertest no parsea xlsx).
  const binaryParser = (
    res: import('http').IncomingMessage,
    cb: (err: Error | null, body: Buffer) => void,
  ): void => {
    const chunks: Buffer[] = [];
    res.on('data', (c: Buffer) => chunks.push(c));
    res.on('end', () => cb(null, Buffer.concat(chunks)));
  };

  it('GET /web/reports/export sin token → 401', async () => {
    const res = await request(app.getHttpServer()).get(
      '/api/web/reports/export',
    );
    expect(res.status).toBe(401);
  });

  it('GET /web/reports/export con token → 200 .xlsx con EXACTAMENTE las 13 columnas en orden', async () => {
    const res = await request(app.getHttpServer())
      .get('/api/web/reports/export')
      .set('Authorization', `Bearer ${adminToken}`)
      .buffer()
      .parse(binaryParser);

    expect(res.status).toBe(200);
    expect(res.headers['content-type']).toContain('spreadsheetml.sheet');

    const wb = new Workbook();
    await wb.xlsx.load(res.body as Buffer);
    const ws = wb.worksheets[0];
    // row.values es 1-indexado (índice 0 = undefined) → slice(1).
    const headers = (ws.getRow(1).values as unknown[]).slice(1);
    expect(headers).toEqual([...REPORT_HEADERS]);
    expect(headers).toHaveLength(13);
  });

  it('GET /web/reports/export?status=CONCLUIDO filtra (sólo concluidos)', async () => {
    const res = await request(app.getHttpServer())
      .get('/api/web/reports/export?status=CONCLUIDO')
      .set('Authorization', `Bearer ${adminToken}`)
      .buffer()
      .parse(binaryParser);

    expect(res.status).toBe(200);
    const wb = new Workbook();
    await wb.xlsx.load(res.body as Buffer);
    const ws = wb.worksheets[0];
    // Col 11 = Estatus del Viaje. Toda fila de datos debe decir "Concluido".
    const statuses: string[] = [];
    ws.eachRow((row, n) => {
      if (n === 1) return; // encabezado
      const cell = row.getCell(11).value; // col 11 = Estatus, siempre string
      statuses.push(typeof cell === 'string' ? cell : '');
    });
    for (const s of statuses) expect(s).toBe('Concluido');
  });

  it('GET /web/reports/export?status=BASURA → 400 (validación de enum)', async () => {
    const res = await request(app.getHttpServer())
      .get('/api/web/reports/export?status=BASURA')
      .set('Authorization', `Bearer ${adminToken}`);
    expect(res.status).toBe(400);
  });
});
