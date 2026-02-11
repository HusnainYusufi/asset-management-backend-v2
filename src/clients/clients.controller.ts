import { Controller, Delete, Get, Param, UseGuards } from '@nestjs/common';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { RolesGuard } from '../auth/guards/roles.guard';
import { Roles } from '../auth/decorators/roles.decorator';
import { CurrentUser } from '../auth/decorators/current-user.decorator';
import type { AuthenticatedUser } from '../auth/interfaces/authenticated-user.interface';
import { ClientsService } from './clients.service';

@Controller('clients')
@UseGuards(JwtAuthGuard, RolesGuard)
export class ClientsController {
  constructor(private readonly clientsService: ClientsService) {}

  @Get()
  @Roles('SUPERADMIN')
  list() {
    return this.clientsService.findAll();
  }

  @Delete(':id')
  @Roles('SUPERADMIN')
  remove(@Param('id') id: string, @CurrentUser() user: AuthenticatedUser) {
    return this.clientsService.deleteClient(id, user.tenantId);
  }
}
