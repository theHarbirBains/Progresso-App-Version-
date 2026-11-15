import {
  ForbiddenException,
  Injectable,
  InternalServerErrorException,
  NotFoundException,
} from '@nestjs/common';
import { FeedService, type FeedPage } from '../feed/feed.service';
import {
  FollowsService,
  type FollowSearchResult,
  type FollowStatus,
  type FollowUserSummary,
} from '../follows/follows.service';
import { isBlockedEitherWay, loadBlocks } from '../safety/blocks';
import { SupabaseService } from '../supabase/supabase.service';
import { canSeeActivity, relationshipWith } from './relationship';

/** How many heaviest lifts a profile shows. */
const BEST_LIFTS = 5;
const LAST_DAYS = 30;
/** How many mutual friends a profile lists (the count is all of them). */
const MUTUALS = 50;

export interface ProfileStats {
  /** Finished workouts in all, and in the last 30 days. */
  workouts: number;
  lastThirtyDays: number;
  /** Everything lifted: each finished weighted set's weight x reps. */
  totalVolumeKg: number;
  /** Rep-count PRs and true 1RMs held now. */
  prCount: number;
  /** The most workouts finished in one calendar month. */
  bestMonthWorkouts: number;
}

export interface BestLift {
  exerciseId: string;
  exerciseName: string;
  photoUrl: string | null;
  gym: string | null;
  attachment: string | null;
  weightKg: number;
  reps: number;
  performedAt: string;
}

export interface PersonProfile {
  user: FollowUserSummary;
  isSelf: boolean;
  /** The viewer's follow of them. */
  followStatus: FollowStatus;
  /** Their accepted follow of the viewer. */
  followsYou: boolean;
  /** Their request to follow the viewer, to answer from their profile. */
  requestId: string | null;
  followerCount: number;
  followingCount: number;
  /** A line about themselves, for anyone who opens their profile -- null with none. */
  bio: string | null;
  /** The people the viewer follows who follow them too (none on their own profile). */
  mutuals: { count: number; people: FollowUserSummary[] };
  /** Whether the viewer can see their workouts, stats and lifts (their own, or following). */
  canSeeActivity: boolean;
  /** Their workout figures. Null when the viewer can't see them. */
  stats: ProfileStats | null;
  /** Each weighted exercise's heaviest set, heaviest first. Null when the viewer can't see it. */
  bestLifts: BestLift[] | null;
}

/**
 * Other people's profiles: who they are, who follows them, and -- for someone the viewer follows
 * (accepted), or the viewer themselves -- their workouts, stats and heaviest lifts, from the
 * workouts their followers can see (finished, not deleted, not logged by a trainer). Finding
 * friends from contacts lives here too. Everyone blocked either way is left out, and a person
 * who blocked the viewer can't be opened at all.
 */
@Injectable()
export class PeopleService {
  constructor(
    private readonly supabaseService: SupabaseService,
    private readonly followsService: FollowsService,
    private readonly feedService: FeedService,
  ) {}

  async getProfile(viewerId: string, personId: string): Promise<PersonProfile> {
    const client = this.supabaseService.getClient();
    const relationship = await relationshipWith(client, viewerId, personId);
    const users = await this.followsService.getUserSummaries([personId]);
    const user = users.get(personId);
    if (!user) throw new NotFoundException('User not found');

    const [followers, following, about, mutuals] = await Promise.all([
      client
        .from('follows')
        .select('id', { count: 'exact', head: true })
        .eq('followee_id', personId)
        .eq('status', 'accepted'),
      client
        .from('follows')
        .select('id', { count: 'exact', head: true })
        .eq('follower_id', personId)
        .eq('status', 'accepted'),
      client.from('users').select('bio').eq('id', personId).maybeSingle(),
      relationship.isSelf
        ? Promise.resolve({ count: 0, people: [] })
        : this.mutualFriends(viewerId, personId),
    ]);
    if (followers.error || following.error) {
      throw new InternalServerErrorException('Failed to load follow counts');
    }
    if (about.error) throw new InternalServerErrorException('Failed to load profile');
    const aboutRow = about.data as { bio: string | null } | null;

    const visible = canSeeActivity(relationship);
    const [stats, bestLifts] = visible
      ? await Promise.all([
          this.workoutStats(personId, relationship.isSelf),
          this.bestLifts(personId),
        ])
      : [null, null];

    return {
      user,
      ...relationship,
      followerCount: followers.count ?? 0,
      followingCount: following.count ?? 0,
      bio: aboutRow?.bio ?? null,
      mutuals,
      canSeeActivity: visible,
      stats,
      bestLifts,
    };
  }

