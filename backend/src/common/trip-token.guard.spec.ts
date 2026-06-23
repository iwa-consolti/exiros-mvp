import { ExecutionContext, UnauthorizedException } from '@nestjs/common';
import { createHash } from 'node:crypto';
import { TripTokenGuard } from './trip-token.guard';

function context(headers: Record<string, string>): ExecutionContext {
  const req: { header: (h: string) => string | undefined; trip?: unknown } = {
    header: (h) => headers[h.toLowerCase()],
  };
  return {
    switchToHttp: () => ({ getRequest: () => req }),
  } as unknown as ExecutionContext;
}

describe('TripTokenGuard', () => {
  let prisma: { trip: { findUnique: jest.Mock } };
  let guard: TripTokenGuard;

  beforeEach(() => {
    prisma = { trip: { findUnique: jest.fn() } };
    guard = new TripTokenGuard(prisma as never);
  });

  it('sin header Authorization → 401', async () => {
    await expect(guard.canActivate(context({}))).rejects.toBeInstanceOf(
      UnauthorizedException,
    );
    expect(prisma.trip.findUnique).not.toHaveBeenCalled();
  });

  it('token que no resuelve a ningún viaje → 401', async () => {
    prisma.trip.findUnique.mockResolvedValue(null);
    await expect(
      guard.canActivate(context({ authorization: 'Bearer trk_live_xxx' })),
    ).rejects.toBeInstanceOf(UnauthorizedException);
  });

  it('token válido → true, busca por hash (cualquier estado) y adjunta el viaje', async () => {
    const token = 'trk_live_abc';
    // Un viaje CONCLUIDO también resuelve (el service decide descartar + stopTracking).
    const trip = { id: 'trip-1', status: 'CONCLUIDO' };
    prisma.trip.findUnique.mockResolvedValue(trip);

    const ctx = context({ authorization: `Bearer ${token}` });
    await expect(guard.canActivate(ctx)).resolves.toBe(true);

    const calls = prisma.trip.findUnique.mock.calls as Array<
      [{ where: { tripTokenHash: string } }]
    >;
    const where = calls[0][0].where;
    expect(where).not.toHaveProperty('status'); // ya no filtra por EN_RUTA
    expect(where.tripTokenHash).toBe(
      createHash('sha256').update(token).digest('hex'),
    );
    const req = ctx.switchToHttp().getRequest<{ trip?: unknown }>();
    expect(req.trip).toBe(trip);
  });
});
