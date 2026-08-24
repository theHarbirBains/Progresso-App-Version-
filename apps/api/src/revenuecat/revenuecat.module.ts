import { Module } from '@nestjs/common';
import { RevenueCatEventsService } from './revenuecat-events.service';
import { RevenueCatWebhookGuard } from './revenuecat-webhook.guard';
import { RevenueCatController } from './revenuecat.controller';

@Module({
  controllers: [RevenueCatController],
  providers: [RevenueCatEventsService, RevenueCatWebhookGuard],
})
export class RevenueCatModule {}
