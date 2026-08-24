import { Injectable, InternalServerErrorException, Logger } from '@nestjs/common';
import { SupabaseService } from '../supabase/supabase.service';
import { computeProjectionUpdate, shouldApplyEvent } from './revenuecat-projection.util';
import type { RevenueCatEvent, RevenueCatWebhookPayload } from './revenuecat.types';

const UUID_PATTERN = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

@Injectable()
export class RevenueCatEventsService {
  private readonly logger = new Logger(RevenueCatEventsService.name);

  constructor(private readonly supabaseService: SupabaseService) {}

  /**
   * Records the event (the idempotency check itself, via the primary key)
   * and, if new, attempts to apply it to the subscriptions projection.
   * A duplicate delivery is a normal, expected no-op — not an error.
   *
   * Only genuine infrastructure failures (the initial insert failing for a
   * reason other than "already exists") propagate as an exception, which
   * is the one case worth RevenueCat retrying. A projection-application
   * problem (e.g. app_user_id doesn't resolve to a real user) is recorded
   * as 'failed' on the audit row but does not fail the webhook response —
   * retrying wouldn't fix bad data, it would just cause repeated retries.
   */
  async processWebhookEvent(payload: RevenueCatWebhookPayload): Promise<void> {
    const event = payload.event;
    const client = this.supabaseService.getClient();

    const { error: insertError } = await client.from('subscription_events').insert({
      id: event.id,
      event_type: event.type,
      app_user_id: event.app_user_id,
      occurred_at: new Date(event.event_timestamp_ms).toISOString(),
      payload: payload as unknown as Record<string, unknown>,
    });

    if (insertError) {
      if (insertError.code === '23505') {
        // Duplicate event id: RevenueCat retries reuse the same id. Already
        // recorded (and processed, or in the middle of being processed) —
        // idempotent no-op.
        return;
      }
      throw new InternalServerErrorException('Failed to record subscription event');
    }

    try {
      const outcome = await this.applyProjection(event);
      await this.markEvent(event.id, outcome.status, outcome.note);
    } catch (err) {
      const message = err instanceof Error ? err.message : String(err);
      this.logger.error(`Failed to apply RevenueCat event ${event.id}: ${message}`);
      await this.markEvent(event.id, 'failed', message);
    }
  }

  private async applyProjection(
    event: RevenueCatEvent,
  ): Promise<{ status: 'processed' | 'skipped'; note?: string }> {
    const update = computeProjectionUpdate(event);
    if (!update) {
      return {
        status: 'skipped',
        note: `Event type ${event.type} is not applied to the projection`,
      };
    }

    if (!UUID_PATTERN.test(event.app_user_id)) {
      return { status: 'skipped', note: 'app_user_id is not a resolvable user id' };
    }

    const client = this.supabaseService.getClient();
    const eventOccurredAt = new Date(event.event_timestamp_ms);

    const { data: existing, error: readError } = await client
      .from('subscriptions')
      .select('last_event_at')
      .eq('user_id', event.app_user_id)
      .maybeSingle();

    if (readError) {
      throw new Error(`Failed to read existing subscription state: ${readError.message}`);
    }

    const lastEventAt = existing?.last_event_at ? new Date(existing.last_event_at as string) : null;
    if (!shouldApplyEvent(lastEventAt, eventOccurredAt)) {
      return { status: 'skipped', note: 'Superseded by a more recently applied event' };
    }

    const { error: upsertError } = await client.from('subscriptions').upsert(
      {
        user_id: event.app_user_id,
        revenuecat_customer_id: event.app_user_id,
        last_event_at: eventOccurredAt.toISOString(),
        ...update,
      },
      { onConflict: 'user_id' },
    );

    if (upsertError) {
      throw new Error(`Failed to upsert subscription projection: ${upsertError.message}`);
    }

    return { status: 'processed' };
  }

  private async markEvent(
    id: string,
    status: 'processed' | 'skipped' | 'failed',
    note?: string,
  ): Promise<void> {
    const client = this.supabaseService.getClient();
    const { error } = await client
      .from('subscription_events')
      .update({ processing_status: status, processing_note: note ?? null })
      .eq('id', id);

    if (error) {
      this.logger.error(`Failed to update subscription_events status for ${id}: ${error.message}`);
    }
  }
}
