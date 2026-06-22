import { BadRequestException } from '@nestjs/common';
import { LocationsService } from './locations.service';
import { CreateLocationDto } from './dto/create-location.dto';

describe('LocationsService', () => {
  let prisma: { location: { create: jest.Mock } };
  let service: LocationsService;

  beforeEach(() => {
    prisma = { location: { create: jest.fn() } };
    service = new LocationsService(prisma as never);
  });

  it('almacena un punto con batchId generado y recordedAt como Date', async () => {
    const dto: CreateLocationDto = {
      lat: 25.67,
      lng: -100.3,
      accuracyMeters: 12,
      recordedAt: '2026-06-22T15:45:00.000Z',
    };
    prisma.location.create.mockResolvedValue({
      id: 1,
      lat: dto.lat,
      lng: dto.lng,
      recordedAt: new Date(dto.recordedAt),
    });

    const res = await service.addPoint('trip-1', dto);

    expect(res.stored).toBe(1);
    const calls = prisma.location.create.mock.calls as Array<
      [{ data: { tripId: string; recordedAt: Date; batchId: string } }]
    >;
    const data = calls[0][0].data;
    expect(data.tripId).toBe('trip-1');
    expect(data.recordedAt).toBeInstanceOf(Date);
    expect(typeof data.batchId).toBe('string');
    expect(data.batchId.length).toBeGreaterThan(0);
  });

  it('rechaza recordedAt en el futuro → 400', async () => {
    const future = new Date(Date.now() + 5 * 60_000).toISOString();
    const dto: CreateLocationDto = {
      lat: 25.67,
      lng: -100.3,
      accuracyMeters: 12,
      recordedAt: future,
    };
    await expect(service.addPoint('trip-1', dto)).rejects.toBeInstanceOf(
      BadRequestException,
    );
    expect(prisma.location.create).not.toHaveBeenCalled();
  });
});
