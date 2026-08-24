import { createHmac } from 'node:crypto';
import { VersioningType } from '@nestjs/common';
import { FastifyAdapter, NestFastifyApplication } from '@nestjs/platform-fastify';
import { Test } from '@nestjs/testing';
import { AppModule } from '../src/app.module';
import { AllExceptionsFilter } from '../src/common/filters/all-exceptions.filter';
import { SupabaseService } from '../src/supabase/supabase.service';

// .env.test sets this — see apps/api/.env.test.
const SECRET = 'test-revenuecat-webhook-secret-not-real';

function sign(rawBody: string, timestampSeconds = Math.floor(Date.now() / 1000)): string {
  const hmac = createHmac('sha256', SECRET).update(`${timestampSeconds}.${rawBody}`).digest('hex');
  return `t=${timestampSeconds},v1=${hmac}`;
}

describe('RevenueCat webhook (e2e)', () => {
  let app: NestFastifyApplication;
  const insert = jest.fn().mockResolvedValue({ error: null });
  const maybeSingle = jest.fn().mockResolvedValue({ data: null, error: null });
  const eqForSelect = jest.fn().mockReturnValue({ maybeSingle });
  const select = jest.fn().mockReturnValue({ eq: eqForSelect });
  const upsert = jest.fn().mockResolvedValue({ error: null });
  const eqForUpdate = jest.fn().mockResolvedValue({ error: null });
  const update = jest.fn().mockReturnValue({ eq: eqForUpdate });
  const from = jest.fn((table: string) => {
    if (table === 'subscription_events') return { insert, update };
    if (table === 'subscriptions') return { select, upsert };
    throw new Error(`Unexpected table: ${table}`);
  });

  beforeAll(async () => {
    const moduleRef = await Test.createTestingModule({ imports: [AppModule] })
      .overrideProvider(SupabaseService)
      .useValue({ getClient: () => ({ from }) })
      .compile();

    app = moduleRef.createNestApplication<NestFastifyApplication>(new FastifyAdapter(), {
      rawBody: true,
    });
    app.setGlobalPrefix('api', { exclude: ['health'] });
    app.enableVersioning({ type: VersioningType.URI, defaultVersion: '1' });
    app.useGlobalFilters(new AllExceptionsFilter());
    await app.init();
    await app.getHttpAdapter().getInstance().ready();
  });

  afterEach(() => {
    jest.clearAllMocks();
  });

  afterAll(async () => {
    await app.close();
  });

  const eventBody = JSON.stringify({
    api_version: '1.0',
    event: {
      id: 'evt_e2e_1',
      type: 'INITIAL_PURCHASE',
      event_timestamp_ms: Date.now(),
      app_user_id: '11111111-1111-1111-1111-111111111111',
      product_id: 'pro_monthly',
      entitlement_ids: ['pro'],
    },
  });

  it('accepts a correctly signed webhook and processes it', async () => {
    const response = await app.inject({
      method: 'POST',
      url: '/api/v1/webhooks/revenuecat',
      headers: {
        'content-type': 'application/json',
        'x-revenuecat-webhook-signature': sign(eventBody),
      },
      payload: eventBody,
    });

    expect(response.statusCode).toBe(200);
    expect(JSON.parse(response.payload)).toEqual({ received: true });
    expect(insert).toHaveBeenCalledWith(expect.objectContaining({ id: 'evt_e2e_1' }));
    expect(upsert).toHaveBeenCalled();
  });

  it('rejects a request with no signature header and processes nothing', async () => {
    const response = await app.inject({
      method: 'POST',
      url: '/api/v1/webhooks/revenuecat',
      headers: { 'content-type': 'application/json' },
      payload: eventBody,
    });

    expect(response.statusCode).toBe(401);
    expect(insert).not.toHaveBeenCalled();
  });

  it('rejects a request with an invalid signature and processes nothing', async () => {
    const response = await app.inject({
      method: 'POST',
      url: '/api/v1/webhooks/revenuecat',
      headers: {
        'content-type': 'application/json',
        'x-revenuecat-webhook-signature':
          't=1700000000,v1=0000000000000000000000000000000000000000000000000000000000000000',
      },
      payload: eventBody,
    });

    expect(response.statusCode).toBe(401);
    expect(insert).not.toHaveBeenCalled();
  });

  it('rejects a tampered body even with a signature that was valid for the original body', async () => {
    const signatureForOriginal = sign(eventBody);
    const tamperedBody = eventBody.replace('pro_monthly', 'pro_yearly');

    const response = await app.inject({
      method: 'POST',
      url: '/api/v1/webhooks/revenuecat',
      headers: {
        'content-type': 'application/json',
        'x-revenuecat-webhook-signature': signatureForOriginal,
      },
      payload: tamperedBody,
    });

    expect(response.statusCode).toBe(401);
    expect(insert).not.toHaveBeenCalled();
  });

  it('never includes signature/auth material in the response body', async () => {
    const response = await app.inject({
      method: 'POST',
      url: '/api/v1/webhooks/revenuecat',
      headers: {
        'content-type': 'application/json',
        'x-revenuecat-webhook-signature': sign(eventBody),
      },
      payload: eventBody,
    });

    expect(response.payload).not.toContain(SECRET);
  });
});
