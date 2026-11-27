import { Injectable, Logger } from '@nestjs/common';
import { isBlockedEitherWay, loadBlocks } from '../safety/blocks';
import { SupabaseService } from '../supabase/supabase.service';
import { ExpoPushProvider } from './providers/expo-push.provider';
import {
  commentPreview,
  notificationCopy,
  notificationName,
  notificationPath,
  type SocialNotificationType,
} from './social-notification-copy';

/** The app's own links (app.json's scheme): a tapped push opens this screen. */
const APP_LINK_PREFIX = 'progresso://';

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

/** A social event, as the service that made it happen hands it over -- after it's done. */
export type SocialEvent =
  | { type: 'follow_request'; recipientId: string; actorId: string; followId: string }
  | { type: 'follow_accepted'; recipientId: string; actorId: string; followId: string }
  | { type: 'new_follower'; recipientId: string; actorId: string; followId: string }
  | {
      type: 'workout_invite';
      recipientId: string;
      actorId: string;
      groupId: string;
      inviteId: string;
    }
  | {
      type: 'invite_answer';
      recipientId: string;
      actorId: string;
      groupId: string;
      inviteId: string;
      answer: 'accepted' | 'declined';
      groupName: string | null;
    }
  | { type: 'workout_like'; recipientId: string; actorId: string; workoutId: string }
  | {
      type: 'workout_comment';
      recipientId: string;
      actorId: string;
      workoutId: string;
      commentId: string;
      text: string;
    };

/** Which Settings > Notifications > Social switch each kind of push falls under. */
const SWITCH_COLUMN: Record<SocialNotificationType, string> = {
  follow_request: 'notify_follows',
  new_follower: 'notify_follows',
  follow_accepted: 'notify_follow_accepted',
  workout_invite: 'notify_group_invites',
  invite_answer: 'notify_group_invites',
  workout_like: 'notify_likes',
  workout_comment: 'notify_comments',
};

interface RecordRule {
  dedupeKey: string;
  throttleKey: string;
  /** How long after one push another with the same throttle key waits. */
  cooldown: string;
  /** Whether the same person doing it again is news of its own (a new request, a new invite). */
  repeat: boolean;
}

/**
 * How each event is recorded: what makes it one record, and how its pushes are spaced. Follow
 * requests and invitations are never grouped away -- only a quick repeat by the same person is
 * held back -- while every like on one workout is one record, pushed at most every half hour, and
 * one person's comments on one workout push at most once in two minutes.
 */
export function recordRule(event: SocialEvent): RecordRule {
  switch (event.type) {
    case 'follow_request':
    case 'follow_accepted':
    case 'new_follower': {
      const key = `${event.type}:${event.actorId}`;
      return { dedupeKey: key, throttleKey: key, cooldown: '24 hours', repeat: true };
    }
    case 'workout_invite': {
      const key = `workout_invite:${event.groupId}`;
      return { dedupeKey: key, throttleKey: key, cooldown: '30 seconds', repeat: true };
    }
    case 'invite_answer': {
      const key = `invite_answer:${event.inviteId}`;
      return { dedupeKey: key, throttleKey: key, cooldown: '30 seconds', repeat: true };
    }
    case 'workout_like': {
      const key = `workout_like:${event.workoutId}`;
      return { dedupeKey: key, throttleKey: key, cooldown: '30 minutes', repeat: false };
    }
    case 'workout_comment':
      return {
        dedupeKey: `workout_comment:${event.commentId}`,
        throttleKey: `workout_comment:${event.workoutId}:${event.actorId}`,
        cooldown: '2 minutes',
        repeat: false,
      };
  }
}

/** The ids an event carries, all of which must be real ids. */
function idsOf(event: SocialEvent): string[] {
  const ids = [event.recipientId, event.actorId];
  if ('followId' in event) ids.push(event.followId);
  if ('groupId' in event) ids.push(event.groupId, event.inviteId);
  if ('workoutId' in event) ids.push(event.workoutId);
  if ('commentId' in event) ids.push(event.commentId);
  return ids;
}

interface Recorded {
  notification_id: string;
  should_push: boolean;
  actor_count: number;
  unread: number;
}

/**
 * Social notifications -- a follow request, a request accepted, a new follower, a live workout
 * invitation and its answer, a like, a comment. Each event the server has just carried out (never
 * one a phone asks for) is recorded once (`record_social_notification`: idempotent, grouped,
 * spaced) -- the in-app Notifications screen's record -- and pushed through Expo when the record
 * says it's due, to every device the person registered, if they said yes to notifications and
 * have that kind switched on. Never about someone's own action, never across a block. A device
 * Expo says is gone is removed. Recording or sending never fails what caused it: a problem is
 * logged, and the like or comment stands.
 */
@Injectable()
export class SocialPushService {
  private readonly logger = new Logger(SocialPushService.name);

