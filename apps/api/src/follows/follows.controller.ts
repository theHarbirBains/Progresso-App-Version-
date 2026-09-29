import { Body, Controller, Delete, Get, Param, Patch, Post, Query } from '@nestjs/common';
import type { AuthenticatedUser } from '../auth/types/authenticated-request';
import { CurrentUser } from '../common/decorators/current-user.decorator';
import { Roles } from '../common/decorators/roles.decorator';
import { Role } from '../common/enums/role.enum';
import { RespondFollowRequestDto } from './dto/respond-follow-request.dto';
import { SearchUsersDto } from './dto/search-users.dto';
import { FollowsService } from './follows.service';

@Controller('follows')
export class FollowsController {
  constructor(private readonly followsService: FollowsService) {}

  @Roles(Role.USER, Role.SUPPORT_ADMIN, Role.FULL_ADMIN)
  @Get('search')
  async search(@CurrentUser() user: AuthenticatedUser, @Query() dto: SearchUsersDto) {
    return this.followsService.search(user.id, dto.query);
  }

  @Roles(Role.USER, Role.SUPPORT_ADMIN, Role.FULL_ADMIN)
  @Get('requests')
  async requests(@CurrentUser() user: AuthenticatedUser) {
    return this.followsService.listPendingRequests(user.id);
  }

  @Roles(Role.USER, Role.SUPPORT_ADMIN, Role.FULL_ADMIN)
  @Get('following')
  async following(@CurrentUser() user: AuthenticatedUser) {
    return this.followsService.listFollowing(user.id);
  }

  @Roles(Role.USER, Role.SUPPORT_ADMIN, Role.FULL_ADMIN)
  @Post(':targetUserId')
  async sendRequest(
    @CurrentUser() user: AuthenticatedUser,
    @Param('targetUserId') targetUserId: string,
  ) {
    return this.followsService.sendRequest(user.id, targetUserId);
  }

  @Roles(Role.USER, Role.SUPPORT_ADMIN, Role.FULL_ADMIN)
  @Patch('requests/:followId')
  async respond(
    @CurrentUser() user: AuthenticatedUser,
    @Param('followId') followId: string,
    @Body() dto: RespondFollowRequestDto,
  ) {
    await this.followsService.respondToRequest(user.id, followId, dto.action);
    return { success: true };
  }

  @Roles(Role.USER, Role.SUPPORT_ADMIN, Role.FULL_ADMIN)
  @Delete(':targetUserId')
  async unfollow(
    @CurrentUser() user: AuthenticatedUser,
    @Param('targetUserId') targetUserId: string,
  ) {
    await this.followsService.unfollow(user.id, targetUserId);
    return { success: true };
  }
}
