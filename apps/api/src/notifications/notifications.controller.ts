import {
  Body,
  Controller,
  Delete,
  Get,
  HttpCode,
  HttpStatus,
  Post,
  Query,
  UseGuards,
} from '@nestjs/common';
import type { AuthenticatedUser } from '../auth/types/authenticated-request';
import { CurrentUser } from '../common/decorators/current-user.decorator';
import { Public } from '../common/decorators/public.decorator';
import { Roles } from '../common/decorators/roles.decorator';
import { Role } from '../common/enums/role.enum';
import { MarkNotificationsReadDto } from './dto/mark-notifications-read.dto';
import { RegisterPushTokenDto } from './dto/register-push-token.dto';
import { UnregisterPushTokenDto } from './dto/unregister-push-token.dto';
import { InternalTriggerGuard } from './internal-trigger.guard';
import { NotificationCentreService, type NotificationItem } from './notification-centre.service';
import { NotificationsService } from './notifications.service';

@Controller('notifications')
export class NotificationsController {
  constructor(
    private readonly notificationsService: NotificationsService,
    private readonly centre: NotificationCentreService,
  ) {}

  // The in-app Notifications screen: their own notifications, newest first, with how many are
  // unread (the Feed bell and the app icon's badge).
  @Roles(Role.USER, Role.SUPPORT_ADMIN, Role.FULL_ADMIN)
  @Get()
  async list(
    @CurrentUser() user: AuthenticatedUser,
    @Query('limit') limit?: string,
  ): Promise<{ notifications: NotificationItem[]; unread: number }> {
    const parsed = Number.parseInt(limit ?? '', 10);
    const [notifications, unread] = await Promise.all([
      this.centre.list(user.id, Number.isFinite(parsed) ? parsed : undefined),
      this.centre.unreadCount(user.id),
    ]);
    return { notifications, unread };
  }

  @Roles(Role.USER, Role.SUPPORT_ADMIN, Role.FULL_ADMIN)
  @Get('unread-count')
  async unreadCount(@CurrentUser() user: AuthenticatedUser): Promise<{ unread: number }> {
    return { unread: await this.centre.unreadCount(user.id) };
  }

  // Marks their own notifications read: the ids given, or every one with none given.
  @Roles(Role.USER, Role.SUPPORT_ADMIN, Role.FULL_ADMIN)
  @Post('read')
  @HttpCode(HttpStatus.OK)
  async markRead(
    @CurrentUser() user: AuthenticatedUser,
    @Body() dto: MarkNotificationsReadDto,
  ): Promise<{ unread: number }> {
    return { unread: await this.centre.markRead(user.id, dto.ids) };
  }

  @Roles(Role.USER, Role.SUPPORT_ADMIN, Role.FULL_ADMIN)
  @Post('push-token')
  async registerPushToken(
    @CurrentUser() user: AuthenticatedUser,
    @Body() dto: RegisterPushTokenDto,
  ): Promise<{ registered: true }> {
    await this.notificationsService.registerToken(user.id, dto.expoPushToken, dto.platform);
    return { registered: true };
  }

  // Sign-out / disabling push notifications in Settings removes the token
  // rather than leaving a stale one around that the daily job would keep
  // trying (and failing) to deliver to.
  @Roles(Role.USER, Role.SUPPORT_ADMIN, Role.FULL_ADMIN)
  @Delete('push-token')
  async unregisterPushToken(
    @CurrentUser() user: AuthenticatedUser,
    @Body() dto: UnregisterPushTokenDto,
  ): Promise<{ removed: true }> {
    await this.notificationsService.unregisterToken(user.id, dto.expoPushToken);
    return { removed: true };
  }

  // The daily reminders job's own trigger. This backend has no in-process
  // scheduler (see InternalTriggerGuard's comment) -- something external
  // (a free scheduled-HTTP-request service, or a scheduled GitHub Actions
  // workflow) must be configured to POST here once a day with the
  // X-Internal-Secret header set to INTERNAL_NOTIFICATIONS_SECRET. That
  // external call also keeps a free-tier host's web service from being
  // asleep when it's time to send. Public + its own guard, same pattern as
  // the RevenueCat webhook: whatever calls this has no Supabase JWT.
  @Public()
  @UseGuards(InternalTriggerGuard)
  @Post('send-daily')
  @HttpCode(HttpStatus.OK)
  async sendDaily() {
    return this.notificationsService.sendDailyNotifications();
  }
}
