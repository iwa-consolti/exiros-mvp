import { Body, Controller, HttpCode, Post, UseGuards } from '@nestjs/common';
import { AppKeyGuard } from '../common/app-key.guard';
import { CreateTripDto } from './dto/create-trip.dto';
import { TripsService } from './trips.service';

/** POST /api/mobile/trips — crea viaje + emite tripToken (X-App-Key). */
@UseGuards(AppKeyGuard)
@Controller('mobile/trips')
export class MobileTripsController {
  constructor(private readonly trips: TripsService) {}

  @Post()
  @HttpCode(201)
  create(@Body() dto: CreateTripDto) {
    return this.trips.create(dto);
  }
}
