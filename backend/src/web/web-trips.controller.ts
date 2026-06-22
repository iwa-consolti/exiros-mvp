import { Controller, Get } from '@nestjs/common';
import { WebTripsService } from './web-trips.service';

// TODO Fase 6.1: proteger el espacio /api/web/* con Guard JWT (auth aún no montado).
@Controller('web/trips')
export class WebTripsController {
  constructor(private readonly trips: WebTripsService) {}

  @Get()
  list() {
    return this.trips.findAll();
  }
}
