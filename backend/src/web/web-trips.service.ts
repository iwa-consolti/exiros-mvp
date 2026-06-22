import { Injectable } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';

/** Lectura de viajes para el portal (W1/W2): activos primero, luego recientes. */
@Injectable()
export class WebTripsService {
  constructor(private readonly prisma: PrismaService) {}

  async findAll() {
    const trips = await this.prisma.trip.findMany({
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
        destination: {
          select: { name: true, centerLat: true, centerLng: true },
        },
        // Último punto de ruta para pintarlo en el mapa (Slice 0 / bala trazadora).
        locations: {
          orderBy: { recordedAt: 'desc' },
          take: 1,
          select: { lat: true, lng: true, recordedAt: true },
        },
      },
    });

    // Aplanar el último punto a `lastLocation` (o null) para el portal.
    return trips.map(({ locations, ...trip }) => ({
      ...trip,
      lastLocation: locations[0] ?? null,
    }));
  }
}
