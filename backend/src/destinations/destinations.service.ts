import { Injectable } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';

/** Servicio único de destinos (regla anti-duplicación §2.1: lo comparten web y mobile). */
@Injectable()
export class DestinationsService {
  constructor(private readonly prisma: PrismaService) {}

  /** RN-09/RN-14: catálogo activo para el dropdown. Vacío → []. */
  findActive() {
    return this.prisma.destination.findMany({
      where: { isActive: true },
      select: {
        id: true,
        name: true,
        centerLat: true,
        centerLng: true,
        radiusMeters: true,
      },
      orderBy: { name: 'asc' },
    });
  }
}
