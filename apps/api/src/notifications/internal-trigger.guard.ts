import {
  CanActivate,
  ExecutionContext,
  Injectable,
  InternalServerErrorException,
  UnauthorizedException,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import type { FastifyRequest } from 'fastify';
import type { EnvironmentVariables } from '../config/env.validation';

/**
 * Guards the daily-notifications trigger route. Applied via @UseGuards --
 * the route itself is also marked @Public() to skip SupabaseAuthGuard,
 * since whatever calls it (an external scheduled trigger -- this app has no
 * in-process cron; see notifications.controller.ts's own comment) has no
 * Supabase JWT. A plain shared-secret header, not a signed payload -- the
 * caller triggers a job, it doesn't send data to trust the contents of, so
 * RevenueCatWebhookGuard's HMAC verification would be more than this needs.
 */
@Injectable()
export class InternalTriggerGuard implements CanActivate {
  constructor(private readonly configService: ConfigService<EnvironmentVariables, true>) {}

  canActivate(context: ExecutionContext): boolean {
    const secret = this.configService.get('INTERNAL_NOTIFICATIONS_SECRET', { infer: true });
    if (!secret) {
      throw new InternalServerErrorException('The notifications trigger is not configured');
    }

    const request = context.switchToHttp().getRequest<FastifyRequest>();
    const provided = request.headers['x-internal-secret'];

    if (provided !== secret) {
      throw new UnauthorizedException('Invalid or missing trigger secret');
    }

    return true;
  }
}
