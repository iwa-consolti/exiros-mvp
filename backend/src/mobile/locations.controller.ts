import {
  Body,
  Controller,
  ForbiddenException,
  HttpCode,
  Param,
  Post,
  Req,
  UseGuards,
} from '@nestjs/common';
import type { Request } from 'express';
import type { Trip } from '@prisma/client';
import { TripTokenGuard } from '../common/trip-token.guard';
import { CreateLocationDto } from './dto/create-location.dto';
import { LocationsService } from './locations.service';

/**
 * POST /api/mobile/trips/:id/locations — ingesta de la bala trazadora (Slice 0).
 * Guard: tripToken (Bearer). El token resuelve el viaje; el :id de la URL debe
 * coincidir con ese viaje (no se ingiere a un viaje ajeno al token).
 */
@UseGuards(TripTokenGuard)
@Controller('mobile/trips/:id/locations')
export class MobileLocationsController {
  constructor(private readonly locations: LocationsService) {}

  @Post()
  @HttpCode(201)
  add(
    @Param('id') id: string,
    @Body() dto: CreateLocationDto,
    @Req() req: Request & { trip: Trip },
  ) {
    if (req.trip.id !== id) {
      throw new ForbiddenException('El tripToken no corresponde a este viaje');
    }
    return this.locations.addPoint(id, dto);
  }
}
