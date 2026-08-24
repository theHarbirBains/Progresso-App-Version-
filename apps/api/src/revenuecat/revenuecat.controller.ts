import { Controller, HttpCode, HttpStatus, Post, Req, UseGuards } from '@nestjs/common';
import type { FastifyRequest } from 'fastify';
import { Public } from '../common/decorators/public.decorator';
import { RevenueCatEventsService } from './revenuecat-events.service';
import { RevenueCatWebhookGuard } from './revenuecat-webhook.guard';
import type { RevenueCatWebhookPayload } from './revenuecat.types';

@Controller('webhooks/revenuecat')
export class RevenueCatController {
  constructor(private readonly eventsService: RevenueCatEventsService) {}

  // Public: RevenueCat has no Supabase JWT. RevenueCatWebhookGuard is this
  // route's actual authentication (HMAC signature, not a bearer token).
  @Public()
  @UseGuards(RevenueCatWebhookGuard)
  @Post()
  @HttpCode(HttpStatus.OK)
  async receiveWebhook(@Req() request: FastifyRequest): Promise<{ received: true }> {
    const payload = request.body as RevenueCatWebhookPayload;
    await this.eventsService.processWebhookEvent(payload);
    // Always 200 once the event is durably recorded — RevenueCat treats
    // any non-200 as a delivery failure and will retry for hours.
    return { received: true };
  }
}
