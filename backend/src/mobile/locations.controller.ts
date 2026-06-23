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
import { IngestBatchDto } from './dto/ingest-batch.dto';
import { LocationsService } from './locations.service';

/**
 * POST /api/mobile/trips/:id/locations — ingesta de ruta por lotes GZIP (3.4).
 * Guard: tripToken (Bearer). El token resuelve el viaje; el :id de la URL debe
 * coincidir con ese viaje (no se ingiere a un viaje ajeno al token). El cuerpo llega
 * comprimido (`Content-Encoding: gzip`), que body-parser infla antes de validar.
 */
@UseGuards(TripTokenGuard)
@Controller('mobile/trips/:id/locations')
export class MobileLocationsController {
  constructor(private readonly locations: LocationsService) {}

  @Post()
  @HttpCode(200)
  add(
    @Param('id') id: string,
    @Body() dto: IngestBatchDto,
    @Req() req: Request & { trip: Trip },
  ) {
    if (req.trip.id !== id) {
      throw new ForbiddenException('El tripToken no corresponde a este viaje');
    }
    return this.locations.addBatch(req.trip, dto);
  }
}
