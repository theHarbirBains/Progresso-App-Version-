import { Body, Controller, Get, Param, ParseUUIDPipe, Patch, Post } from '@nestjs/common';
import type { AuthenticatedUser } from '../auth/types/authenticated-request';
import { CurrentUser } from '../common/decorators/current-user.decorator';
import { Roles } from '../common/decorators/roles.decorator';
import { Role } from '../common/enums/role.enum';
import { CreateGroupDto, RespondGroupInviteDto, SetMyWorkoutDayDto } from './dto/groups.dto';
import { GroupsService } from './groups.service';

// Group workouts (see apps/api/src/groups). Every write is checked here against
// membership first; the database policies enforce the same rules for direct reads.
@Controller('groups')
export class GroupsController {
  constructor(private readonly groupsService: GroupsService) {}

  @Roles(Role.USER, Role.SUPPORT_ADMIN, Role.FULL_ADMIN)
  @Post()
  async create(@CurrentUser() user: AuthenticatedUser, @Body() dto: CreateGroupDto) {
    return this.groupsService.create(user.id, dto);
  }

  @Roles(Role.USER, Role.SUPPORT_ADMIN, Role.FULL_ADMIN)
  @Get()
  async listMine(@CurrentUser() user: AuthenticatedUser) {
    return this.groupsService.listMine(user.id);
  }

  // Declared before ':id' so 'invites' is never read as a group id.
  @Roles(Role.USER, Role.SUPPORT_ADMIN, Role.FULL_ADMIN)
  @Get('invites')
  async invites(@CurrentUser() user: AuthenticatedUser) {
    return this.groupsService.listInvites(user.id);
  }

  @Roles(Role.USER, Role.SUPPORT_ADMIN, Role.FULL_ADMIN)
  @Get(':id')
  async detail(@CurrentUser() user: AuthenticatedUser, @Param('id', ParseUUIDPipe) id: string) {
    return this.groupsService.getDetail(user.id, id);
  }

  @Roles(Role.USER, Role.SUPPORT_ADMIN, Role.FULL_ADMIN)
  @Patch(':id/invite')
  async respond(
    @CurrentUser() user: AuthenticatedUser,
    @Param('id', ParseUUIDPipe) id: string,
    @Body() dto: RespondGroupInviteDto,
  ) {
    await this.groupsService.respondToInvite(user.id, id, dto.action);
    return { ok: true };
  }

  // Which day of your split your group workout is. Any day of your own split, or none.
  @Roles(Role.USER, Role.SUPPORT_ADMIN, Role.FULL_ADMIN)
  @Patch(':id/my-workout')
  async setMyWorkoutDay(
    @CurrentUser() user: AuthenticatedUser,
    @Param('id', ParseUUIDPipe) id: string,
    @Body() dto: SetMyWorkoutDayDto,
  ) {
    await this.groupsService.setMyWorkoutDay(user.id, id, dto.splitDayId ?? null);
    return { ok: true };
  }

  @Roles(Role.USER, Role.SUPPORT_ADMIN, Role.FULL_ADMIN)
  @Post(':id/finish')
  async finish(@CurrentUser() user: AuthenticatedUser, @Param('id', ParseUUIDPipe) id: string) {
    await this.groupsService.finish(user.id, id);
    return { ok: true };
  }

  @Roles(Role.USER, Role.SUPPORT_ADMIN, Role.FULL_ADMIN)
  @Post(':id/leave')
  async leave(@CurrentUser() user: AuthenticatedUser, @Param('id', ParseUUIDPipe) id: string) {
    await this.groupsService.leave(user.id, id);
    return { ok: true };
  }
}