  async getWorkouts(viewerId: string, personId: string, page: number): Promise<FeedPage> {
    const relationship = await relationshipWith(
      this.supabaseService.getClient(),
      viewerId,
      personId,
    );
    if (!canSeeActivity(relationship)) {
      throw new ForbiddenException('Follow them to see their workouts');
    }
    return this.feedService.getPersonWorkouts(personId, page, {
      includeTrainerLogged: relationship.isSelf,
    });
  }

  /** Who follows this person, each with the viewer's own follow of them. */
  async listFollowers(viewerId: string, personId: string): Promise<FollowSearchResult[]> {
    return this.listConnections(viewerId, personId, 'followers');
  }

  /** Who this person follows, each with the viewer's own follow of them. */
  async listFollowing(viewerId: string, personId: string): Promise<FollowSearchResult[]> {
    return this.listConnections(viewerId, personId, 'following');
  }

  /**
   * The people whose email is in the viewer's contacts (as SHA-256 hashes of the trimmed,
   * lower-cased address -- the phone never sends an address) and who let themselves be found
   * that way. Nothing sent is kept.
   */
  async matchContacts(viewerId: string, hashes: string[]): Promise<FollowSearchResult[]> {
    const wanted = Array.from(new Set(hashes.map((hash) => hash.toLowerCase())));
    if (wanted.length === 0) return [];
    const client = this.supabaseService.getClient();
    const { data, error } = await client.rpc('find_users_by_email_hashes', { p_hashes: wanted });
    if (error) throw new InternalServerErrorException('Failed to match your contacts');
    const ids = ((data ?? []) as { user_id: string }[])
      .map((row) => row.user_id)
      .filter((id) => id !== viewerId);
    return this.withFollowStatus(viewerId, ids);
  }

  private async listConnections(
    viewerId: string,
    personId: string,
    which: 'followers' | 'following',
  ): Promise<FollowSearchResult[]> {
    const client = this.supabaseService.getClient();
    const relationship = await relationshipWith(client, viewerId, personId);
    if (!canSeeActivity(relationship)) {
      throw new ForbiddenException('Follow them to see who they follow');
    }
    const { data, error } = await client
      .from('follows')
      .select(which === 'followers' ? 'follower_id' : 'followee_id')
      .eq(which === 'followers' ? 'followee_id' : 'follower_id', personId)
      .eq('status', 'accepted')
      .order('created_at', { ascending: false });
    if (error) throw new InternalServerErrorException('Failed to load follows');
    const ids = ((data ?? []) as unknown as { follower_id?: string; followee_id?: string }[])
      .map((row) => (which === 'followers' ? row.follower_id : row.followee_id))
      .filter((id): id is string => typeof id === 'string');
    return this.withFollowStatus(viewerId, ids);
  }

  /** These people (less anyone blocked either way), each with the viewer's follow of them. */
  private async withFollowStatus(viewerId: string, ids: string[]): Promise<FollowSearchResult[]> {
    if (ids.length === 0) return [];
    const client = this.supabaseService.getClient();
    const [blocks, users, follows] = await Promise.all([
      loadBlocks(client, viewerId),
      this.followsService.getUserSummaries(ids),
      client
        .from('follows')
        .select('followee_id, status')
        .eq('follower_id', viewerId)
        .in('followee_id', ids),
    ]);
    if (follows.error) throw new InternalServerErrorException('Failed to load follow status');
    const status = new Map(
      ((follows.data ?? []) as { followee_id: string; status: FollowStatus }[]).map((row) => [
        row.followee_id,
        row.status,
      ]),
    );
    return ids
      .filter((id) => !isBlockedEitherWay(blocks, id))
      .map((id) => users.get(id))
      .filter((user): user is FollowUserSummary => user !== undefined)
      .map((user) => ({
        user,
        status: user.id === viewerId ? 'none' : (status.get(user.id) ?? 'none'),
      }));
  }

