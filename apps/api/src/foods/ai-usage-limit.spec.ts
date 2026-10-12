import { ExecutionContext, HttpException, HttpStatus } from '@nestjs/common';
import { GUARDS_METADATA } from '@nestjs/common/constants';
import { Reflector } from '@nestjs/core';
import type { AuthenticatedRequest } from '../auth/types/authenticated-request';
import { Role } from '../common/enums/role.enum';
import {
  AI_USAGE_BUCKET_KEY,
  AiUsageLimiter,
  AiUsageLimitGuard,
  formatWait,
  type UsageDecision,
} from './ai-usage-limit';
import { FoodsController } from './foods.controller';

const MINUTE = 60_000;
const HOUR = 60 * MINUTE;
const START = Date.UTC(2026, 9, 11, 8, 0, 0);

function consumeTimes(
  limiter: AiUsageLimiter,
  count: number,
  userId: string,
  bucket: 'interpret' | 'resolveComponent',
  at: number,
): UsageDecision[] {
  return Array.from({ length: count }, () => limiter.consume(userId, bucket, at));
}

describe('AiUsageLimiter', () => {
  let limiter: AiUsageLimiter;

  beforeEach(() => {
    limiter = new AiUsageLimiter();
  });

  it('allows 20 interprets in an hour, then refuses the 21st until the oldest leaves the window', () => {
    const decisions = consumeTimes(limiter, 20, 'user-1', 'interpret', START);
    expect(decisions.every((d) => d.allowed)).toBe(true);

    const refused = limiter.consume('user-1', 'interpret', START + 10 * MINUTE);
    expect(refused).toEqual({ allowed: false, retryAfterMs: 50 * MINUTE });
  });

  it('allows again once the hour has passed', () => {
    consumeTimes(limiter, 20, 'user-1', 'interpret', START);

    expect(limiter.consume('user-1', 'interpret', START + HOUR + 1).allowed).toBe(true);
  });

  it('caps interprets at 60 a day even when each hour stays under 20', () => {
    for (let hour = 0; hour < 3; hour += 1) {
      const decisions = consumeTimes(limiter, 20, 'user-1', 'interpret', START + hour * 2 * HOUR);
      expect(decisions.every((d) => d.allowed)).toBe(true);
    }

    const refused = limiter.consume('user-1', 'interpret', START + 10 * HOUR);
    expect(refused).toEqual({ allowed: false, retryAfterMs: 14 * HOUR });
  });

  it('keeps separate counts per user and per route', () => {
    consumeTimes(limiter, 20, 'user-1', 'interpret', START);

    expect(limiter.consume('user-2', 'interpret', START).allowed).toBe(true);
    expect(limiter.consume('user-1', 'resolveComponent', START).allowed).toBe(true);
    expect(limiter.consume('user-1', 'interpret', START).allowed).toBe(false);
  });

  it('allows 60 component lookups an hour', () => {
    const decisions = consumeTimes(limiter, 60, 'user-1', 'resolveComponent', START);
    expect(decisions.every((d) => d.allowed)).toBe(true);
    expect(limiter.consume('user-1', 'resolveComponent', START).allowed).toBe(false);
  });

  it('does not count refused requests against the user', () => {
    consumeTimes(limiter, 20, 'user-1', 'interpret', START);
    const refused = consumeTimes(limiter, 20, 'user-1', 'interpret', START + 30 * MINUTE);
    expect(refused.some((d) => d.allowed)).toBe(false);

    // Had those 20 refusals been recorded, this hour's window would already be full.
    expect(limiter.consume('user-1', 'interpret', START + HOUR + 1).allowed).toBe(true);
  });
});

describe('formatWait', () => {
  it.each([
    [10_000, '1 minute'],
    [90_000, '2 minutes'],
    [59 * MINUTE, '59 minutes'],
    [HOUR, '1 hour'],
    [HOUR + MINUTE, '2 hours'],
    [14 * HOUR, '14 hours'],
  ])('formats %d ms as %s', (ms, expected) => {
    expect(formatWait(ms)).toBe(expected);
  });
});

describe('AiUsageLimitGuard', () => {
  function createContext(userId: string): ExecutionContext {
    const request = {
      headers: {},
      user: { id: userId, role: Role.USER },
    } as unknown as AuthenticatedRequest;
    return {
      switchToHttp: () => ({ getRequest: () => request }),
      getHandler: () => FoodsController.prototype.interpret,
      getClass: () => FoodsController,
    } as unknown as ExecutionContext;
  }

  it("lets the request through when the user is under the route's limit", () => {
    const limiter = { consume: jest.fn().mockReturnValue({ allowed: true }) };
    const guard = new AiUsageLimitGuard(new Reflector(), limiter as unknown as AiUsageLimiter);

    expect(guard.canActivate(createContext('user-1'))).toBe(true);
    expect(limiter.consume).toHaveBeenCalledWith('user-1', 'interpret');
  });

  it('refuses with 429 and says when to try again', () => {
    const limiter = {
      consume: jest.fn().mockReturnValue({ allowed: false, retryAfterMs: 25 * MINUTE }),
    };
    const guard = new AiUsageLimitGuard(new Reflector(), limiter as unknown as AiUsageLimiter);

    let thrown: unknown;
    try {
      guard.canActivate(createContext('user-1'));
    } catch (error) {
      thrown = error;
    }

    expect(thrown).toBeInstanceOf(HttpException);
    const exception = thrown as HttpException;
    expect(exception.getStatus()).toBe(HttpStatus.TOO_MANY_REQUESTS);
    expect(exception.getResponse()).toMatchObject({
      message: "You've reached the AI food search limit. Try again in 25 minutes.",
    });
  });
});

describe('FoodsController AI routes', () => {
  it.each([
    ['interpret', FoodsController.prototype.interpret, 'interpret'],
    ['resolve-component', FoodsController.prototype.resolveComponent, 'resolveComponent'],
  ])('applies the usage limit to %s', (_route, handler, bucket) => {
    expect(Reflect.getMetadata(GUARDS_METADATA, handler)).toContain(AiUsageLimitGuard);
    expect(new Reflector().get(AI_USAGE_BUCKET_KEY, handler)).toBe(bucket);
  });

  it('leaves plain search and barcode lookups unlimited', () => {
    expect(Reflect.getMetadata(GUARDS_METADATA, FoodsController.prototype.search)).toBeUndefined();
    expect(
      Reflect.getMetadata(GUARDS_METADATA, FoodsController.prototype.getByBarcode),
    ).toBeUndefined();
  });
});
