import {
  CanActivate,
  ExecutionContext,
  Injectable,
  UnauthorizedException,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import type { Request } from 'express';

/**
 * Guard del bootstrap móvil (ADR-007): exige X-App-Key estática.
 * Débil por diseño (la clave es extraíble del APK); eleva la barrera frente a
 * scripts triviales. La defensa fuerte de la ingesta es el tripToken.
 */
@Injectable()
export class AppKeyGuard implements CanActivate {
  constructor(private readonly config: ConfigService) {}

  canActivate(context: ExecutionContext): boolean {
    const req = context.switchToHttp().getRequest<Request>();
    const provided = req.header('x-app-key');
    const expected = this.config.get<string>('APP_KEY');
    if (!expected || provided !== expected) {
      throw new UnauthorizedException('X-App-Key inválida');
    }
    return true;
  }
}
