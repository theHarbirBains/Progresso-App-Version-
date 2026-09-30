import { Injectable, Logger } from '@nestjs/common';

const EXPO_PUSH_URL = 'https://exp.host/--/api/v2/push/send';
// Expo's own documented limit per request.
const MAX_MESSAGES_PER_REQUEST = 100;
const REQUEST_TIMEOUT_MS = 10000;
const RETRY_DELAY_MS = 400;

export interface ExpoPushMessage {
  to: string;
  title: string;
  body: string;
}

/**
 * Sends push notifications through Expo's push service -- no APNs
 * certificate/key management of our own, the whole reason this app uses
 * Expo push rather than talking to Apple directly (see the
 * INTERNAL_NOTIFICATIONS_SECRET env var comment for the rest of this
 * feature's setup). No access token required for basic sending: Expo's push
 * API accepts a plain array of {to, title, body} objects.
 *
 * Batches at Expo's own documented 100-messages-per-request limit. A
 * failure sending one batch is logged and skipped, never thrown -- a
 * transient failure for one batch of users shouldn't stop every other
 * batch's notifications from going out in the same job run.
 */
@Injectable()
export class ExpoPushProvider {
  private readonly logger = new Logger(ExpoPushProvider.name);

  async sendAll(messages: ExpoPushMessage[]): Promise<void> {
    for (let i = 0; i < messages.length; i += MAX_MESSAGES_PER_REQUEST) {
      const batch = messages.slice(i, i + MAX_MESSAGES_PER_REQUEST);
      await this.sendBatch(batch);
    }
  }

  private async sendBatch(batch: ExpoPushMessage[], attempt = 0): Promise<void> {
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), REQUEST_TIMEOUT_MS);
    try {
      const response = await fetch(EXPO_PUSH_URL, {
        method: 'POST',
        headers: {
          'content-type': 'application/json',
          accept: 'application/json',
          'accept-encoding': 'gzip, deflate',
        },
        signal: controller.signal,
        body: JSON.stringify(
          batch.map(({ to, title, body }) => ({ to, title, body, sound: 'default' })),
        ),
      });

      if (!response.ok) {
        if (response.status >= 500 && attempt < 1) {
          await new Promise((resolve) => setTimeout(resolve, RETRY_DELAY_MS));
          return this.sendBatch(batch, attempt + 1);
        }
        this.logger.warn(`Expo push request failed: ${response.status}`);
        return;
      }
    } catch (err) {
      this.logger.warn(
        `Expo push request errored: ${err instanceof Error ? err.message : String(err)}`,
      );
    } finally {
      clearTimeout(timeout);
    }
  }
}