  constructor(
    private readonly supabaseService: SupabaseService,
    private readonly expoPush: ExpoPushProvider,
  ) {}

  async record(event: SocialEvent): Promise<void> {
    try {
      if (event.recipientId === event.actorId) return;
      if (!idsOf(event).every((id) => typeof id === 'string' && UUID.test(id))) {
        this.logger.warn(`Social notification (${event.type}) skipped: an id isn't valid`);
        return;
      }
      const client = this.supabaseService.getClient();
      // Never across a block, either way.
      const blocks = await loadBlocks(client, event.recipientId);
      if (isBlockedEitherWay(blocks, event.actorId)) return;

      const rule = recordRule(event);
      const { data, error } = await client.rpc('record_social_notification', {
        p_recipient: event.recipientId,
        p_actor: event.actorId,
        p_type: event.type,
        p_dedupe_key: rule.dedupeKey,
        p_throttle_key: rule.throttleKey,
        p_cooldown: rule.cooldown,
        p_repeat: rule.repeat,
        p_follow_id: 'followId' in event ? event.followId : null,
        p_workout_id: 'workoutId' in event ? event.workoutId : null,
        p_comment_id: 'commentId' in event ? event.commentId : null,
        p_group_id: 'groupId' in event ? event.groupId : null,
        p_invite_id: 'inviteId' in event ? event.inviteId : null,
        p_preview:
          event.type === 'workout_comment'
            ? commentPreview(event.text)
            : event.type === 'invite_answer'
              ? event.answer
              : null,
      });
      if (error) throw new Error(error.message);
      const recorded = (Array.isArray(data) ? data[0] : data) as Recorded | undefined;
      if (!recorded?.should_push) return;
      await this.push(event, recorded);
    } catch (err) {
      this.logger.warn(
        `Social notification (${event.type}) failed: ${err instanceof Error ? err.message : String(err)}`,
      );
    }
  }

  private async push(event: SocialEvent, recorded: Recorded): Promise<void> {
    const client = this.supabaseService.getClient();
    const switchColumn = SWITCH_COLUMN[event.type];
    const [recipientResult, actorResult, tokensResult] = await Promise.all([
      client
        .from('users')
        .select(`push_notifications_opt_in, ${switchColumn}`)
        .eq('id', event.recipientId)
        .maybeSingle(),
      client.from('users').select('display_name, username').eq('id', event.actorId).maybeSingle(),
      client.from('device_push_tokens').select('expo_push_token').eq('user_id', event.recipientId),
    ]);
    const recipient = recipientResult.data as Record<string, unknown> | null;
    if (!recipient || recipient.push_notifications_opt_in !== true) return;
    if (recipient[switchColumn] !== true) return;
    const tokens = ((tokensResult.data ?? []) as { expo_push_token: string }[]).map(
      (row) => row.expo_push_token,
    );
    if (tokens.length === 0) return;

    const actor = actorResult.data as {
      display_name: string | null;
      username: string | null;
    } | null;
    const actorName = notificationName(
      actor?.display_name ?? (actor?.username ? `@${actor.username}` : null),
    );
    const { title, body } = notificationCopy({
      type: event.type,
      actorName,
      actorCount: recorded.actor_count,
      preview:
        event.type === 'workout_comment'
          ? commentPreview(event.text)
          : event.type === 'invite_answer'
            ? event.answer
            : null,
      groupName: event.type === 'invite_answer' ? event.groupName : null,
    });
    const path = notificationPath({
      type: event.type,
      actorId: event.actorId,
      workoutId: 'workoutId' in event ? event.workoutId : null,
      commentId: 'commentId' in event ? event.commentId : null,
      groupId: 'groupId' in event ? event.groupId : null,
    });
    // What a tap needs: where it goes, and what it's about.
    const data: Record<string, string> = {
      url: `${APP_LINK_PREFIX}${path}`,
      type: event.type,
      notificationId: recorded.notification_id,
      actorId: event.actorId,
      recipientId: event.recipientId,
    };
    if ('followId' in event) data.followId = event.followId;
    if ('workoutId' in event) data.workoutId = event.workoutId;
    if ('commentId' in event) data.commentId = event.commentId;
    if ('groupId' in event) {
      data.groupId = event.groupId;
      data.inviteId = event.inviteId;
    }

    const { invalidTokens } = await this.expoPush.sendAll(
      tokens.map((to) => ({ to, title, body, data, badge: recorded.unread })),
    );
    if (invalidTokens.length > 0) await this.removeTokens(invalidTokens);
  }

  /** Forgets devices Expo says are gone, so nothing is sent to them again. */
  async removeTokens(tokens: string[]): Promise<void> {
    const { error } = await this.supabaseService
      .getClient()
      .from('device_push_tokens')
      .delete()
      .in('expo_push_token', tokens);
    if (error) this.logger.warn(`Removing gone push tokens failed: ${error.message}`);
  }
}
