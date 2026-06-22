import { Module } from '@nestjs/common';
import { WebTripsController } from './web-trips.controller';
import { WebTripsService } from './web-trips.service';

/** Espacio /api/web/* (portal de monitoristas). Guard JWT llega en Fase 6.1. */
@Module({
  controllers: [WebTripsController],
  providers: [WebTripsService],
})
export class WebModule {}
