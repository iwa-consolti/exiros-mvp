import {
  BadRequestException,
  ConflictException,
  Injectable,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { createHash, createHmac } from 'node:crypto';
import { Prisma, type Trip } from '@prisma/client';
import { PrismaService } from '../prisma/prisma.service';
import { CreateTripDto } from './dto/create-trip.dto';

/** Crea viajes desde el bootstrap móvil (CU-01): idempotencia, tripToken y snapshot. */
@Injectable()
export class TripsService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly config: ConfigService,
  ) {}

  /** tripToken derivado por HMAC (determinista) → reconstruible sin guardarlo en claro. */
  private deriveToken(deviceId: string, clientRequestId: string): string {
    const secret = this.config.get<string>('TRIP_TOKEN_SECRET') ?? '';
    const sig = createHmac('sha256', secret)
      .update(`${deviceId}:${clientRequestId}`)
      .digest('hex');
    return `trk_live_${sig}`;
  }

  /** En BD sólo vive el hash del token. */
  private hashToken(token: string): string {
    return createHash('sha256').update(token).digest('hex');
  }

  private toResponse(trip: Trip, token: string) {
    return {
      tripId: trip.id,
      tripToken: token,
      status: trip.status,
      startedAt: trip.startedAt,
      geofence: {
        centerLat: trip.destinationLat,
        centerLng: trip.destinationLng,
        radiusMeters: trip.destinationRadiusMeters,
      },
    };
  }

  async create(dto: CreateTripDto) {
    const token = this.deriveToken(dto.deviceId, dto.clientRequestId);

    // Idempotencia RN-15: misma solicitud previa → misma respuesta (sin duplicar).
    const existing = await this.prisma.trip.findUnique({
      where: { clientRequestId: dto.clientRequestId },
    });
    if (existing) {
      if (!this.samePayload(existing, dto)) {
        throw new ConflictException(
          'clientRequestId ya usado con otro payload o deviceId',
        );
      }
      return this.toResponse(existing, token);
    }

    // Snapshot RN-16: copiar centro+radio vigentes del destino activo al viaje.
    const dest = await this.prisma.destination.findFirst({
      where: { id: dto.destinationId, isActive: true },
    });
    if (!dest) {
      throw new BadRequestException('destinationId inexistente o inactivo');
    }

    try {
      const trip = await this.prisma.trip.create({
        data: {
          providerNumber: dto.providerNumber,
          providerName: dto.providerName,
          folio: dto.folio,
          frontPlate: dto.frontPlate,
          rearPlate: dto.rearPlate ?? null,
          destinationId: dest.id,
          destinationLat: dest.centerLat,
          destinationLng: dest.centerLng,
          destinationRadiusMeters: dest.radiusMeters,
          photoPath: 'PENDING', // la foto se sube en el Bloque 2.2 (multipart)
          deviceId: dto.deviceId,
          clientRequestId: dto.clientRequestId,
          tripTokenHash: this.hashToken(token),
        },
      });
      return this.toResponse(trip, token);
    } catch (e) {
      if (
        e instanceof Prisma.PrismaClientKnownRequestError &&
        e.code === 'P2002'
      ) {
        // Carrera: clientRequestId duplicado → idempotente; si no, RN-11 (viaje activo).
        const again = await this.prisma.trip.findUnique({
          where: { clientRequestId: dto.clientRequestId },
        });
        if (again && this.samePayload(again, dto)) {
          return this.toResponse(again, token);
        }
        throw new ConflictException(
          'Ya existe un viaje EN_RUTA para este dispositivo (RN-11)',
        );
      }
      throw e;
    }
  }

  private samePayload(trip: Trip, dto: CreateTripDto): boolean {
    return (
      trip.deviceId === dto.deviceId &&
      trip.providerNumber === dto.providerNumber &&
      trip.providerName === dto.providerName &&
      trip.folio === dto.folio &&
      trip.frontPlate === dto.frontPlate &&
      (trip.rearPlate ?? null) === (dto.rearPlate ?? null) &&
      trip.destinationId === dto.destinationId
    );
  }
}
