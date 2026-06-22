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
  let prisma: { trip: { findFirst: jest.Mock } };
  let guard: TripTokenGuard;

  beforeEach(() => {
    prisma = { trip: { findFirst: jest.fn() } };
    guard = new TripTokenGuard(prisma as never);
  });

  it('sin header Authorization → 401', async () => {
    await expect(guard.canActivate(context({}))).rejects.toBeInstanceOf(
      UnauthorizedException,
    );
    expect(prisma.trip.findFirst).not.toHaveBeenCalled();
  });

  it('token que no resuelve a un viaje EN_RUTA → 401', async () => {
    prisma.trip.findFirst.mockResolvedValue(null);
    await expect(
      guard.canActivate(context({ authorization: 'Bearer trk_live_xxx' })),
    ).rejects.toBeInstanceOf(UnauthorizedException);
  });

  it('token válido → true, busca por hash + EN_RUTA y adjunta el viaje', async () => {
    const token = 'trk_live_abc';
    const trip = { id: 'trip-1', status: 'EN_RUTA' };
    prisma.trip.findFirst.mockResolvedValue(trip);

    const ctx = context({ authorization: `Bearer ${token}` });
    await expect(guard.canActivate(ctx)).resolves.toBe(true);

    const calls = prisma.trip.findFirst.mock.calls as Array<
      [{ where: { status: string; tripTokenHash: string } }]
    >;
    const where = calls[0][0].where;
    expect(where.status).toBe('EN_RUTA');
    expect(where.tripTokenHash).toBe(
      createHash('sha256').update(token).digest('hex'),
    );
    // El viaje resuelto queda en req.trip para el handler.
    const req = ctx.switchToHttp().getRequest<{ trip?: unknown }>();
    expect(req.trip).toBe(trip);
  });
});
