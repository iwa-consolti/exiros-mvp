import {
  CanActivate,
  ExecutionContext,
  Injectable,
  UnauthorizedException,
} from '@nestjs/common';
import { createHash } from 'node:crypto';
import type { Request } from 'express';
import { PrismaService } from '../prisma/prisma.service';

/**
 * Guard de la ingesta (ADR-007): exige `Authorization: Bearer <tripToken>`.
 * El token no se guarda en claro → se hashea y se busca el viaje por tripTokenHash.
 * Sólo viajes EN_RUTA aceptan puntos (no se ingiere a un viaje concluido / de otro
 * dispositivo). Adjunta el viaje resuelto a `req.trip` para el handler.
 */
@Injectable()
export class TripTokenGuard implements CanActivate {
  constructor(private readonly prisma: PrismaService) {}

  async canActivate(context: ExecutionContext): Promise<boolean> {
    const req = context
      .switchToHttp()
      .getRequest<Request & { trip?: unknown }>();
    const auth = req.header('authorization') ?? '';
    const token = auth.startsWith('Bearer ') ? auth.slice(7).trim() : '';
    if (!token) throw new UnauthorizedException('Falta tripToken');

    const tripTokenHash = createHash('sha256').update(token).digest('hex');
    const trip = await this.prisma.trip.findFirst({
      where: { tripTokenHash, status: 'EN_RUTA' },
    });
    if (!trip)
      throw new UnauthorizedException('tripToken inválido o viaje no activo');

    req.trip = trip;
    return true;
  }
}
