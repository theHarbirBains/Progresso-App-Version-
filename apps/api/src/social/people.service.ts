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

/** How many heaviest lifts a profile's `bestLifts` holds (app versions before every exercise). */
const BEST_LIFTS = 5;
/** How many of an exercise's top sets its page lists, newest first. */
const TOP_SETS = 100;
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
  // What their achievements are ranked on (apps/mobile/src/social/achievements.ts).
  /** Finished sets, of every kind. */
  totalSets: number;
  /** Reps on weighted and bodyweight sets. */
  totalReps: number;
  /** Time trained, start to finish -- at most six hours a workout. */
  trainingMinutes: number;
  /** True 1RMs held now. */
  oneRepMaxCount: number;
  /** Different exercises done. */
  exerciseCount: number;
  /** The most lifted in one workout. */
  bestSessionVolumeKg: number;
  bodyweightReps: number;
  timedSeconds: number;
  groupWorkouts: number;
  /** Calendar months with 12 or more workouts. */
  committedMonths: number;
  /** Weeks with 3 or more workouts. */
  strongWeeks: number;
  /** Likes from others on their workouts, and likes they've given others'. */
  likesReceived: number;
  likesGiven: number;
}

export type MeasurementType = 'weight_reps' | 'bodyweight' | 'timed';

/** An exercise as a profile shows it: what it is, which machine, and what its sets record. */
export interface ExerciseSummary {
  exerciseId: string;
  exerciseName: string;
  photoUrl: string | null;
  gym: string | null;
  attachment: string | null;
  measurementType: MeasurementType;
}

/**
 * An exercise they've done, with its best set: the heaviest (weightKg x reps) for weights, the
 * most reps for bodyweight, the longest (durationSeconds) for timed.
 */
export interface ExerciseBest extends ExerciseSummary {
  weightKg: number | null;
  reps: number | null;
  durationSeconds: number | null;
  performedAt: string;
  /** How many workouts it's in. */
  workouts: number;
  lastPerformedAt: string;
}

/** A workout's top set on one exercise. */
export interface TopSet {
  workoutId: string;
  performedAt: string;
  weightKg: number | null;
  reps: number | null;
  durationSeconds: number | null;
}

/** Their lifetime Achievement Points and how many awards make them up. */
export interface PersonRank {
  points: number;
  awards: number;
}

/** An achievement they've earned, as their profile lists it -- never a nutrition one. */
export interface EarnedAchievement {
  id: string;
  title: string;
  description: string;
  icon: string;
  category: string;
  kind: 'single' | 'levels';
  /** The level they've reached, out of how many there are (1 of 1 for a single unlock). */
  level: number;
  levels: number;
  /** The AP every level they've reached has brought. */
  ap: number;
  firstAwardedAt: string;
  lastAwardedAt: string;
}

/** One exercise of theirs: each workout's top set, newest first, and the records they hold. */
export interface PersonExercise {
  exercise: ExerciseSummary;
  topSets: TopSet[];
  /** The heaviest at each rep count from 2 up, fewest reps first. */
  repPRs: { reps: number; weightKg: number; achievedAt: string }[];
  /** True 1RM: only ever a logged single. */
  oneRepMax: { weightKg: number; achievedAt: string } | null;
  mostReps: { reps: number; achievedAt: string } | null;
  longest: { durationSeconds: number; achievedAt: string } | null;
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
  /** The heaviest few weighted lifts, heaviest first -- for app versions before `exercises`. */
  bestLifts: BestLift[] | null;
  /** Every exercise they've done, with its best set, the most-done first. Null when hidden. */
  exercises: ExerciseBest[] | null;
  /**
   * Their lifetime AP, for their rank -- shown to anyone who can open their profile unless they
   * hide it (Settings > Privacy); always on their own.
   */
  rank: PersonRank | null;
  /** The achievements they've earned, the latest first -- only when the viewer can see activity. */
  achievements: EarnedAchievement[] | null;
}

