import {
  CanActivate,
  ExecutionContext,
  Injectable,
  UnauthorizedException,
  createParamDecorator,
} from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import type { Request } from 'express';
import { PrismaService } from '../prisma/prisma.service';
import type { AuthUser, JwtPayload } from '../auth/jwt-payload';

/**
 * Guard del espacio /api/web/* (ADR-007): exige `Authorization: Bearer <jwt>`.
 * Verifica firma + expiración con JwtService y, además, revalida contra BD que el
 * usuario siga existiendo y activo (H-1): un usuario dado de baja o degradado deja
 * de operar en el siguiente request, sin esperar a que expire el token. El `role`
 * adjuntado a `req.user` es el FRESCO de BD, no el del token (refleja cambios de rol).
 * Se aplica explícitamente por controlador web (no global) para no tocar la
 * superficie pública móvil ni el propio login.
 */
@Injectable()
export class JwtAuthGuard implements CanActivate {
  constructor(
    private readonly jwt: JwtService,
    private readonly prisma: PrismaService,
  ) {}

  async canActivate(context: ExecutionContext): Promise<boolean> {
    const req = context
      .switchToHttp()
      .getRequest<Request & { user?: AuthUser }>();
    const auth = req.header('authorization') ?? '';
    const token = auth.startsWith('Bearer ') ? auth.slice(7).trim() : '';
    if (!token) throw new UnauthorizedException('Falta token de sesión');

    let payload: JwtPayload;
    try {
      payload = await this.jwt.verifyAsync<JwtPayload>(token);
    } catch {
      throw new UnauthorizedException('Token inválido o expirado');
    }

    // Revalidación ligera contra BD: estado vivo del usuario manda sobre los claims.
    const user = await this.prisma.user.findUnique({
      where: { id: payload.sub },
      select: { id: true, email: true, role: true, isActive: true },
    });
    if (!user || !user.isActive) {
      throw new UnauthorizedException('Sesión no válida');
    }

    req.user = { sub: user.id, email: user.email, role: user.role };
    return true;
  }
}

/** `@CurrentUser()` → el AuthUser que el guard adjuntó a la request. */
export const CurrentUser = createParamDecorator(
  (_data: unknown, context: ExecutionContext): AuthUser => {
    const req = context
      .switchToHttp()
      .getRequest<Request & { user: AuthUser }>();
    return req.user;
  },
);
