import { Controller, Get } from '@nestjs/common';
import type { AuthenticatedUser } from '../auth/types/authenticated-request';
import { CurrentUser } from '../common/decorators/current-user.decorator';
import { Roles } from '../common/decorators/roles.decorator';
import { Role } from '../common/enums/role.enum';
import { UsersService } from './users.service';

@Controller('users')
export class UsersController {
  constructor(private readonly usersService: UsersService) {}

  // Any authenticated role is allowed through; the point of listing all
  // three here is to make RolesGuard run and resolve the real role from
  // admin_users, rather than trusting SupabaseAuthGuard's cheap default.
  @Roles(Role.USER, Role.SUPPORT_ADMIN, Role.FULL_ADMIN)
  @Get('me')
  async me(@CurrentUser() user: AuthenticatedUser) {
    const profile = await this.usersService.getProfile(user.id);
    return {
      id: user.id,
      email: user.email,
      role: user.role,
      weightUnit: profile.weightUnit,
      displayName: profile.displayName,
    };
  }
}
