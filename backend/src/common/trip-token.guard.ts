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
 * Resuelve el viaje sea cual sea su estado: si ya está CONCLUIDO, el service descarta los
 * puntos y responde `stopTracking:true` (S-05) para que la app detenga el GPS — por eso el
 * guard NO filtra por EN_RUTA. Adjunta el viaje resuelto a `req.trip` para el handler.
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
    const trip = await this.prisma.trip.findUnique({
      where: { tripTokenHash },
    });
    if (!trip) throw new UnauthorizedException('tripToken inválido');

    req.trip = trip;
    return true;
  }
}