/**
 * Other people's profiles: who they are, who follows them, and -- for someone the viewer follows
 * (accepted), or the viewer themselves -- their workouts, stats, and every exercise's best set,
 * top sets and records, from the workouts their followers can see (finished, not deleted, not
 * logged by a trainer -- their own count those too). Finding
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
      client.from('users').select('bio, show_rank').eq('id', personId).maybeSingle(),
      relationship.isSelf
        ? Promise.resolve({ count: 0, people: [] })
        : this.mutualFriends(viewerId, personId),
    ]);
    if (followers.error || following.error) {
      throw new InternalServerErrorException('Failed to load follow counts');
    }
    if (about.error) throw new InternalServerErrorException('Failed to load profile');
    const aboutRow = about.data as { bio: string | null; show_rank: boolean | null } | null;

    const visible = canSeeActivity(relationship);
    const showsRank = relationship.isSelf || aboutRow?.show_rank !== false;
    const [stats, exercises, achievements, rank] = await Promise.all([
      visible ? this.workoutStats(personId, relationship.isSelf) : null,
      visible ? this.exerciseBests(personId, relationship.isSelf) : null,
      visible ? this.earnedAchievements(personId) : null,
      showsRank ? this.rankOf(personId) : null,
    ]);

    return {
      user,
      ...relationship,
      followerCount: followers.count ?? 0,
      followingCount: following.count ?? 0,
      bio: aboutRow?.bio ?? null,
      mutuals,
      canSeeActivity: visible,
      stats,
      bestLifts: exercises ? heaviestLifts(exercises) : null,
      exercises,
      rank,
      achievements,
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

  /**
   * One exercise of theirs, for someone the viewer follows (accepted) or the viewer: its top set
   * from each workout that counts, newest first, and the records they hold on it.
   */
  async getExercise(
    viewerId: string,
    personId: string,
    exerciseId: string,
  ): Promise<PersonExercise> {
    const client = this.supabaseService.getClient();
    const relationship = await relationshipWith(client, viewerId, personId);
    if (!canSeeActivity(relationship)) {
      throw new ForbiddenException('Follow them to see their lifts');
    }
    const args = {
      p_owner: personId,
      p_exercise: exerciseId,
      p_include_trainer_logged: relationship.isSelf,
    };
    const [history, records] = await Promise.all([
      client.rpc('person_exercise_history', { ...args, p_limit: TOP_SETS }),
      client.rpc('person_exercise_records', args),
    ]);
    if (history.error || records.error) {
      throw new InternalServerErrorException('Failed to load this exercise');
    }
    const sets = (history.data ?? []) as {
      workout_id: string;
      performed_at: string;
      measurement_type: MeasurementType;
      weight_kg: string | number | null;
      reps: number | null;
      duration_seconds: number | null;
    }[];
    // Only an exercise they've done, from a workout that counts, is theirs to show.
    const latest = sets[0];
    if (!latest) throw new NotFoundException('Exercise not found');
    const [exercise] = await this.exerciseSummaries([
      { id: exerciseId, measurementType: latest.measurement_type },
    ]);
    const held = (records.data ?? []) as {
      kind: 'rep' | 'max' | 'most_reps' | 'longest';
      reps: number | null;
      weight_kg: string | number | null;
      duration_seconds: number | null;
      achieved_at: string;
    }[];
    const max = held.find((row) => row.kind === 'max');
    const most = held.find((row) => row.kind === 'most_reps');
    const longest = held.find((row) => row.kind === 'longest');
    return {
      exercise: exercise!,
      topSets: sets.map((row) => ({
        workoutId: row.workout_id,
        performedAt: row.performed_at,
        weightKg: numberOrNull(row.weight_kg),
        reps: row.reps,
        durationSeconds: row.duration_seconds,
      })),
      repPRs: held
        .filter((row) => row.kind === 'rep' && row.reps !== null && row.weight_kg !== null)
        .map((row) => ({
          reps: row.reps!,
          weightKg: Number(row.weight_kg),
          achievedAt: row.achieved_at,
        }))
        .sort((a, b) => a.reps - b.reps),
      oneRepMax:
        max && max.weight_kg !== null
          ? { weightKg: Number(max.weight_kg), achievedAt: max.achieved_at }
          : null,
      mostReps:
        most && most.reps !== null ? { reps: most.reps, achievedAt: most.achieved_at } : null,
      longest:
        longest && longest.duration_seconds !== null
          ? { durationSeconds: longest.duration_seconds, achievedAt: longest.achieved_at }
          : null,
    };
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
        total_sets: number;
        total_reps: number;
        training_minutes: number;
        one_rep_max_count: number;
        exercise_count: number;
        best_session_volume_kg: string | number;
        bodyweight_reps: number;
        timed_seconds: number;
        group_workouts: number;
        committed_months: number;
        strong_weeks: number;
        likes_received: number;
        likes_given: number;
      }[]
    )[0];
    return {
      workouts: all.count ?? 0,
      lastThirtyDays: recent.count ?? 0,
      totalVolumeKg: Number(row?.total_volume_kg ?? 0),
      prCount: row?.pr_count ?? 0,
      bestMonthWorkouts: row?.best_month_workouts ?? 0,
      totalSets: row?.total_sets ?? 0,
      totalReps: row?.total_reps ?? 0,
      trainingMinutes: row?.training_minutes ?? 0,
      oneRepMaxCount: row?.one_rep_max_count ?? 0,
      exerciseCount: row?.exercise_count ?? 0,
      bestSessionVolumeKg: Number(row?.best_session_volume_kg ?? 0),
      bodyweightReps: row?.bodyweight_reps ?? 0,
      timedSeconds: row?.timed_seconds ?? 0,
      groupWorkouts: row?.group_workouts ?? 0,
      committedMonths: row?.committed_months ?? 0,
      strongWeeks: row?.strong_weeks ?? 0,
      likesReceived: row?.likes_received ?? 0,
      likesGiven: row?.likes_given ?? 0,
    };
  }

  /** Their lifetime AP: the sum of their awards (achievement_summary). */
  private async rankOf(personId: string): Promise<PersonRank> {
    const { data, error } = await this.supabaseService
      .getClient()
      .rpc('achievement_summary', { p_user: personId });
    if (error) throw new InternalServerErrorException('Failed to load rank');
    const row = ((data ?? []) as { points: number; awards: number }[])[0];
    return { points: row?.points ?? 0, awards: row?.awards ?? 0 };
  }

  /**
   * The achievements they've earned, the latest first, each at the level reached -- only public
   * ones: nutrition achievements are only ever their own to see.
   */
  private async earnedAchievements(personId: string): Promise<EarnedAchievement[]> {
    const client = this.supabaseService.getClient();
    const [definitions, levels, awards] = await Promise.all([
      client
        .from('achievement_definitions')
        .select('id, title, description, icon, category, kind')
        .eq('visibility', 'public'),
      client.from('achievement_levels').select('achievement_id, level'),
      client
        .from('achievement_awards')
        .select('achievement_id, level, ap, awarded_at')
        .eq('user_id', personId)
        .order('awarded_at', { ascending: true }),
    ]);
    if (definitions.error || levels.error || awards.error) {
      throw new InternalServerErrorException('Failed to load achievements');
    }
    const byId = new Map(
      (
        (definitions.data ?? []) as {
          id: string;
          title: string;
          description: string;
          icon: string;
          category: string;
          kind: 'single' | 'levels';
        }[]
      ).map((definition) => [definition.id, definition]),
    );
    const levelCount = new Map<string, number>();
    for (const row of (levels.data ?? []) as { achievement_id: string; level: number }[]) {
      levelCount.set(
        row.achievement_id,
        Math.max(levelCount.get(row.achievement_id) ?? 0, row.level),
      );
    }
    const earned = new Map<string, EarnedAchievement>();
    for (const award of (awards.data ?? []) as {
      achievement_id: string;
      level: number;
      ap: number;
      awarded_at: string;
    }[]) {
      const definition = byId.get(award.achievement_id);
      if (!definition) continue;
      const seen = earned.get(definition.id);
      if (seen) {
        seen.level = Math.max(seen.level, award.level);
        seen.ap += award.ap;
        seen.lastAwardedAt = award.awarded_at;
      } else {
        earned.set(definition.id, {
          ...definition,
          level: award.level,
          levels: levelCount.get(definition.id) ?? award.level,
          ap: award.ap,
          firstAwardedAt: award.awarded_at,
          lastAwardedAt: award.awarded_at,
        });
      }
    }
    return [...earned.values()].sort((a, b) => b.lastAwardedAt.localeCompare(a.lastAwardedAt));
  }

  /** Every exercise they've done, with its best set, the most-done first. */
  private async exerciseBests(
    personId: string,
    includeTrainerLogged: boolean,
  ): Promise<ExerciseBest[]> {
    const { data, error } = await this.supabaseService.getClient().rpc('person_exercise_bests', {
      p_owner: personId,
      p_include_trainer_logged: includeTrainerLogged,
    });
    if (error) throw new InternalServerErrorException('Failed to load lifts');
    const rows = (data ?? []) as {
      exercise_id: string;
      measurement_type: MeasurementType;
      weight_kg: string | number | null;
      reps: number | null;
      duration_seconds: number | null;
      performed_at: string;
      workouts: number;
      last_performed_at: string;
    }[];
    const summaries = await this.exerciseSummaries(
      rows.map((row) => ({ id: row.exercise_id, measurementType: row.measurement_type })),
    );
    return rows.map((row, index) => ({
      ...summaries[index]!,
      weightKg: numberOrNull(row.weight_kg),
      reps: row.reps,
      durationSeconds: row.duration_seconds,
      performedAt: row.performed_at,
      workouts: row.workouts,
      lastPerformedAt: row.last_performed_at,
    }));
  }

  /** Each exercise's name, photo, gym and grip, in the order asked for. */
  private async exerciseSummaries(
    wanted: { id: string; measurementType: MeasurementType }[],
  ): Promise<ExerciseSummary[]> {
    if (wanted.length === 0) return [];
    const { data, error } = await this.supabaseService
      .getClient()
      .from('exercises')
      .select('id, name, photo_url, gym, attachment')
      .in(
        'id',
        wanted.map((exercise) => exercise.id),
      );
    if (error) throw new InternalServerErrorException('Failed to load lifts');
    const byId = new Map(
      (
        (data ?? []) as {
          id: string;
          name: string;
          photo_url: string | null;
          gym: string | null;
          attachment: string | null;
        }[]
      ).map((exercise) => [exercise.id, exercise]),
    );
    return wanted.map(({ id, measurementType }) => {
      const exercise = byId.get(id);
      return {
        exerciseId: id,
        exerciseName: exercise?.name ?? 'Exercise',
        photoUrl: exercise?.photo_url ?? null,
        gym: exercise?.gym ?? null,
        attachment: exercise?.attachment ?? null,
        measurementType,
      };
    });
  }
}

/** The heaviest few weighted lifts, heaviest (then most reps) first. */
function heaviestLifts(exercises: ExerciseBest[]): BestLift[] {
  return exercises
    .filter(
      (exercise): exercise is ExerciseBest & { weightKg: number; reps: number } =>
        exercise.measurementType === 'weight_reps' &&
        exercise.weightKg !== null &&
        exercise.reps !== null,
    )
    .sort((a, b) => b.weightKg - a.weightKg || b.reps - a.reps)
    .slice(0, BEST_LIFTS)
    .map((exercise) => ({
      exerciseId: exercise.exerciseId,
      exerciseName: exercise.exerciseName,
      photoUrl: exercise.photoUrl,
      gym: exercise.gym,
      attachment: exercise.attachment,
      weightKg: exercise.weightKg,
      reps: exercise.reps,
      performedAt: exercise.performedAt,
    }));
}

/** A numeric column (a string from Postgres) as a number, or null. */
function numberOrNull(value: string | number | null): number | null {
  return value === null ? null : Number(value);
}
