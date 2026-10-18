import { Body, Controller, Delete, Get, Param, ParseUUIDPipe, Post } from '@nestjs/common';
import type { AuthenticatedUser } from '../auth/types/authenticated-request';
import { CurrentUser } from '../common/decorators/current-user.decorator';
import { Roles } from '../common/decorators/roles.decorator';
import { Role } from '../common/enums/role.enum';
import { CreateReportDto } from './dto/create-report.dto';
import { SafetyService } from './safety.service';

@Controller('blocks')
export class BlocksController {
  constructor(private readonly safetyService: SafetyService) {}

  @Roles(Role.USER, Role.SUPPORT_ADMIN, Role.FULL_ADMIN)
  @Get()
  async list(@CurrentUser() user: AuthenticatedUser) {
    return this.safetyService.listBlocked(user.id);
  }

  @Roles(Role.USER, Role.SUPPORT_ADMIN, Role.FULL_ADMIN)
  @Post(':targetUserId')
  async block(
    @CurrentUser() user: AuthenticatedUser,
    @Param('targetUserId', ParseUUIDPipe) targetUserId: string,
  ) {
    await this.safetyService.block(user.id, targetUserId);
    return { success: true };
  }

  @Roles(Role.USER, Role.SUPPORT_ADMIN, Role.FULL_ADMIN)
  @Delete(':targetUserId')
  async unblock(
    @CurrentUser() user: AuthenticatedUser,
    @Param('targetUserId', ParseUUIDPipe) targetUserId: string,
  ) {
    await this.safetyService.unblock(user.id, targetUserId);
    return { success: true };
  }
}

@Controller('reports')
export class ReportsController {
  constructor(private readonly safetyService: SafetyService) {}

  @Roles(Role.USER, Role.SUPPORT_ADMIN, Role.FULL_ADMIN)
  @Post()
  async report(@CurrentUser() user: AuthenticatedUser, @Body() dto: CreateReportDto) {
    return this.safetyService.report(user.id, dto);
  }
}
