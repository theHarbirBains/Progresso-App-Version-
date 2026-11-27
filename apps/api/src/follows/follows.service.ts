import {
  BadRequestException,
  ForbiddenException,
  Injectable,
  InternalServerErrorException,
  NotFoundException,
  Optional,
} from '@nestjs/common';
import { SocialPushService } from '../notifications/social-push.service';
import { isBlockedEitherWay, loadBlocks } from '../safety/blocks';
import { SupabaseService } from '../supabase/supabase.service';

export type FollowStatus = 'none' | 'pending' | 'accepted';

export interface FollowUserSummary {
  id: string;
  username: string | null;
  displayName: string | null;
  avatarUrl: string | null;
  /** Their profile is private (the default): only accepted followers see their training. Absent
   * where it isn't known. */
  isPrivate?: boolean;
}

export interface FollowRequestSummary {
  followId: string;
  user: FollowUserSummary;
  createdAt: string;
}

export interface FollowSearchResult {
  user: FollowUserSummary;
  status: FollowStatus;
}

export type FollowNotification =
  | {
      kind: 'request';
      followId: string;
      user: FollowUserSummary;
      at: string;
      /** Whether this user follows the requester already -- for Follow Back once accepted. */
      followingBack: FollowStatus;
    }
  | { kind: 'accepted'; followId: string; user: FollowUserSummary; at: string }
  | {
      /** Someone whose request this user accepted: "started following you", with Follow Back. */
      kind: 'follower';
      followId: string;
      user: FollowUserSummary;
      at: string;
      followingBack: FollowStatus;
    }
  | {
      kind: 'like';
      /** One per person per workout. */
      id: string;
      user: FollowUserSummary;
      workoutId: string;
      workoutName: string;
      at: string;
    }
  | {
      kind: 'comment';
      id: string;
      user: FollowUserSummary;
      workoutId: string;
      workoutName: string;
      body: string;
      at: string;
    };

const SEARCH_RESULT_LIMIT = 20;
const SUGGESTED_LIMIT = 20;
/** How far back an accepted request still counts as "recent" enough to notify about -- there's no read/unread tracking (no notifications table), so this window is what keeps the list from growing forever instead. */
const RECENTLY_ACCEPTED_WINDOW_DAYS = 14;

function toUserSummary(row: Record<string, unknown>): FollowUserSummary {
  return {
    id: row.id as string,
    username: (row.username as string | null) ?? null,
    displayName: (row.display_name as string | null) ?? null,
    avatarUrl: (row.avatar_url as string | null) ?? null,
    isPrivate:
      row.profile_visibility === undefined ? undefined : row.profile_visibility !== 'public',
  };
}

/**
 * A one-directional, accept-gated follow graph (see the follows migration).
 * Everything here is cross-user-trusted (who may accept a request, whose
 * activity a search result or feed may expose), so it all runs through the
 * service-role client rather than relying on client-side RLS -- matching
 * CLAUDE.md's hybrid backend pattern.
 */
/** Someone whose profile couldn't be read: their id, and nothing to show for them. */
function unknownUser(id: string): FollowUserSummary {
  return { id, username: null, displayName: null, avatarUrl: null };
}

@Injectable()
export class FollowsService {
  constructor(
    private readonly supabaseService: SupabaseService,
    // Pushes a follow request or an accept to the person it's for (when they want it).
    @Optional() private readonly socialPush?: SocialPushService,
  ) {}

  async sendRequest(followerId: string, followeeId: string): Promise<{ status: FollowStatus }> {
    if (followerId === followeeId) {
      throw new BadRequestException('You cannot follow yourself');
    }

    const client = this.supabaseService.getClient();

    // Only someone with an account: a trainer's tracked client or a group's guest (a stand-in
    // account no one signs in to) never finished signing up, and looks like no one at all.
    const { data: followee, error: followeeError } = await client
      .from('users')
      .select('id')
      .eq('id', followeeId)
      .not('onboarding_completed_at', 'is', null)
      .maybeSingle();
    if (followeeError) {
      throw new InternalServerErrorException('Failed to look up user');
    }
    if (!followee) {
      throw new NotFoundException('User not found');
    }

    // Someone who blocked you looks like no one at all; someone you blocked needs unblocking
    // first. The database refuses either follow too (follows_not_blocked).
    const blocks = await loadBlocks(client, followerId);
    if (blocks.blockedBy.has(followeeId)) {
      throw new NotFoundException('User not found');
    }
    if (blocks.blocked.has(followeeId)) {
      throw new BadRequestException("You've blocked this person. Unblock them to follow them.");
    }

    const { data: existing, error: existingError } = await client
      .from('follows')
      .select('status')
      .eq('follower_id', followerId)
      .eq('followee_id', followeeId)
      .maybeSingle();
    if (existingError) {
      throw new InternalServerErrorException('Failed to check existing follow state');
    }
    // Idempotent: re-requesting someone already pending/accepted just
    // reports their current state rather than erroring.
    if (existing) {
      return { status: existing.status as FollowStatus };
    }

    // A public profile's follow is accepted as it's written (follows_accept_public): what the row
    // became is the answer.
    const { data: inserted, error: insertError } = await client
      .from('follows')
      .insert({ follower_id: followerId, followee_id: followeeId, status: 'pending' })
      .select('id, status')
      .maybeSingle();
    if (insertError) {
      throw new InternalServerErrorException('Failed to send follow request');
    }
    const insertedRow = inserted as { id?: string; status?: FollowStatus } | null;
    const status: FollowStatus = insertedRow?.status === 'accepted' ? 'accepted' : 'pending';

    if (insertedRow?.id) {
      void this.pushFollow(
        followerId,
        followeeId,
        status === 'accepted' ? 'follower' : 'request',
        insertedRow.id,
      );
    }
    return { status };
  }

