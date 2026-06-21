import { Controller, Get, UseGuards } from '@nestjs/common';
import { AppKeyGuard } from '../common/app-key.guard';
import { DestinationsService } from '../destinations/destinations.service';

/** GET /api/mobile/destinations — catálogo activo para el dropdown (X-App-Key). */
@UseGuards(AppKeyGuard)
@Controller('mobile/destinations')
export class MobileDestinationsController {
  constructor(private readonly destinations: DestinationsService) {}

  @Get()
  list() {
    return this.destinations.findActive();
  }
}
