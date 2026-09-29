import { Injectable, InternalServerErrorException } from '@nestjs/common';
import { FollowsService, type FollowUserSummary } from '../follows/follows.service';
import { SupabaseService } from '../supabase/supabase.service';

const WORKOUT_PAGE_SIZE = 20;
const FOOD_LOG_LIMIT = 20;

export type FeedItem =
  | {
      kind: 'workout';
      id: string;
      timestamp: string;
      author: FollowUserSummary;
      workout: {
        id: string;
        name: string;
        splitDayName: string | null;
        muscleGroups: string[];
        durationMinutes: number | null;
        exerciseCount: number;
        completedSetCount: number;
        totalVolumeKg: number;
      };
    }
  | {
      kind: 'foodLog';
      id: string;
      timestamp: string;
      author: FollowUserSummary;
      log: {
        id: string;
        foodNameSnapshot: string;
        calories: number;
        proteinG: number;
        carbsG: number;
        fatG: number;
        mealType: string | null;
        imageUrl: string | null;
      };
    };

export interface FeedPage {
  items: FeedItem[];
  hasMore: boolean;
}

function computeDurationMinutes(performedAt: string, completedAt: string | null): number | null {
  if (!completedAt) return null;
  const ms = new Date(completedAt).getTime() - new Date(performedAt).getTime();
  if (!Number.isFinite(ms) || ms <= 0) return null;
  return Math.round(ms / 60000);
}

/**
 * The Friends tab of Feed: the signed-in user's accepted followees' own
 * completed workouts and logged foods, merged and sorted the same way
 * apps/mobile/src/feed/feedQueries.ts already does for "my" feed -- ported
 * server-side because reading another user's workouts/food_logs is exactly
 * the cross-user-trusted read CLAUDE.md's hybrid pattern reserves for the
 * backend (workouts/food_logs RLS is strictly own-row, so this can only
 * work via the service-role client after FollowsService confirms an
 * accepted follow).
 *
 * Food logs are the most recent N across all followees rather than
 * "this week" (unlike the self-feed) -- a server-local "current week"
 * would use the wrong timezone for the viewer, so recency-based is both
 * simpler and more correct here.
 */
@Injectable()
export class FeedService {
  constructor(
    private readonly supabaseService: SupabaseService,
    private readonly followsService: FollowsService,
  ) {}

  async getFriendsFeed(userId: string, page: number): Promise<FeedPage> {
    const followeeIds = await this.followsService.listAcceptedFolloweeIds(userId);
    if (followeeIds.length === 0) {
      return { items: [], hasMore: false };
    }

    const client = this.supabaseService.getClient();
    const items: FeedItem[] = [];

    const from = page * WORKOUT_PAGE_SIZE;
    const to = from + WORKOUT_PAGE_SIZE - 1;
    const { data: workoutRows, error: workoutsError } = await client
      .from('workouts')
      .select('id, user_id, name, performed_at, completed_at, workout_split_day_id')
      .in('user_id', followeeIds)
      .not('completed_at', 'is', null)
      .is('deleted_at', null)
      .order('performed_at', { ascending: false })
      .range(from, to);
    if (workoutsError) throw new InternalServerErrorException('Failed to load friends feed');

    const hasMore = (workoutRows ?? []).length === WORKOUT_PAGE_SIZE;
    const authorIds = new Set<string>((workoutRows ?? []).map((w) => w.user_id as string));

    if (workoutRows && workoutRows.length > 0) {
      const enriched = await this.enrichWorkouts(client, workoutRows);
      for (const workout of enriched) {
        items.push({
          kind: 'workout',
          id: `workout-${workout.id}`,
          timestamp: workout.completedAt as string,
          author: { id: workout.userId, username: null, displayName: null, avatarUrl: null },
          workout: {
            id: workout.id,
            name: workout.name,
            splitDayName: workout.splitDayName,
            muscleGroups: workout.muscleGroups,
            durationMinutes: workout.durationMinutes,
            exerciseCount: workout.exerciseCount,
            completedSetCount: workout.completedSetCount,
            totalVolumeKg: workout.totalVolumeKg,
          },
        });
      }
    }

    // Food logs: only on the first page, matching the self-feed's own
    // "food logs aren't paginated yet" limitation (see feedQueries.ts).
    if (page === 0) {
      const { data: logRows, error: logsError } = await client
        .from('food_logs')
        .select(
          'id, user_id, food_name_snapshot, calories, protein_g, carbs_g, fat_g, meal_type, image_url, logged_at',
        )
        .in('user_id', followeeIds)
        .order('logged_at', { ascending: false })
        .limit(FOOD_LOG_LIMIT);
      if (logsError) throw new InternalServerErrorException('Failed to load friends feed');

      for (const log of logRows ?? []) {
        authorIds.add(log.user_id as string);
        items.push({
          kind: 'foodLog',
          id: `foodLog-${log.id}`,
          timestamp: log.logged_at as string,
          author: { id: log.user_id as string, username: null, displayName: null, avatarUrl: null },
          log: {
            id: log.id as string,
            foodNameSnapshot: log.food_name_snapshot as string,
            calories: Number(log.calories),
            proteinG: Number(log.protein_g),
            carbsG: Number(log.carbs_g),
            fatG: Number(log.fat_g),
            mealType: (log.meal_type as string | null) ?? null,
            imageUrl: (log.image_url as string | null) ?? null,
          },
        });
      }
    }

    const authors = await this.followsService.getUserSummaries(Array.from(authorIds));
    for (const item of items) {
      const author = authors.get(item.author.id);
      if (author) item.author = author;
    }

    items.sort((a, b) => new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime());
    return { items, hasMore };
  }