  async respondToRequest(
    userId: string,
    followId: string,
    action: 'accept' | 'reject',
  ): Promise<void> {
    const client = this.supabaseService.getClient();

    const { data: row, error: rowError } = await client
      .from('follows')
      .select('id, follower_id, followee_id, status')
      .eq('id', followId)
      .maybeSingle();
    if (rowError) {
      throw new InternalServerErrorException('Failed to look up follow request');
    }
    if (!row) {
      throw new NotFoundException('Follow request not found');
    }
    // Only the person being followed decides whether to accept -- never the
    // requester, and never a third party.
    if (row.followee_id !== userId) {
      throw new ForbiddenException('Only the recipient can respond to this request');
    }
    if (row.status !== 'pending') {
      throw new BadRequestException('This request has already been responded to');
    }

    if (action === 'accept') {
      const { error } = await client
        .from('follows')
        .update({ status: 'accepted', responded_at: new Date().toISOString() })
        .eq('id', followId);
      if (error) throw new InternalServerErrorException('Failed to accept follow request');
      void this.pushFollow(userId, row.follower_id as string, 'accepted', followId);
      return;
    }

    // Rejecting deletes the row entirely rather than leaving a 'rejected'
    // record -- same "no stale state" spirit as PR recomputation -- so the
    // requester is free to send a new request later without a dead row in
    // the way of the table's (follower_id, followee_id) uniqueness.
    const { error } = await client.from('follows').delete().eq('id', followId);
    if (error) throw new InternalServerErrorException('Failed to reject follow request');
  }

  /** Unfollows (or cancels a pending outgoing request to) followeeId. Idempotent -- no error if there was nothing to remove. */
  async unfollow(followerId: string, followeeId: string): Promise<void> {
    const { error } = await this.supabaseService
      .getClient()
      .from('follows')
      .delete()
      .eq('follower_id', followerId)
      .eq('followee_id', followeeId);
    if (error) throw new InternalServerErrorException('Failed to unfollow');
  }

  async listPendingRequests(userId: string): Promise<FollowRequestSummary[]> {
    const client = this.supabaseService.getClient();
    const { data: rows, error } = await client
      .from('follows')
      .select('id, follower_id, created_at')
      .eq('followee_id', userId)
      .eq('status', 'pending')
      .order('created_at', { ascending: false });
    if (error) throw new InternalServerErrorException('Failed to load follow requests');
    if (!rows || rows.length === 0) return [];

    const users = await this.fetchUserSummaries(
      client,
      rows.map((r) => r.follower_id as string),
    );
    return rows.map((r) => ({
      followId: r.id as string,
      createdAt: r.created_at as string,
      user: users.get(r.follower_id as string) ?? unknownUser(r.follower_id as string),
    }));
  }

