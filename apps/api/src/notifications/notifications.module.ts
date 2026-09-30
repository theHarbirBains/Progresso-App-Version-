import { Module } from '@nestjs/common';
import { InternalTriggerGuard } from './internal-trigger.guard';
import { NotificationsController } from './notifications.controller';
import { NotificationsService } from './notifications.service';
import { ExpoPushProvider } from './providers/expo-push.provider';

@Module({
  controllers: [NotificationsController],
  providers: [NotificationsService, ExpoPushProvider, InternalTriggerGuard],
})
export class NotificationsModule {}
