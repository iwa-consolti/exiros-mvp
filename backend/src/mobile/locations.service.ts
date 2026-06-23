import { Injectable } from '@nestjs/common';
import type { Trip, TripStatus } from '@prisma/client';
import { PrismaService } from '../prisma/prisma.service';
import { IngestBatchDto, IngestPointDto } from './dto/ingest-batch.dto';

/** Caja envolvente de México (aprox) para descartar puntos fuera de región. */
const MX_BBOX = { latMin: 14.3, latMax: 32.9, lngMin: -118.7, lngMax: -86.5 };
/** Tolerancia de reloj para `recordedAt` (60 s) — descarta timestamps del futuro. */
const FUTURE_SKEW_MS = 60_000;
/** Precisión máxima (m) para que un punto sea elegible para evaluar geocerca. */
const ACCURACY_ELIGIBLE_M = 50;
/** Radio de la Tierra (m) para haversine. */
const EARTH_RADIUS_M = 6_371_000;

/** Respuesta de la ingesta (contrato `IngestResponse` de api-spec.md §4 / openapi.yaml). */
export interface IngestResult {
  accepted: number;
  duplicateBatch: boolean;
  trip: { status: TripStatus; stopTracking: boolean };
}

/**
 * Ingesta de ruta por lotes (3.4) + cierre automático por geocerca (4.1). Trata cada punto
 * como hostil: valida estructura en el DTO y filtra aquí lo semántico (bbox MX, no futuro).
 * `batchId` + índice único dan idempotencia. Tras persistir, evalúa haversine sobre los 2
 * puntos válidos/precisos más recientes contra el snapshot del destino: si alguno está dentro
 * del radio → cierra el viaje (AUTO_GEOFENCE) y responde `stopTracking:true`.
 * Un viaje ya CONCLUIDO descarta sus puntos y responde `stopTracking:true` (S-05).
 */
@Injectable()
export class LocationsService {
  constructor(private readonly prisma: PrismaService) {}

  async addBatch(trip: Trip, dto: IngestBatchDto): Promise<IngestResult> {
    // Viaje ya cerrado: descartar puntos, decirle a la app que detenga el GPS.
    if (trip.status !== 'EN_RUTA') {
      return {
        accepted: 0,
        duplicateBatch: false,
        trip: { status: trip.status, stopTracking: true },
      };
    }

    const now = Date.now();
    const valid = dto.points.filter((p) => this.isValid(p, now));

    let accepted = 0;
    if (valid.length > 0) {
      const created = await this.prisma.location.createMany({
        data: valid.map((p) => ({
          tripId: trip.id,
          lat: p.lat,
          lng: p.lng,
          accuracyMeters: p.accuracyMeters,
          recordedAt: new Date(p.recordedAt),
          batchId: dto.batchId,
        })),
        skipDuplicates: true, // reenviar el mismo lote no duplica (idempotencia)
      });
      accepted = created.count;

      const newest = new Date(
        valid.reduce((max, p) => Math.max(max, Date.parse(p.recordedAt)), 0),
      );
      await this.prisma.trip.updateMany({
        where: {
          id: trip.id,
          OR: [{ lastLocationAt: null }, { lastLocationAt: { lt: newest } }],
        },
        data: { lastLocationAt: newest },
      });
    }

    const duplicateBatch = valid.length > 0 && accepted === 0;
    const closed = await this.evaluateGeofence(trip);

    return {
      accepted,
      duplicateBatch,
      trip: {
        status: closed ? 'CONCLUIDO' : 'EN_RUTA',
        stopTracking: closed,
      },
    };
  }

  /**
   * Cierra el viaje si alguno de los 2 puntos más recientes y elegibles por precisión cae
   * dentro de la geocerca del snapshot. Toda la ruta queda guardada; sólo estos 2 deciden.
   * El cierre es atómico (`updateMany WHERE status=EN_RUTA`): en una carrera, sólo un actor gana.
   * @returns true si el viaje quedó CONCLUIDO (por este cierre o por uno concurrente).
   */
  private async evaluateGeofence(trip: Trip): Promise<boolean> {
    const recent = await this.prisma.location.findMany({
      where: { tripId: trip.id, accuracyMeters: { lte: ACCURACY_ELIGIBLE_M } },
      orderBy: { recordedAt: 'desc' },
      take: 2,
      select: { lat: true, lng: true },
    });

    const inside = recent.some(
      (p) =>
        haversineMeters(
          p.lat,
          p.lng,
          trip.destinationLat,
          trip.destinationLng,
        ) <= trip.destinationRadiusMeters,
    );
    if (!inside) return false;

    const res = await this.prisma.trip.updateMany({
      where: { id: trip.id, status: 'EN_RUTA' },
      data: {
        status: 'CONCLUIDO',
        closureType: 'AUTO_GEOFENCE',
        endedAt: new Date(),
      },
    });
    // count 1 = lo cerramos nosotros; 0 = otro actor lo cerró antes (igual está CONCLUIDO).
    return res.count === 1 || (await this.isConcluded(trip.id));
  }

  private async isConcluded(tripId: string): Promise<boolean> {
    const t = await this.prisma.trip.findUnique({
      where: { id: tripId },
      select: { status: true },
    });
    return t?.status === 'CONCLUIDO';
  }

  private isValid(p: IngestPointDto, now: number): boolean {
    const t = Date.parse(p.recordedAt);
    if (Number.isNaN(t) || t > now + FUTURE_SKEW_MS) return false;
    if (p.lat < MX_BBOX.latMin || p.lat > MX_BBOX.latMax) return false;
    if (p.lng < MX_BBOX.lngMin || p.lng > MX_BBOX.lngMax) return false;
    return true;
  }
}

/** Distancia en metros entre dos coordenadas (haversine; ADR-012, sin PostGIS). */
export function haversineMeters(
  lat1: number,
  lng1: number,
  lat2: number,
  lng2: number,
): number {
  const toRad = (d: number) => (d * Math.PI) / 180;
  const dLat = toRad(lat2 - lat1);
  const dLng = toRad(lng2 - lng1);
  const a =
    Math.sin(dLat / 2) ** 2 +
    Math.cos(toRad(lat1)) * Math.cos(toRad(lat2)) * Math.sin(dLng / 2) ** 2;
  return EARTH_RADIUS_M * 2 * Math.asin(Math.sqrt(a));
}