  /**
   * Everything the notifications bell shows: incoming requests still
   * awaiting a response, the requests this user accepted (each a new
   * follower, with whether they follow back), plus requests this user sent
   * that were accepted -- both within the last `RECENTLY_ACCEPTED_WINDOW_DAYS`
   * days -- merged and sorted newest first. New followers only when asked
   * for (`followers`): an app that can't show them would show them wrong. Muscle-group staleness (the bell's other section) is
   * computed entirely client-side from the user's own workout history --
   * see apps/mobile/src/notifications -- since that's a same-user read with
   * no cross-user trust concern, unlike everything here.
   */
  async listNotifications(
    userId: string,
    { followers: withFollowers = false }: { followers?: boolean } = {},
  ): Promise<FollowNotification[]> {
    const [pending, accepted, activity, followers] = await Promise.all([
      this.listPendingRequests(userId),
      this.listRecentlyAccepted(userId),
      this.listRecentActivity(userId),
      withFollowers ? this.listRecentFollowers(userId) : Promise.resolve([]),
    ]);
    const followingBack = await this.followStatusesToward(userId, [
      ...pending.map((r) => r.user.id),
      ...followers.map((r) => r.user.id),
    ]);

    const items: FollowNotification[] = [
      ...pending.map((r) => ({
        kind: 'request' as const,
        followId: r.followId,
        user: r.user,
        at: r.createdAt,
        followingBack: followingBack.get(r.user.id) ?? 'none',
      })),
      ...followers.map((r) => ({
        kind: 'follower' as const,
        followId: r.followId,
        user: r.user,
        at: r.createdAt,
        followingBack: followingBack.get(r.user.id) ?? 'none',
      })),
      ...accepted.map((r) => ({
        kind: 'accepted' as const,
        followId: r.followId,
        user: r.user,
        at: r.createdAt,
      })),
      ...activity,
    ];
    items.sort((a, b) => new Date(b.at).getTime() - new Date(a.at).getTime());
    return items;
  }

  /**
   * Likes and comments others left on this person's workouts in the same recent window --
   * never their own, and nothing from someone blocked either way.
   */
  private async listRecentActivity(userId: string): Promise<FollowNotification[]> {
    const client = this.supabaseService.getClient();
    const since = new Date(
      Date.now() - RECENTLY_ACCEPTED_WINDOW_DAYS * 24 * 60 * 60 * 1000,
    ).toISOString();
    const { data: workouts, error } = await client
      .from('workouts')
      .select('id, name')
      .eq('user_id', userId)
      .is('deleted_at', null)
      .not('completed_at', 'is', null)
      .gte('performed_at', new Date(Date.now() - 90 * 24 * 60 * 60 * 1000).toISOString());
    if (error) throw new InternalServerErrorException('Failed to load your activity');
    const names = new Map(
      ((workouts ?? []) as { id: string; name: string }[]).map((w) => [w.id, w.name]),
    );
    if (names.size === 0) return [];
    const ids = Array.from(names.keys());
    const [likes, comments, blocks] = await Promise.all([
      client
        .from('workout_likes')
        .select('workout_id, user_id, created_at')
        .in('workout_id', ids)
        .neq('user_id', userId)
        .gte('created_at', since),
      client
        .from('workout_comments')
        .select('id, workout_id, user_id, body, created_at')
        .in('workout_id', ids)
        .neq('user_id', userId)
        .gte('created_at', since),
      loadBlocks(client, userId),
    ]);
    if (likes.error || comments.error) {
      throw new InternalServerErrorException('Failed to load your activity');
    }
    const likeRows = (
      (likes.data ?? []) as {
        workout_id: string;
        user_id: string;
        created_at: string;
      }[]
    ).filter((row) => !isBlockedEitherWay(blocks, row.user_id));
    const commentRows = (
      (comments.data ?? []) as {
        id: string;
        workout_id: string;
        user_id: string;
        body: string;
        created_at: string;
      }[]
    ).filter((row) => !isBlockedEitherWay(blocks, row.user_id));
    const users = await this.fetchUserSummaries(client, [
      ...likeRows.map((row) => row.user_id),
      ...commentRows.map((row) => row.user_id),
    ]);
    return [
      ...likeRows.map((row) => ({
        kind: 'like' as const,
        id: `${row.workout_id}:${row.user_id}`,
        user: users.get(row.user_id) ?? unknownUser(row.user_id),
        workoutId: row.workout_id,
        workoutName: names.get(row.workout_id) ?? 'Workout',
        at: row.created_at,
      })),
      ...commentRows.map((row) => ({
        kind: 'comment' as const,
        id: row.id,
        user: users.get(row.user_id) ?? unknownUser(row.user_id),
        workoutId: row.workout_id,
        workoutName: names.get(row.workout_id) ?? 'Workout',
        body: row.body,
        at: row.created_at,
      })),
    ];
  }

  /** A follow request, a request accepted, or a new follower of a public profile: recorded for
   * the other person and pushed to them (SocialPushService). */
  private async pushFollow(
    fromId: string,
    toId: string,
    what: 'request' | 'accepted' | 'follower',
    followId: string,
  ) {
    if (!this.socialPush) return;
    await this.socialPush.record({
      type:
        what === 'request'
          ? 'follow_request'
          : what === 'follower'
            ? 'new_follower'
            : 'follow_accepted',
      recipientId: toId,
      actorId: fromId,
      followId,
    });
  }

