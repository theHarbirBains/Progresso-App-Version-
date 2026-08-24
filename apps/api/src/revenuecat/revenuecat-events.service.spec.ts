import { RevenueCatEventsService } from './revenuecat-events.service';
import type { RevenueCatWebhookPayload } from './revenuecat.types';
import type { SupabaseService } from '../supabase/supabase.service';

function payload(
  overrides: Partial<RevenueCatWebhookPayload['event']> = {},
): RevenueCatWebhookPayload {
  return {
    api_version: '1.0',
    event: {
      id: 'evt_1',
      type: 'INITIAL_PURCHASE',
      event_timestamp_ms: Date.parse('2026-08-24T00:00:00.000Z'),
      app_user_id: '11111111-1111-1111-1111-111111111111',
      product_id: 'pro_monthly',
      entitlement_ids: ['pro'],
      purchased_at_ms: Date.parse('2026-08-01T00:00:00.000Z'),
      expiration_at_ms: Date.parse('2026-09-01T00:00:00.000Z'),
      ...overrides,
    },
  };
}

/** Builds a mock Supabase client with per-table/operation configurable results. */
function createMockClient(options: {
  insertEventError?: { code?: string; message: string } | null;
  existingLastEventAt?: string | null;
  readError?: { message: string } | null;
  upsertError?: { message: string } | null;
}) {
  const insertEvents = jest.fn().mockResolvedValue({ error: options.insertEventError ?? null });
  const maybeSingle = jest.fn().mockResolvedValue({
    data:
      options.existingLastEventAt !== undefined
        ? { last_event_at: options.existingLastEventAt }
        : null,
    error: options.readError ?? null,
  });
  const eqForSelect = jest.fn().mockReturnValue({ maybeSingle });
  const select = jest.fn().mockReturnValue({ eq: eqForSelect });
  const upsert = jest.fn().mockResolvedValue({ error: options.upsertError ?? null });
  const eqForUpdate = jest.fn().mockResolvedValue({ error: null });
  const update = jest.fn().mockReturnValue({ eq: eqForUpdate });

  const from = jest.fn((table: string) => {
    if (table === 'subscription_events') {
      return { insert: insertEvents, update };
    }
    if (table === 'subscriptions') {
      return { select, upsert };
    }
    throw new Error(`Unexpected table: ${table}`);
  });

  return { from, insertEvents, select, upsert, update, maybeSingle, eqForUpdate };
}

function serviceWith(client: ReturnType<typeof createMockClient>): RevenueCatEventsService {
  const supabaseService = { getClient: () => client } as unknown as SupabaseService;
  return new RevenueCatEventsService(supabaseService);
}

describe('RevenueCatEventsService', () => {
  it('applies a new event to the subscription projection', async () => {
    const client = createMockClient({ existingLastEventAt: null });
    const service = serviceWith(client);

    await service.processWebhookEvent(payload());

    expect(client.insertEvents).toHaveBeenCalledWith(
      expect.objectContaining({ id: 'evt_1', event_type: 'INITIAL_PURCHASE' }),
    );
    expect(client.upsert).toHaveBeenCalledWith(
      expect.objectContaining({
        user_id: '11111111-1111-1111-1111-111111111111',
        status: 'active',
        will_renew: true,
      }),
      { onConflict: 'user_id' },
    );
    expect(client.update).toHaveBeenCalledWith(
      expect.objectContaining({ processing_status: 'processed' }),
    );
  });

  it('is idempotent: a duplicate event id does not touch the projection', async () => {
    const client = createMockClient({
      insertEventError: { code: '23505', message: 'duplicate key' },
    });
    const service = serviceWith(client);

    await service.processWebhookEvent(payload());

    expect(client.insertEvents).toHaveBeenCalled();
    expect(client.upsert).not.toHaveBeenCalled();
    expect(client.update).not.toHaveBeenCalled();
  });

  it('propagates a genuine infrastructure failure on the initial insert (worth retrying)', async () => {
    const client = createMockClient({
      insertEventError: { code: '08000', message: 'connection lost' },
    });
    const service = serviceWith(client);

    await expect(service.processWebhookEvent(payload())).rejects.toThrow();
    expect(client.upsert).not.toHaveBeenCalled();
  });

  it('skips an out-of-order event without failing the webhook', async () => {
    const client = createMockClient({ existingLastEventAt: '2026-09-01T00:00:00.000Z' }); // newer than the event
    const service = serviceWith(client);

    await service.processWebhookEvent(payload());

    expect(client.upsert).not.toHaveBeenCalled();
    expect(client.update).toHaveBeenCalledWith(
      expect.objectContaining({ processing_status: 'skipped' }),
    );
  });

  it('skips (does not throw) an event whose app_user_id is not a resolvable user id', async () => {
    const client = createMockClient({ existingLastEventAt: null });
    const service = serviceWith(client);

    await service.processWebhookEvent(payload({ app_user_id: 'RCAnonymousID:not-a-uuid' }));

    expect(client.upsert).not.toHaveBeenCalled();
    expect(client.update).toHaveBeenCalledWith(
      expect.objectContaining({ processing_status: 'skipped' }),
    );
  });

  it('records an unrecognized event type as skipped, still auditing it', async () => {
    const client = createMockClient({ existingLastEventAt: null });
    const service = serviceWith(client);

    await service.processWebhookEvent(payload({ type: 'INVOICE_ISSUANCE' }));

    expect(client.insertEvents).toHaveBeenCalled();
    expect(client.upsert).not.toHaveBeenCalled();
    expect(client.update).toHaveBeenCalledWith(
      expect.objectContaining({ processing_status: 'skipped' }),
    );
  });

  it('marks the event failed (without throwing) when the projection upsert itself fails', async () => {
    const client = createMockClient({
      existingLastEventAt: null,
      upsertError: { message: 'constraint violation' },
    });
    const service = serviceWith(client);

    await expect(service.processWebhookEvent(payload())).resolves.toBeUndefined();

    expect(client.update).toHaveBeenCalledWith(
      expect.objectContaining({ processing_status: 'failed' }),
    );
  });
});
