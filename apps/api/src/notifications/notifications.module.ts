import { Module } from '@nestjs/common';
import { InternalTriggerGuard } from './internal-trigger.guard';
import { NotificationsController } from './notifications.controller';
import { NotificationsService } from './notifications.service';
import { ExpoPushProvider } from './providers/expo-push.provider';
import { SocialPushService } from './social-push.service';

@Module({
  controllers: [NotificationsController],
  providers: [NotificationsService, ExpoPushProvider, InternalTriggerGuard, SocialPushService],
  exports: [SocialPushService],
})
export class NotificationsModule {}
