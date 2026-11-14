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
  /** Whether the viewer can see their workouts, stats and lifts (their own, or following). */
  canSeeActivity: boolean;
  /** Finished workouts in all, and in the last 30 days. Null when the viewer can't see them. */
  stats: { workouts: number; lastThirtyDays: number } | null;
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

    const [followers, following] = await Promise.all([
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
    ]);
    if (followers.error || following.error) {
      throw new InternalServerErrorException('Failed to load follow counts');
    }

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

  private async workoutStats(
    personId: string,
    includeTrainerLogged: boolean,
  ): Promise<{ workouts: number; lastThirtyDays: number }> {
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
    const [all, recent] = await Promise.all([count(false), count(true)]);
    if (all.error || recent.error) throw new InternalServerErrorException('Failed to load stats');
    return { workouts: all.count ?? 0, lastThirtyDays: recent.count ?? 0 };
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
