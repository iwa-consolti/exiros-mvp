import { Module } from '@nestjs/common';
import { AppKeyGuard } from '../common/app-key.guard';
import { DestinationsService } from '../destinations/destinations.service';
import { MobileDestinationsController } from './destinations.controller';
import { MobileTripsController } from './trips.controller';
import { TripsService } from './trips.service';

/** Espacio /api/mobile/* protegido por X-App-Key (bootstrap). */
@Module({
  controllers: [MobileDestinationsController, MobileTripsController],
  providers: [AppKeyGuard, DestinationsService, TripsService],
})
export class MobileModule {}
