import {
  IsNotEmpty,
  IsOptional,
  IsString,
  IsUUID,
  MaxLength,
} from 'class-validator';

/** Cuerpo de POST /api/mobile/trips (7 campos + deviceId + clientRequestId). */
export class CreateTripDto {
  @IsString()
  @IsNotEmpty()
  @MaxLength(60)
  providerNumber!: string;

  @IsString()
  @IsNotEmpty()
  @MaxLength(120)
  providerName!: string;

  @IsString()
  @IsNotEmpty()
  @MaxLength(60)
  folio!: string;

  @IsString()
  @IsNotEmpty()
  @MaxLength(15)
  frontPlate!: string;

  @IsOptional()
  @IsString()
  @MaxLength(15)
  rearPlate?: string;

  @IsUUID()
  destinationId!: string;

  @IsString()
  @IsNotEmpty()
  @MaxLength(128)
  deviceId!: string;

  @IsString()
  @IsNotEmpty()
  @MaxLength(128)
  clientRequestId!: string;
}
