import {
  IsISO8601,
  IsLatitude,
  IsLongitude,
  IsNumber,
  Max,
  Min,
} from 'class-validator';
import { Type } from 'class-transformer';

/**
 * Un punto de la bala trazadora (Slice 0). La ingesta por lotes GZIP + idempotencia
 * por batchId llega en el Bloque 3.4; aquí se acepta un único punto.
 */
export class CreateLocationDto {
  @Type(() => Number)
  @IsLatitude()
  lat!: number;

  @Type(() => Number)
  @IsLongitude()
  lng!: number;

  @Type(() => Number)
  @IsNumber()
  @Min(0)
  @Max(10000)
  accuracyMeters!: number;

  @IsISO8601()
  recordedAt!: string;
}
