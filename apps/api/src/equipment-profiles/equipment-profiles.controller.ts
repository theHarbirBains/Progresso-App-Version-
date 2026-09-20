import { Body, Controller, Post } from '@nestjs/common';
import type { AuthenticatedUser } from '../auth/types/authenticated-request';
import { CurrentUser } from '../common/decorators/current-user.decorator';
import { Roles } from '../common/decorators/roles.decorator';
import { Role } from '../common/enums/role.enum';
import { CreateEquipmentProfileDto } from './dto/create-equipment-profile.dto';
import { EquipmentProfilesService } from './equipment-profiles.service';

// Reads go direct to Supabase from the mobile app, protected by RLS -- only
// the write goes through the backend, matching the exercises module's own
// hybrid pattern (see CLAUDE.md).
@Controller('equipment-profiles')
export class EquipmentProfilesController {
  constructor(private readonly equipmentProfilesService: EquipmentProfilesService) {}

  @Roles(Role.USER, Role.SUPPORT_ADMIN, Role.FULL_ADMIN)
  @Post()
  async create(@CurrentUser() user: AuthenticatedUser, @Body() dto: CreateEquipmentProfileDto) {
    return this.equipmentProfilesService.create(user.id, dto);
  }
}