  /**
   * The people the viewer follows (accepted) who follow this person too (accepted), less anyone
   * blocked either way -- the newest follows first.
   */
  private async mutualFriends(
    viewerId: string,
    personId: string,
  ): Promise<{ count: number; people: FollowUserSummary[] }> {
    const client = this.supabaseService.getClient();
    const { data: followed, error } = await client
      .from('follows')
      .select('followee_id')
      .eq('follower_id', viewerId)
      .eq('status', 'accepted');
    if (error) throw new InternalServerErrorException('Failed to load mutual friends');
    const viewerFollows = ((followed ?? []) as { followee_id: string }[])
      .map((row) => row.followee_id)
      .filter((id) => id !== personId);
    if (viewerFollows.length === 0) return { count: 0, people: [] };
    const [{ data: theirs, error: theirsError }, blocks] = await Promise.all([
      client
        .from('follows')
        .select('follower_id')
        .eq('followee_id', personId)
        .eq('status', 'accepted')
        .in('follower_id', viewerFollows)
        .order('created_at', { ascending: false }),
      loadBlocks(client, viewerId),
    ]);
    if (theirsError) throw new InternalServerErrorException('Failed to load mutual friends');
    const ids = ((theirs ?? []) as { follower_id: string }[])
      .map((row) => row.follower_id)
      .filter((id) => !isBlockedEitherWay(blocks, id));
    const users = await this.followsService.getUserSummaries(ids.slice(0, MUTUALS));
    return {
      count: ids.length,
      people: ids
        .slice(0, MUTUALS)
        .map((id) => users.get(id))
        .filter((user): user is FollowUserSummary => user !== undefined),
    };
  }

  private async workoutStats(
    personId: string,
    includeTrainerLogged: boolean,
  ): Promise<ProfileStats> {
    const client = this.supabaseService.getClient();
    const since = new Date(Date.now() - LAST_DAYS * 24 * 60 * 60 * 1000).toISOString();
    const count = (recent: boolean) => {
      let query = client
        .from('workouts')
        .select('id', { count: 'exact', head: true })
        .eq('user_id', personId)
        .not('completed_at', 'is', null)
        .is('deleted_at', null);
      if (!includeTrainerLogged) query = query.is('logged_by', null);
      if (recent) query = query.gte('performed_at', since);
      return query;
    };
    const [all, recent, totals] = await Promise.all([
      count(false),
      count(true),
      client.rpc('person_profile_totals', {
        p_owner: personId,
        p_include_trainer_logged: includeTrainerLogged,
      }),
    ]);
    if (all.error || recent.error || totals.error) {
      throw new InternalServerErrorException('Failed to load stats');
    }
    const row = (
      (totals.data ?? []) as {
        total_volume_kg: string | number;
        pr_count: number;
        best_month_workouts: number;
      }[]
    )[0];
    return {
      workouts: all.count ?? 0,
      lastThirtyDays: recent.count ?? 0,
      totalVolumeKg: Number(row?.total_volume_kg ?? 0),
      prCount: row?.pr_count ?? 0,
      bestMonthWorkouts: row?.best_month_workouts ?? 0,
    };
  }

  private async bestLifts(personId: string): Promise<BestLift[]> {
    const client = this.supabaseService.getClient();
    const { data, error } = await client.rpc('person_best_lifts', {
      p_owner: personId,
      p_limit: BEST_LIFTS,
    });
    if (error) throw new InternalServerErrorException('Failed to load lifts');
    const rows = (data ?? []) as {
      exercise_id: string;
      weight_kg: string | number;
      reps: number;
      performed_at: string;
    }[];
    if (rows.length === 0) return [];
    const { data: exercises, error: exercisesError } = await client
      .from('exercises')
      .select('id, name, photo_url, gym, attachment')
      .in(
        'id',
        rows.map((row) => row.exercise_id),
      );
    if (exercisesError) throw new InternalServerErrorException('Failed to load lifts');
    const byId = new Map(
      (
        (exercises ?? []) as {
          id: string;
          name: string;
          photo_url: string | null;
          gym: string | null;
          attachment: string | null;
        }[]
      ).map((exercise) => [exercise.id, exercise]),
    );
    return rows.map((row) => {
      const exercise = byId.get(row.exercise_id);
      return {
        exerciseId: row.exercise_id,
        exerciseName: exercise?.name ?? 'Exercise',
        photoUrl: exercise?.photo_url ?? null,
        gym: exercise?.gym ?? null,
        attachment: exercise?.attachment ?? null,
        weightKg: Number(row.weight_kg),
        reps: row.reps,
        performedAt: row.performed_at,
      };
    });
  }
}