  /** The people whose requests this user accepted recently -- their newest followers. */
  private async listRecentFollowers(userId: string): Promise<FollowRequestSummary[]> {
    const client = this.supabaseService.getClient();
    const since = new Date(
      Date.now() - RECENTLY_ACCEPTED_WINDOW_DAYS * 24 * 60 * 60 * 1000,
    ).toISOString();

    const { data: rows, error } = await client
      .from('follows')
      .select('id, follower_id, responded_at')
      .eq('followee_id', userId)
      .eq('status', 'accepted')
      .gte('responded_at', since)
      .order('responded_at', { ascending: false });
    if (error) throw new InternalServerErrorException('Failed to load your new followers');
    if (!rows || rows.length === 0) return [];

    const users = await this.fetchUserSummaries(
      client,
      rows.map((r) => r.follower_id as string),
    );
    return rows.map((r) => ({
      followId: r.id as string,
      createdAt: r.responded_at as string,
      user: users.get(r.follower_id as string) ?? unknownUser(r.follower_id as string),
    }));
  }

  /** How this user follows each of these people: pending or accepted (absent is none). */
  private async followStatusesToward(
    userId: string,
    ids: string[],
  ): Promise<Map<string, FollowStatus>> {
    if (ids.length === 0) return new Map();
    const { data: rows, error } = await this.supabaseService
      .getClient()
      .from('follows')
      .select('followee_id, status')
      .eq('follower_id', userId)
      .in('followee_id', Array.from(new Set(ids)));
    if (error) throw new InternalServerErrorException('Failed to load who you follow');
    return new Map(
      ((rows ?? []) as { followee_id: string; status: FollowStatus }[]).map((r) => [
        r.followee_id,
        r.status,
      ]),
    );
  }

  private async listRecentlyAccepted(userId: string): Promise<FollowRequestSummary[]> {
    const client = this.supabaseService.getClient();
    const since = new Date(
      Date.now() - RECENTLY_ACCEPTED_WINDOW_DAYS * 24 * 60 * 60 * 1000,
    ).toISOString();

    const { data: rows, error } = await client
      .from('follows')
      .select('id, followee_id, responded_at')
      .eq('follower_id', userId)
      .eq('status', 'accepted')
      .gte('responded_at', since)
      .order('responded_at', { ascending: false });
    if (error) throw new InternalServerErrorException('Failed to load recently accepted follows');
    if (!rows || rows.length === 0) return [];

    const users = await this.fetchUserSummaries(
      client,
      rows.map((r) => r.followee_id as string),
    );
    return rows.map((r) => ({
      followId: r.id as string,
      createdAt: r.responded_at as string,
      user: users.get(r.followee_id as string) ?? unknownUser(r.followee_id as string),
    }));
  }

  /** Accepted followees -- the people whose activity feeds into this user's Friends feed. */
  async listFollowing(userId: string): Promise<FollowUserSummary[]> {
    const client = this.supabaseService.getClient();
    const { data: rows, error } = await client
      .from('follows')
      .select('followee_id')
      .eq('follower_id', userId)
      .eq('status', 'accepted');
    if (error) throw new InternalServerErrorException('Failed to load following list');
    if (!rows || rows.length === 0) return [];

    const users = await this.fetchUserSummaries(
      client,
      rows.map((r) => r.followee_id as string),
    );
    return rows
      .map((r) => users.get(r.followee_id as string))
      .filter((u): u is FollowUserSummary => u !== undefined);
  }

  /** Just the accepted followee ids -- used by FeedService, no profile fields needed. */
  async listAcceptedFolloweeIds(userId: string): Promise<string[]> {
    const { data: rows, error } = await this.supabaseService
      .getClient()
      .from('follows')
      .select('followee_id')
      .eq('follower_id', userId)
      .eq('status', 'accepted');
    if (error) throw new InternalServerErrorException('Failed to load following list');
    return (rows ?? []).map((r) => r.followee_id as string);
  }

