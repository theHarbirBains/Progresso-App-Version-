import {
  applyDecorators,
  CanActivate,
  ExecutionContext,
  HttpException,
  HttpStatus,
  Injectable,
  Logger,
  SetMetadata,
  UseGuards,
} from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import type { AuthenticatedRequest } from '../auth/types/authenticated-request';

const MINUTE_MS = 60_000;
const HOUR_MS = 60 * MINUTE_MS;
const DAY_MS = 24 * HOUR_MS;

export type AiUsageBucket = 'interpret' | 'resolveComponent';

interface UsageWindow {
  windowMs: number;
  max: number;
}

// Well above a heavy day of meal logging, but caps what any one account can spend on Anthropic.
export const AI_USAGE_LIMITS: Record<AiUsageBucket, readonly UsageWindow[]> = {
  interpret: [
    { windowMs: HOUR_MS, max: 20 },
    { windowMs: DAY_MS, max: 60 },
  ],
  resolveComponent: [
    { windowMs: HOUR_MS, max: 60 },
    { windowMs: DAY_MS, max: 200 },
  ],
};

const LONGEST_WINDOW_MS = DAY_MS;
const SWEEP_EVERY_N_CHECKS = 1000;

export type UsageDecision = { allowed: true } | { allowed: false; retryAfterMs: number };

/**
 * Per-user sliding-window counts, kept in memory. The API runs as a single instance, and a restart
 * only resets the counts, which loosens the cap briefly rather than blocking anyone.
 */
@Injectable()
export class AiUsageLimiter {
  private readonly requests = new Map<string, number[]>();
  private checksSinceSweep = 0;

  consume(userId: string, bucket: AiUsageBucket, now: number = Date.now()): UsageDecision {
    this.sweepOccasionally(now);

    const key = `${bucket}:${userId}`;
    const timestamps = (this.requests.get(key) ?? []).filter(
      (time) => time > now - LONGEST_WINDOW_MS,
    );

    let retryAfterMs = 0;
    for (const { windowMs, max } of AI_USAGE_LIMITS[bucket]) {
      const inWindow = timestamps.filter((time) => time > now - windowMs);
      const oldest = inWindow[0];
      if (oldest !== undefined && inWindow.length >= max) {
        retryAfterMs = Math.max(retryAfterMs, oldest + windowMs - now);
      }
    }

    if (retryAfterMs > 0) {
      this.requests.set(key, timestamps);
      return { allowed: false, retryAfterMs };
    }

    timestamps.push(now);
    this.requests.set(key, timestamps);
    return { allowed: true };
  }

  private sweepOccasionally(now: number): void {
    this.checksSinceSweep += 1;
    if (this.checksSinceSweep < SWEEP_EVERY_N_CHECKS) return;
    this.checksSinceSweep = 0;
    for (const [key, timestamps] of this.requests) {
      const newest = timestamps[timestamps.length - 1];
      if (newest === undefined || newest <= now - LONGEST_WINDOW_MS) this.requests.delete(key);
    }
  }
}

export function formatWait(retryAfterMs: number): string {
  if (retryAfterMs < HOUR_MS) {
    const minutes = Math.max(1, Math.ceil(retryAfterMs / MINUTE_MS));
    return minutes === 1 ? '1 minute' : `${minutes} minutes`;
  }
  const hours = Math.ceil(retryAfterMs / HOUR_MS);
  return hours === 1 ? '1 hour' : `${hours} hours`;
}

export const AI_USAGE_BUCKET_KEY = 'aiUsageBucket';

@Injectable()
export class AiUsageLimitGuard implements CanActivate {
  private readonly logger = new Logger(AiUsageLimitGuard.name);

  constructor(
    private readonly reflector: Reflector,
    private readonly limiter: AiUsageLimiter,
  ) {}

  canActivate(context: ExecutionContext): boolean {
    const bucket = this.reflector.get<AiUsageBucket>(AI_USAGE_BUCKET_KEY, context.getHandler());
    // SupabaseAuthGuard runs first as a global guard, so every request reaching here has a user.
    const userId = context.switchToHttp().getRequest<AuthenticatedRequest>().user!.id;

    const decision = this.limiter.consume(userId, bucket);
    if (decision.allowed) return true;

    this.logger.warn(`AI usage limit reached: user ${userId}, ${bucket}`);
    throw new HttpException(
      {
        statusCode: HttpStatus.TOO_MANY_REQUESTS,
        error: 'Too Many Requests',
        message: `You've reached the AI food search limit. Try again in ${formatWait(decision.retryAfterMs)}.`,
      },
      HttpStatus.TOO_MANY_REQUESTS,
    );
  }
}

/** Applies the per-user AI usage limit for one bucket to a route. */
export function AiUsage(bucket: AiUsageBucket) {
  return applyDecorators(SetMetadata(AI_USAGE_BUCKET_KEY, bucket), UseGuards(AiUsageLimitGuard));
}
