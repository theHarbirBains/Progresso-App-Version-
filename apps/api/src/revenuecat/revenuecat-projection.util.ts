import type { RevenueCatEvent } from './revenuecat.types';

export interface SubscriptionProjectionUpdate {
  status: string;
  will_renew?: boolean;
  product_id?: string | null;
  entitlement_id?: string | null;
  current_period_starts_at?: string | null;
  current_period_ends_at?: string | null;
}

/**
 * Maps a RevenueCat event to the projection update it implies, or null if
 * this event type isn't applied to subscriptions (it's still recorded in
 * subscription_events regardless — see the service).
 *
 * Note: RevenueCat has no distinct "refund" event. A refund arrives as a
 * CANCELLATION with cancel_reason = CUSTOMER_SUPPORT and a negative price;
 * the CANCELLATION case below already handles it correctly (will_renew
 * becomes false — access continues until the current period ends, same as
 * any other cancellation). "Restore purchase" isn't a webhook event either
 * — it's a client-side SDK action that re-reads existing state directly.
 */
export function computeProjectionUpdate(
  event: RevenueCatEvent,
): SubscriptionProjectionUpdate | null {
  switch (event.type) {
    case 'INITIAL_PURCHASE':
    case 'RENEWAL':
    case 'UNCANCELLATION':
    case 'SUBSCRIPTION_EXTENDED':
    case 'PRODUCT_CHANGE':
      return {
        status: 'active',
        will_renew: true,
        product_id: event.product_id ?? null,
        entitlement_id: event.entitlement_ids?.[0] ?? null,
        current_period_starts_at: msToIso(event.purchased_at_ms),
        current_period_ends_at: msToIso(event.expiration_at_ms),
      };
    case 'CANCELLATION':
      // Access continues until current_period_ends_at; only renewal intent
      // changes here. EXPIRATION is what actually ends access.
      return { status: 'active', will_renew: false };
    case 'EXPIRATION':
      return { status: 'expired', will_renew: false };
    case 'BILLING_ISSUE':
      return { status: 'billing_issue' };
    default:
      return null;
  }
}

function msToIso(ms: number | null | undefined): string | null {
  return typeof ms === 'number' ? new Date(ms).toISOString() : null;
}

/**
 * Out-of-order guard: an event only gets applied if it's at least as new as
 * whatever was last applied to this subscription's projection.
 */
export function shouldApplyEvent(lastEventAt: Date | null, eventOccurredAt: Date): boolean {
  if (!lastEventAt) {
    return true;
  }
  return eventOccurredAt.getTime() >= lastEventAt.getTime();
}
