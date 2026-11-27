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
  /** Sent along to the app: `url` is the link a tap opens (progresso://...). */
  data?: Record<string, string>;
  /** The app icon's badge: the person's unread notifications. */
  badge?: number;
}

export interface ExpoPushResult {
  /** Tokens Expo says no longer reach a device (the app deleted, notifications revoked). */
  invalidTokens: string[];
}

interface ExpoTicket {
  status?: 'ok' | 'error';
  details?: { error?: string };
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
 *
 * Expo answers each message with a ticket, in order: one saying the token's device is no longer
 * registered (DeviceNotRegistered) is reported back, so the token can be removed. With
 * EXPO_ACCESS_TOKEN set (Expo's "enhanced push security", optional), every request carries it.
 */
@Injectable()
export class ExpoPushProvider {
  private readonly logger = new Logger(ExpoPushProvider.name);

  async sendAll(messages: ExpoPushMessage[]): Promise<ExpoPushResult> {
    const invalidTokens: string[] = [];
    for (let i = 0; i < messages.length; i += MAX_MESSAGES_PER_REQUEST) {
      const batch = messages.slice(i, i + MAX_MESSAGES_PER_REQUEST);
      invalidTokens.push(...(await this.sendBatch(batch)));
    }
    return { invalidTokens };
  }

  private async sendBatch(batch: ExpoPushMessage[], attempt = 0): Promise<string[]> {
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), REQUEST_TIMEOUT_MS);
    try {
      const response = await fetch(EXPO_PUSH_URL, {
        method: 'POST',
        headers: {
          'content-type': 'application/json',
          accept: 'application/json',
          'accept-encoding': 'gzip, deflate',
          ...(process.env.EXPO_ACCESS_TOKEN
            ? { authorization: `Bearer ${process.env.EXPO_ACCESS_TOKEN}` }
            : {}),
        },
        signal: controller.signal,
        body: JSON.stringify(
          batch.map(({ to, title, body, data, badge }) => ({
            to,
            title,
            body,
            sound: 'default',
            ...(data ? { data } : {}),
            ...(badge !== undefined ? { badge } : {}),
          })),
        ),
      });

      if (!response.ok) {
        if (response.status >= 500 && attempt < 1) {
          await new Promise((resolve) => setTimeout(resolve, RETRY_DELAY_MS));
          return this.sendBatch(batch, attempt + 1);
        }
        this.logger.warn(`Expo push request failed: ${response.status}`);
        return [];
      }
      return await this.invalidTokensIn(response, batch);
    } catch (err) {
      this.logger.warn(
        `Expo push request errored: ${err instanceof Error ? err.message : String(err)}`,
      );
      return [];
    } finally {
      clearTimeout(timeout);
    }
  }

  /** The batch's tokens whose tickets say their device is gone. */
  private async invalidTokensIn(response: Response, batch: ExpoPushMessage[]): Promise<string[]> {
    try {
      const json = (await response.json()) as { data?: ExpoTicket[] };
      const tickets = Array.isArray(json.data) ? json.data : [];
      return tickets.flatMap((ticket, i) =>
        ticket?.status === 'error' && ticket.details?.error === 'DeviceNotRegistered' && batch[i]
          ? [batch[i].to]
          : [],
      );
    } catch {
      return [];
    }
  }
}
