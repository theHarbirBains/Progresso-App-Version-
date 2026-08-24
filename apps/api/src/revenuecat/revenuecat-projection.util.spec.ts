import { computeProjectionUpdate, shouldApplyEvent } from './revenuecat-projection.util';
import type { RevenueCatEvent } from './revenuecat.types';

function event(overrides: Partial<RevenueCatEvent>): RevenueCatEvent {
  return {
    id: 'evt_1',
    type: 'INITIAL_PURCHASE',
    event_timestamp_ms: Date.parse('2026-08-24T00:00:00.000Z'),
    app_user_id: 'user-1',
    ...overrides,
  };
}

describe('computeProjectionUpdate', () => {
  it.each([
    'INITIAL_PURCHASE',
    'RENEWAL',
    'UNCANCELLATION',
    'SUBSCRIPTION_EXTENDED',
    'PRODUCT_CHANGE',
  ])('%s activates the subscription and enables renewal', (type) => {
    const update = computeProjectionUpdate(
      event({
        type,
        product_id: 'pro_monthly',
        entitlement_ids: ['pro'],
        purchased_at_ms: Date.parse('2026-08-01T00:00:00.000Z'),
        expiration_at_ms: Date.parse('2026-09-01T00:00:00.000Z'),
      }),
    );

    expect(update).toEqual({
      status: 'active',
      will_renew: true,
      product_id: 'pro_monthly',
      entitlement_id: 'pro',
      current_period_starts_at: '2026-08-01T00:00:00.000Z',
      current_period_ends_at: '2026-09-01T00:00:00.000Z',
    });
  });

  it('CANCELLATION disables renewal but keeps access active (covers refunds too — RevenueCat has no distinct refund event)', () => {
    const update = computeProjectionUpdate(
      event({ type: 'CANCELLATION', cancel_reason: 'CUSTOMER_SUPPORT' }),
    );
    expect(update).toEqual({ status: 'active', will_renew: false });
  });

  it('EXPIRATION ends access', () => {
    const update = computeProjectionUpdate(event({ type: 'EXPIRATION' }));
    expect(update).toEqual({ status: 'expired', will_renew: false });
  });

  it('BILLING_ISSUE flags the subscription without touching renewal intent', () => {
    const update = computeProjectionUpdate(event({ type: 'BILLING_ISSUE' }));
    expect(update).toEqual({ status: 'billing_issue' });
  });

  it('an unrecognized event type is not applied to the projection', () => {
    expect(computeProjectionUpdate(event({ type: 'INVOICE_ISSUANCE' }))).toBeNull();
    expect(computeProjectionUpdate(event({ type: 'SOME_FUTURE_EVENT_TYPE' }))).toBeNull();
  });
});

describe('shouldApplyEvent', () => {
  const older = new Date('2026-08-01T00:00:00.000Z');
  const newer = new Date('2026-08-02T00:00:00.000Z');

  it('applies when there is no prior event', () => {
    expect(shouldApplyEvent(null, newer)).toBe(true);
  });

  it('applies a newer event over an older one', () => {
    expect(shouldApplyEvent(older, newer)).toBe(true);
  });

  it('rejects an older event arriving after a newer one was already applied', () => {
    expect(shouldApplyEvent(newer, older)).toBe(false);
  });

  it('applies an event with the exact same timestamp (idempotent boundary)', () => {
    expect(shouldApplyEvent(older, older)).toBe(true);
  });
});
