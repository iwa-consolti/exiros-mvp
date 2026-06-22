import { Module } from '@nestjs/common';
import { AppKeyGuard } from '../common/app-key.guard';
import { TripTokenGuard } from '../common/trip-token.guard';
import { DestinationsService } from '../destinations/destinations.service';
import { MobileDestinationsController } from './destinations.controller';
import { MobileTripsController } from './trips.controller';
import { MobileLocationsController } from './locations.controller';
import { TripsService } from './trips.service';
import { LocationsService } from './locations.service';

/** Espacio /api/mobile/* (bootstrap por X-App-Key, ingesta por tripToken). */
@Module({
  controllers: [
    MobileDestinationsController,
    MobileTripsController,
    MobileLocationsController,
  ],
  providers: [
    AppKeyGuard,
    TripTokenGuard,
    DestinationsService,
    TripsService,
    LocationsService,
  ],
})
export class MobileModule {}
