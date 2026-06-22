import { BadRequestException, Injectable } from '@nestjs/common';
import { randomUUID } from 'node:crypto';
import { PrismaService } from '../prisma/prisma.service';
import { CreateLocationDto } from './dto/create-location.dto';

/** Persiste puntos de ruta (Slice 0 / bala trazadora). 3.4 añadirá lotes + idempotencia. */
@Injectable()
export class LocationsService {
  constructor(private readonly prisma: PrismaService) {}

  async addPoint(tripId: string, dto: CreateLocationDto) {
    const recordedAt = new Date(dto.recordedAt);
    if (recordedAt.getTime() > Date.now() + 60_000) {
      throw new BadRequestException('recordedAt no puede estar en el futuro');
    }
    const point = await this.prisma.location.create({
      data: {
        tripId,
        lat: dto.lat,
        lng: dto.lng,
        accuracyMeters: dto.accuracyMeters,
        recordedAt,
        batchId: randomUUID(), // un punto = un lote en el tracer; 3.4 agrupa lotes reales
      },
      select: { id: true, lat: true, lng: true, recordedAt: true },
    });
    return { stored: 1, point };
  }
}
