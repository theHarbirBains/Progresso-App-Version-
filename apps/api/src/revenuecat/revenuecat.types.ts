// Subscription-lifecycle event types this handler acts on. RevenueCat sends
// other types too (paywall interaction events, INVOICE_ISSUANCE, etc.) —
// anything not listed here is still recorded in subscription_events for
// audit, just not applied to the subscriptions projection.
export type RevenueCatEventType =
  | 'INITIAL_PURCHASE'
  | 'RENEWAL'
  | 'CANCELLATION'
  | 'UNCANCELLATION'
  | 'NON_RENEWING_PURCHASE'
  | 'SUBSCRIPTION_PAUSED'
  | 'EXPIRATION'
  | 'BILLING_ISSUE'
  | 'PRODUCT_CHANGE'
  | 'SUBSCRIPTION_EXTENDED'
  | 'REFUND_REVERSED'
  | 'INVOICE_ISSUANCE'
  | (string & {});

export interface RevenueCatEvent {
  id: string;
  type: RevenueCatEventType;
  event_timestamp_ms: number;
  app_user_id: string;
  original_app_user_id?: string;
  product_id?: string;
  entitlement_ids?: string[] | null;
  purchased_at_ms?: number | null;
  expiration_at_ms?: number | null;
  environment?: 'SANDBOX' | 'PRODUCTION';
  cancel_reason?: string;
  expiration_reason?: string;
  [key: string]: unknown;
}

export interface RevenueCatWebhookPayload {
  api_version: string;
  event: RevenueCatEvent;
}