  private async enrichWorkouts(
    client: ReturnType<SupabaseService['getClient']>,
    workouts: {
      id: string;
      user_id: string;
      name: string;
      performed_at: string;
      completed_at: string | null;
      workout_split_day_id: string | null;
    }[],
  ) {
    const splitDayIds = Array.from(
      new Set(
        workouts.map((w) => w.workout_split_day_id).filter((id): id is string => id !== null),
      ),
    );
    const splitDayInfo = new Map<string, { name: string; muscleGroups: string[] }>();
    if (splitDayIds.length > 0) {
      const { data, error } = await client
        .from('workout_split_days')
        .select('id, name, workout_split_day_muscle_groups(muscle_group)')
        .in('id', splitDayIds);
      if (error) throw new InternalServerErrorException('Failed to load friends feed');
      for (const day of data ?? []) {
        const embedded = day.workout_split_day_muscle_groups as unknown as
          { muscle_group: string }[] | null;
        splitDayInfo.set(day.id as string, {
          name: day.name as string,
          muscleGroups: (embedded ?? []).map((m) => m.muscle_group),
        });
      }
    }

    const workoutIds = workouts.map((w) => w.id);
    const { data: workoutExercises, error: weError } = await client
      .from('workout_exercises')
      .select('id, workout_id')
      .in('workout_id', workoutIds)
      .is('deleted_at', null);
    if (weError) throw new InternalServerErrorException('Failed to load friends feed');

    const workoutIdByExerciseId = new Map<string, string>();
    const exerciseCountByWorkoutId = new Map<string, number>();
    for (const we of workoutExercises ?? []) {
      workoutIdByExerciseId.set(we.id as string, we.workout_id as string);
      exerciseCountByWorkoutId.set(
        we.workout_id as string,
        (exerciseCountByWorkoutId.get(we.workout_id as string) ?? 0) + 1,
      );
    }

    const completedSetCountByWorkoutId = new Map<string, number>();
    const totalVolumeKgByWorkoutId = new Map<string, number>();
    const workoutExerciseIds = Array.from(workoutIdByExerciseId.keys());
    if (workoutExerciseIds.length > 0) {
      const { data: sets, error: setsError } = await client
        .from('sets')
        .select('workout_exercise_id, weight_kg, reps')
        .in('workout_exercise_id', workoutExerciseIds)
        .is('deleted_at', null)
        .not('completed_at', 'is', null)
        .not('weight_kg', 'is', null)
        .not('reps', 'is', null);
      if (setsError) throw new InternalServerErrorException('Failed to load friends feed');

      for (const set of sets ?? []) {
        const workoutId = workoutIdByExerciseId.get(set.workout_exercise_id as string);
        if (!workoutId) continue;
        completedSetCountByWorkoutId.set(
          workoutId,
          (completedSetCountByWorkoutId.get(workoutId) ?? 0) + 1,
        );
        totalVolumeKgByWorkoutId.set(
          workoutId,
          (totalVolumeKgByWorkoutId.get(workoutId) ?? 0) + Number(set.weight_kg) * Number(set.reps),
        );
      }
    }

    return workouts.map((workout) => {
      const day = workout.workout_split_day_id
        ? splitDayInfo.get(workout.workout_split_day_id)
        : undefined;
      return {
        id: workout.id,
        userId: workout.user_id,
        name: workout.name,
        completedAt: workout.completed_at,
        splitDayName: day?.name ?? null,
        muscleGroups: day?.muscleGroups ?? [],
        completedSetCount: completedSetCountByWorkoutId.get(workout.id) ?? 0,
        totalVolumeKg: totalVolumeKgByWorkoutId.get(workout.id) ?? 0,
        durationMinutes: computeDurationMinutes(workout.performed_at, workout.completed_at),
        exerciseCount: exerciseCountByWorkoutId.get(workout.id) ?? 0,
      };
    });
  }
}
