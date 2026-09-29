import {
  BadRequestException,
  ForbiddenException,
  Injectable,
  InternalServerErrorException,
  NotFoundException,
} from '@nestjs/common';
import { SupabaseService } from '../supabase/supabase.service';

export type FollowStatus = 'none' | 'pending' | 'accepted';

export interface FollowUserSummary {
  id: string;
  username: string | null;
  displayName: string | null;
  avatarUrl: string | null;
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
  | { kind: 'request'; followId: string; user: FollowUserSummary; at: string }
  | { kind: 'accepted'; followId: string; user: FollowUserSummary; at: string };

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
  };
}

/**
 * A one-directional, accept-gated follow graph (see the follows migration).
 * Everything here is cross-user-trusted (who may accept a request, whose
 * activity a search result or feed may expose), so it all runs through the
 * service-role client rather than relying on client-side RLS -- matching
 * CLAUDE.md's hybrid backend pattern.
 */
@Injectable()
export class FollowsService {
  constructor(private readonly supabaseService: SupabaseService) {}

  async sendRequest(followerId: string, followeeId: string): Promise<{ status: FollowStatus }> {
    if (followerId === followeeId) {
      throw new BadRequestException('You cannot follow yourself');
    }

    const client = this.supabaseService.getClient();

    const { data: followee, error: followeeError } = await client
      .from('users')
      .select('id')
      .eq('id', followeeId)
      .maybeSingle();
    if (followeeError) {
      throw new InternalServerErrorException('Failed to look up user');
    }
    if (!followee) {
      throw new NotFoundException('User not found');
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

    const { error: insertError } = await client
      .from('follows')
      .insert({ follower_id: followerId, followee_id: followeeId, status: 'pending' });
    if (insertError) {
      throw new InternalServerErrorException('Failed to send follow request');
    }

    return { status: 'pending' };
  }

  async respondToRequest(
    userId: string,
    followId: string,
    action: 'accept' | 'reject',
  ): Promise<void> {
    const client = this.supabaseService.getClient();

    const { data: row, error: rowError } = await client
      .from('follows')
      .select('id, followee_id, status')
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
      user: users.get(r.follower_id as string) ?? {
        id: r.follower_id as string,
        username: null,
        displayName: null,
        avatarUrl: null,
      },
    }));
  }

  /**
   * Everything the notifications bell shows: incoming requests still
   * awaiting a response, plus requests this user sent that were accepted
   * within the last `RECENTLY_ACCEPTED_WINDOW_DAYS` days, merged and sorted
   * newest first. Muscle-group staleness (the bell's other section) is
   * computed entirely client-side from the user's own workout history --
   * see apps/mobile/src/notifications -- since that's a same-user read with
   * no cross-user trust concern, unlike everything here.
   */
  async listNotifications(userId: string): Promise<FollowNotification[]> {
    const [pending, accepted] = await Promise.all([
      this.listPendingRequests(userId),
      this.listRecentlyAccepted(userId),
    ]);

    const items: FollowNotification[] = [
      ...pending.map((r) => ({ kind: 'request' as const, followId: r.followId, user: r.user, at: r.createdAt })),
      ...accepted.map((r) => ({ kind: 'accepted' as const, followId: r.followId, user: r.user, at: r.createdAt })),
    ];
    items.sort((a, b) => new Date(b.at).getTime() - new Date(a.at).getTime());
    return items;
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
      user: users.get(r.followee_id as string) ?? {
        id: r.followee_id as string,
        username: null,
        displayName: null,
        avatarUrl: null,
      },
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
    // PostgREST's .or() filter syntax if interpolated into it directly.
    const [byUsername, byDisplayName] = await Promise.all([
      client
        .from('users')
        .select('id, username, display_name, avatar_url')
        .ilike('username', pattern)
        .neq('id', userId)
        .limit(SEARCH_RESULT_LIMIT),
      client
        .from('users')
        .select('id, username, display_name, avatar_url')
        .ilike('display_name', pattern)
        .neq('id', userId)
        .limit(SEARCH_RESULT_LIMIT),
    ]);
    if (byUsername.error || byDisplayName.error) {
      throw new InternalServerErrorException('Failed to search users');
    }

    const dedup = new Map<string, Record<string, unknown>>();
    for (const row of [...(byUsername.data ?? []), ...(byDisplayName.data ?? [])]) {
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

    const { data: existingRows, error: existingError } = await client
      .from('follows')
      .select('followee_id')
      .eq('follower_id', userId);
    if (existingError) throw new InternalServerErrorException('Failed to load suggested users');
    const excluded = new Set((existingRows ?? []).map((r) => r.followee_id as string));

    // Overfetch by the excluded count and filter in-memory rather than a
    // PostgREST .not('id', 'in', ...) filter -- simpler and avoids that
    // filter's fragile parenthesized-list string format for a set that's
    // typically small anyway.
    const { data, error } = await client
      .from('users')
      .select('id, username, display_name, avatar_url')
      .neq('id', userId)
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
      .select('id, username, display_name, avatar_url')
      .in('id', uniqueIds);
    if (error) throw new InternalServerErrorException('Failed to load user profiles');

    const map = new Map<string, FollowUserSummary>();
    for (const row of data ?? []) {
      map.set(row.id as string, toUserSummary(row));
    }
    return map;
  }
}
