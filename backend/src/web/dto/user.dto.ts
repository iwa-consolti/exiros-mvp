import {
  IsEmail,
  IsEnum,
  IsString,
  MaxLength,
  MinLength,
} from 'class-validator';
import { Role } from '@prisma/client';

/** Alta de usuario (W5). Contraseña inicial mínimo 8 caracteres (doc UX). */
export class CreateUserDto {
  @IsString()
  @MinLength(1)
  @MaxLength(120)
  name!: string;

  @IsEmail()
  @MaxLength(255)
  email!: string;

  @IsEnum(Role)
  role!: Role;

  @IsString()
  @MinLength(8)
  @MaxLength(200)
  password!: string;
}

/** Edición de usuario (nombre + rol; el correo no se cambia en el MVP). */
export class UpdateUserDto {
  @IsString()
  @MinLength(1)
  @MaxLength(120)
  name!: string;

  @IsEnum(Role)
  role!: Role;
}
