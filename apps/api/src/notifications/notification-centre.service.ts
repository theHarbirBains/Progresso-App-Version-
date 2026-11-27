import { Injectable, InternalServerErrorException } from '@nestjs/common';
import { isBlockedEitherWay, loadBlocks } from '../safety/blocks';
import { SupabaseService } from '../supabase/supabase.service';
import {
  commentPreview,
  notificationCopy,
  notificationName,
  notificationPath,
  type SocialNotificationType,
} from './social-notification-copy';

/** How many a list holds at most. */
export const NOTIFICATIONS_PAGE_MAX = 100;

const COLUMNS =
  'id, type, actor_id, actor_count, follow_id, workout_id, comment_id, group_id, invite_id, preview, event_at, read_at';

interface NotificationRow {
  id: string;
  type: SocialNotificationType;
  actor_id: string | null;
  actor_count: number;
  follow_id: string | null;
  workout_id: string | null;
  comment_id: string | null;
  group_id: string | null;
  invite_id: string | null;
  preview: string | null;
  event_at: string;
  read_at: string | null;
}

export interface NotificationActor {
  id: string;
  username: string | null;
  displayName: string | null;
  avatarUrl: string | null;
}

export type FollowState = 'none' | 'pending' | 'accepted';
export type InviteState = 'invited' | 'joined' | 'declined' | 'cancelled' | 'left' | 'expired';

/**
 * One notification as the Notifications screen shows it: the same words its push had, whether
 * it's been read, who's behind it, where a tap goes -- and, read fresh, whether that's still there
 * (a workout deleted, an invitation expired) and what's become of it (a request accepted, an
 * invitation answered).
 */
export interface NotificationItem {
  id: string;
  type: SocialNotificationType;
  title: string;
  body: string;
  at: string;
  read: boolean;
  actor: NotificationActor | null;
  actorCount: number;
  /** The app's link for it (navigation/linking.ts), as its push carries. */
  path: string;
  followId: string | null;
  workoutId: string | null;
  commentId: string | null;
  groupId: string | null;
  /** Whether what it's about can still be opened. */
  available: boolean;
  /** A follow request: still waiting, or accepted. */
  followStatus?: 'pending' | 'accepted';
  /** A follow request or new follower: whether they follow them back. */
  followingBack?: FollowState;
  /** An invitation: what became of it. */
  inviteStatus?: InviteState;
}

/** A follow-type record whose follow is gone (withdrawn, declined, unfollowed) isn't listed. */
function listed(row: Pick<NotificationRow, 'type' | 'follow_id'>): boolean {
  return !(
    (row.type === 'follow_request' ||
      row.type === 'follow_accepted' ||
      row.type === 'new_follower') &&
    row.follow_id === null
  );
}

/**
 * The in-app Notifications screen's own records (the `notifications` table, which only the
 * server writes -- SocialPushService): a person's own, newest first, never from someone blocked
 * either way; marking them read; and the unread count the Feed bell and the app icon's badge show.
 */
@Injectable()
export class NotificationCentreService {
  constructor(private readonly supabaseService: SupabaseService) {}