  async search(userId: string, query: string): Promise<FollowSearchResult[]> {
    const client = this.supabaseService.getClient();
    const pattern = `%${query}%`;

    // Two separate ilike queries rather than a single .or(...) filter string
    // -- a display name can contain commas/parentheses, which would corrupt
    // PostgREST's .or() filter syntax if interpolated into it directly. Only
    // people who finished signing up: a trainer's tracked client or a group's
    // guest has a name but no account of their own.
    const [byUsername, byDisplayName, blocks] = await Promise.all([
      client
        .from('users')
        .select('id, username, display_name, avatar_url, profile_visibility')
        .ilike('username', pattern)
        .neq('id', userId)
        .not('onboarding_completed_at', 'is', null)
        .limit(SEARCH_RESULT_LIMIT),
      client
        .from('users')
        .select('id, username, display_name, avatar_url, profile_visibility')
        .ilike('display_name', pattern)
        .neq('id', userId)
        .not('onboarding_completed_at', 'is', null)
        .limit(SEARCH_RESULT_LIMIT),
      loadBlocks(client, userId),
    ]);
    if (byUsername.error || byDisplayName.error) {
      throw new InternalServerErrorException('Failed to search users');
    }

    const dedup = new Map<string, Record<string, unknown>>();
    for (const row of [...(byUsername.data ?? []), ...(byDisplayName.data ?? [])]) {
      // Nobody you blocked, or who blocked you, turns up.
      if (isBlockedEitherWay(blocks, row.id as string)) continue;
      dedup.set(row.id as string, row);
    }
    const results = Array.from(dedup.values()).slice(0, SEARCH_RESULT_LIMIT);
    if (results.length === 0) return [];

    const { data: followRows, error: followError } = await client
      .from('follows')
      .select('followee_id, status')
      .eq('follower_id', userId)
      .in(
        'followee_id',
        results.map((r) => r.id as string),
      );
    if (followError) throw new InternalServerErrorException('Failed to load follow status');

    const statusByUserId = new Map<string, FollowStatus>();
    for (const row of followRows ?? []) {
      statusByUserId.set(row.followee_id as string, row.status as FollowStatus);
    }

    return results.map((row) => ({
      user: toUserSummary(row),
      status: statusByUserId.get(row.id as string) ?? 'none',
    }));
  }

  /**
   * "N athletes to follow" -- other users you have no existing follow row
   * toward at all (never followed, never requested), most-recently-joined
   * first. There's no mutual-connections graph to rank by yet, so recency
   * is the one honest signal available -- not a fabricated "you may know"
   * algorithm.
   */
  async listSuggested(userId: string): Promise<FollowSearchResult[]> {
    const client = this.supabaseService.getClient();

    const [{ data: existingRows, error: existingError }, blocks] = await Promise.all([
      client.from('follows').select('followee_id').eq('follower_id', userId),
      loadBlocks(client, userId),
    ]);
    if (existingError) throw new InternalServerErrorException('Failed to load suggested users');
    // Nobody already followed or requested, and nobody blocked either way.
    const excluded = new Set([
      ...(existingRows ?? []).map((r) => r.followee_id as string),
      ...blocks.blocked,
      ...blocks.blockedBy,
    ]);

    // Overfetch by the excluded count and filter in-memory rather than a
    // PostgREST .not('id', 'in', ...) filter -- simpler and avoids that
    // filter's fragile parenthesized-list string format for a set that's
    // typically small anyway.
    // Only people with an account (see search).
    const { data, error } = await client
      .from('users')
      .select('id, username, display_name, avatar_url, profile_visibility')
      .neq('id', userId)
      .not('onboarding_completed_at', 'is', null)
      .order('created_at', { ascending: false })
      .limit(SUGGESTED_LIMIT + excluded.size);
    if (error) throw new InternalServerErrorException('Failed to load suggested users');

    const results = (data ?? [])
      .filter((row) => !excluded.has(row.id as string))
      .slice(0, SUGGESTED_LIMIT);

    // By construction every result here has no existing follow row from
    // this user, so the status is always 'none' -- no second query needed
    // (unlike search(), which can't assume that).
    return results.map((row) => ({ user: toUserSummary(row), status: 'none' as const }));
  }

  /** Batch-fetches public profile fields for a list of user ids -- shared with FeedService, which annotates friends'-feed items with their author's name/avatar the same way. */
  async getUserSummaries(userIds: string[]): Promise<Map<string, FollowUserSummary>> {
    return this.fetchUserSummaries(this.supabaseService.getClient(), userIds);
  }

  private async fetchUserSummaries(
    client: ReturnType<SupabaseService['getClient']>,
    userIds: string[],
  ): Promise<Map<string, FollowUserSummary>> {
    const uniqueIds = Array.from(new Set(userIds));
    if (uniqueIds.length === 0) return new Map();

    const { data, error } = await client
      .from('users')
      .select('id, username, display_name, avatar_url, profile_visibility')
      .in('id', uniqueIds);
    if (error) throw new InternalServerErrorException('Failed to load user profiles');

    const map = new Map<string, FollowUserSummary>();
    for (const row of data ?? []) {
      map.set(row.id as string, toUserSummary(row));
    }
    return map;
  }
}
