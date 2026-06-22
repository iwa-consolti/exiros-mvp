import { Injectable } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';

/** Lectura de viajes para el portal (W1/W2): activos primero, luego recientes. */
@Injectable()
export class WebTripsService {
  constructor(private readonly prisma: PrismaService) {}

  findAll() {
    return this.prisma.trip.findMany({
      orderBy: [{ status: 'asc' }, { startedAt: 'desc' }],
      select: {
        id: true,
        providerNumber: true,
        providerName: true,
        folio: true,
        frontPlate: true,
        rearPlate: true,
        status: true,
        startedAt: true,
        endedAt: true,
        photoPath: true,
        destination: { select: { name: true } },
      },
    });
  }
}