  async list(userId: string, limit = 50): Promise<NotificationItem[]> {
    const client = this.supabaseService.getClient();
    const { data, error } = await client
      .from('notifications')
      .select(COLUMNS)
      .eq('recipient_id', userId)
      .order('event_at', { ascending: false })
      .limit(Math.min(Math.max(limit, 1), NOTIFICATIONS_PAGE_MAX) * 2);
    if (error) throw new InternalServerErrorException('Failed to load notifications');

    const blocks = await loadBlocks(client, userId);
    const rows = ((data ?? []) as NotificationRow[])
      .filter(listed)
      .filter((row) => !row.actor_id || !isBlockedEitherWay(blocks, row.actor_id))
      .slice(0, Math.min(Math.max(limit, 1), NOTIFICATIONS_PAGE_MAX));
    if (rows.length === 0) return [];

    const unique = (ids: (string | null)[]) => [...new Set(ids.filter((id): id is string => !!id))];
    const actorIds = unique(rows.map((row) => row.actor_id));
    const followIds = unique(rows.map((row) => row.follow_id));
    const workoutIds = unique(rows.map((row) => row.workout_id));
    const inviteIds = unique(rows.map((row) => row.invite_id));
    const groupIds = unique(rows.map((row) => row.group_id));

    const none = Promise.resolve({ data: [], error: null });
    const [actors, follows, back, workouts, invites, groups] = await Promise.all([
      actorIds.length
        ? client.from('users').select('id, username, display_name, avatar_url').in('id', actorIds)
        : none,
      followIds.length ? client.from('follows').select('id, status').in('id', followIds) : none,
      actorIds.length
        ? client
            .from('follows')
            .select('followee_id, status')
            .eq('follower_id', userId)
            .in('followee_id', actorIds)
        : none,
      workoutIds.length
        ? client.from('workouts').select('id, deleted_at').in('id', workoutIds)
        : none,
      inviteIds.length
        ? client.from('workout_group_members').select('id, status').in('id', inviteIds)
        : none,
      groupIds.length
        ? client.from('workout_groups').select('id, name, status').in('id', groupIds)
        : none,
    ]);
    for (const result of [actors, follows, back, workouts, invites, groups]) {
      if (result.error) throw new InternalServerErrorException('Failed to load notifications');
    }

    const actorById = new Map(
      ((actors.data ?? []) as Record<string, string | null>[]).map((row) => [
        row.id as string,
        {
          id: row.id as string,
          username: row.username ?? null,
          displayName: row.display_name ?? null,
          avatarUrl: row.avatar_url ?? null,
        },
      ]),
    );
    const followStatus = new Map(
      ((follows.data ?? []) as { id: string; status: 'pending' | 'accepted' }[]).map((row) => [
        row.id,
        row.status,
      ]),
    );
    const followingBack = new Map(
      ((back.data ?? []) as { followee_id: string; status: 'pending' | 'accepted' }[]).map(
        (row) => [row.followee_id, row.status],
      ),
    );
    const liveWorkouts = new Set(
      ((workouts.data ?? []) as { id: string; deleted_at: string | null }[])
        .filter((row) => row.deleted_at === null)
        .map((row) => row.id),
    );
    const inviteStatus = new Map(
      ((invites.data ?? []) as { id: string; status: string }[]).map((row) => [row.id, row.status]),
    );
    const groupById = new Map(
      ((groups.data ?? []) as { id: string; name: string; status: string }[]).map((row) => [
        row.id,
        row,
      ]),
    );

    return rows.map((row): NotificationItem => {
      const actor = row.actor_id ? (actorById.get(row.actor_id) ?? null) : null;
      const actorName = notificationName(
        actor?.displayName ?? (actor?.username ? `@${actor.username}` : null),
      );
      const group = row.group_id ? groupById.get(row.group_id) : undefined;
      const { title, body } = notificationCopy({
        type: row.type,
        actorName,
        actorCount: row.actor_count,
        preview: row.type === 'workout_comment' ? commentPreview(row.preview) : row.preview,
        groupName: group?.name ?? null,
      });
      const item: NotificationItem = {
        id: row.id,
        type: row.type,
        title,
        body,
        at: row.event_at,
        read: row.read_at !== null,
        actor,
        actorCount: row.actor_count,
        path: notificationPath({
          type: row.type,
          actorId: row.actor_id,
          workoutId: row.workout_id,
          commentId: row.comment_id,
          groupId: row.group_id,
        }),
        followId: row.follow_id,
        workoutId: row.workout_id,
        commentId: row.comment_id,
        groupId: row.group_id,
        available: true,
      };
      if (row.type === 'workout_like' || row.type === 'workout_comment') {
        item.available = !!row.workout_id && liveWorkouts.has(row.workout_id);
      }
      if (row.type === 'follow_request') {
        item.followStatus = row.follow_id ? followStatus.get(row.follow_id) : undefined;
        item.available = item.followStatus !== undefined;
      }
      if (row.type === 'follow_request' || row.type === 'new_follower') {
        item.followingBack = row.actor_id ? (followingBack.get(row.actor_id) ?? 'none') : 'none';
      }
      if (row.type === 'follow_accepted' || row.type === 'new_follower') {
        item.available = !!actor;
      }
      if (row.type === 'workout_invite' || row.type === 'invite_answer') {
        const status = row.invite_id ? inviteStatus.get(row.invite_id) : undefined;
        const live = group?.status === 'live';
        item.inviteStatus =
          status === 'invited' && !live
            ? 'expired'
            : ((status as InviteState | undefined) ?? 'expired');
        item.available = !!group && (row.type === 'invite_answer' || live);
      }
      return item;
    });
  }

  /** How many of their notifications they haven't read -- the bell's and the icon's badge. */
  async unreadCount(userId: string): Promise<number> {
    const client = this.supabaseService.getClient();
    const { data, error } = await client
      .from('notifications')
      .select('type, actor_id, follow_id')
      .eq('recipient_id', userId)
      .is('read_at', null)
      .limit(500);
    if (error) throw new InternalServerErrorException('Failed to count notifications');
    const blocks = await loadBlocks(client, userId);
    return ((data ?? []) as Pick<NotificationRow, 'type' | 'actor_id' | 'follow_id'>[]).filter(
      (row) => listed(row) && (!row.actor_id || !isBlockedEitherWay(blocks, row.actor_id)),
    ).length;
  }

  /** Marks their own notifications read -- these, or every one -- and says how many are left. */
  async markRead(userId: string, ids?: string[]): Promise<number> {
    let query = this.supabaseService
      .getClient()
      .from('notifications')
      .update({ read_at: new Date().toISOString() })
      .eq('recipient_id', userId)
      .is('read_at', null);
    if (ids) {
      if (ids.length === 0) return this.unreadCount(userId);
      query = query.in('id', ids);
    }
    const { error } = await query;
    if (error) throw new InternalServerErrorException('Failed to mark notifications read');
    return this.unreadCount(userId);
  }
}
