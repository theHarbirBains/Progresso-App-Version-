import { BadRequestException, Body, Controller, Get, Patch, Query } from '@nestjs/common';
import type { AuthenticatedUser } from '../auth/types/authenticated-request';
import { CurrentUser } from '../common/decorators/current-user.decorator';
import { Roles } from '../common/decorators/roles.decorator';
import { Role } from '../common/enums/role.enum';
import { UpdateUserDto } from './dto/update-user.dto';
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
      ...profile,
    };
  }

  // The target is always @CurrentUser()'s id, never anything from the
  // request body — a client cannot update another user's profile by
  // supplying a different id/userId field, because nothing here ever
  // reads one.
  @Roles(Role.USER, Role.SUPPORT_ADMIN, Role.FULL_ADMIN)
  @Patch('me')
  async updateMe(@CurrentUser() user: AuthenticatedUser, @Body() dto: UpdateUserDto) {
    const profile = await this.usersService.updateProfile(user.id, dto);
    return {
      id: user.id,
      email: user.email,
      role: user.role,
      ...profile,
    };
  }

  @Roles(Role.USER, Role.SUPPORT_ADMIN, Role.FULL_ADMIN)
  @Get('username-availability')
  async usernameAvailability(
    @CurrentUser() user: AuthenticatedUser,
    @Query('username') username?: string,
  ) {
    if (!username) {
      throw new BadRequestException('username query parameter is required');
    }
    const available = await this.usersService.isUsernameAvailable(username, user.id);
    return { available };
  }
}
