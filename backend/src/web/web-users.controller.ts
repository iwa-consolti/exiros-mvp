import {
  Body,
  Controller,
  Get,
  Param,
  Patch,
  Post,
  UseGuards,
} from '@nestjs/common';
import { CurrentUser, JwtAuthGuard } from '../common/jwt-auth.guard';
import { AdminRolesGuard } from '../common/roles.guard';
import type { AuthUser } from '../auth/jwt-payload';
import { UsersService } from './users.service';
import { CreateUserDto, UpdateUserDto } from './dto/user.dto';

/** Gestión de usuarios (W5 / Fase 6.2). Solo Admin+ (JWT + AdminRolesGuard). */
@Controller('web/users')
@UseGuards(JwtAuthGuard, AdminRolesGuard)
export class WebUsersController {
  constructor(private readonly users: UsersService) {}

  @Get()
  list() {
    return this.users.findAll();
  }

  @Post()
  create(@Body() dto: CreateUserDto, @CurrentUser() user: AuthUser) {
    return this.users.create(dto, user.sub);
  }

  @Patch(':id')
  update(@Param('id') id: string, @Body() dto: UpdateUserDto) {
    return this.users.update(id, dto);
  }

  /** Dar de baja (soft delete). El Super admin no puede darse de baja. */
  @Patch(':id/deactivate')
  deactivate(@Param('id') id: string) {
    return this.users.setActive(id, false);
  }

  @Patch(':id/restore')
  restore(@Param('id') id: string) {
    return this.users.setActive(id, true);
  }
}
