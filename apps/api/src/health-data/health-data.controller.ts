import { Body, Controller, Delete, HttpCode, HttpStatus, Param, Post, Query } from '@nestjs/common';
import type { AuthenticatedUser } from '../auth/types/authenticated-request';
import { CurrentUser } from '../common/decorators/current-user.decorator';
import { Roles } from '../common/decorators/roles.decorator';
import { Role } from '../common/enums/role.enum';
import {
  AppleHealthImportDto,
  DeleteHealthDataQueryDto,
  ManualSleepDto,
} from './dto/health-import.dto';
import { HealthDataService, type ImportResult } from './health-data.service';

// Health data's writes, always the signed-in person's own. Reading is straight from Supabase under
// RLS (health_daily); there's no route for anyone else's -- a trainer's, a follower's -- at all.
// ("health" is the server's uptime check, so this is "health-data".)
@Controller('health-data')
export class HealthDataController {
  constructor(private readonly healthData: HealthDataService) {}

  @Roles(Role.USER, Role.SUPPORT_ADMIN, Role.FULL_ADMIN)
  @Post('apple/import')
  @HttpCode(HttpStatus.OK)
  importAppleHealth(
    @CurrentUser() user: AuthenticatedUser,
    @Body() dto: AppleHealthImportDto,
  ): Promise<ImportResult> {
    return this.healthData.importAppleHealth(user.id, dto);
  }

  @Roles(Role.USER, Role.SUPPORT_ADMIN, Role.FULL_ADMIN)
  @Post('manual/sleep')
  logManualSleep(
    @CurrentUser() user: AuthenticatedUser,
    @Body() dto: ManualSleepDto,
  ): Promise<{ sourceRef: string; day: string }> {
    return this.healthData.logManualSleep(user.id, dto);
  }

  @Roles(Role.USER, Role.SUPPORT_ADMIN, Role.FULL_ADMIN)
  @Delete('manual/sleep/:sourceRef')
  @HttpCode(HttpStatus.NO_CONTENT)
  async deleteManualSleep(
    @CurrentUser() user: AuthenticatedUser,
    @Param('sourceRef') sourceRef: string,
  ): Promise<void> {
    await this.healthData.deleteManualSleep(user.id, sourceRef);
  }

  /** "Delete my health data" -- one source's (?source=oura), or all of it. */
  @Roles(Role.USER, Role.SUPPORT_ADMIN, Role.FULL_ADMIN)
  @Delete()
  deleteHealthData(
    @CurrentUser() user: AuthenticatedUser,
    @Query() query: DeleteHealthDataQueryDto,
  ): Promise<{ deleted: number }> {
    return this.healthData.deleteHealthData(user.id, query);
  }
}
