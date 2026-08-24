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
import { verifyRevenueCatSignature } from './revenuecat-signature.util';

type RawBodyRequest = FastifyRequest & { rawBody?: Buffer };

/**
 * Verifies RevenueCat's HMAC webhook signature. Applied only to the
 * webhook route via @UseGuards — the route itself is also marked @Public()
 * to skip SupabaseAuthGuard, since RevenueCat obviously has no Supabase
 * JWT; this guard is the route's actual authentication.
 */
@Injectable()
export class RevenueCatWebhookGuard implements CanActivate {
  constructor(private readonly configService: ConfigService<EnvironmentVariables, true>) {}

  canActivate(context: ExecutionContext): boolean {
    const secret = this.configService.get('REVENUECAT_WEBHOOK_SECRET', { infer: true });
    if (!secret) {
      throw new InternalServerErrorException('RevenueCat webhook is not configured');
    }

    const request = context.switchToHttp().getRequest<RawBodyRequest>();
    const signatureHeader = request.headers['x-revenuecat-webhook-signature'];
    const rawBody = request.rawBody;

    if (!rawBody) {
      throw new UnauthorizedException('Missing request body');
    }

    const result = verifyRevenueCatSignature(
      rawBody,
      typeof signatureHeader === 'string' ? signatureHeader : undefined,
      secret,
    );

    if (!result.valid) {
      throw new UnauthorizedException(`Invalid webhook signature: ${result.reason}`);
    }

    return true;
  }
}
