import { Injectable, InternalServerErrorException } from '@nestjs/common';
import { FollowsService, type FollowUserSummary } from '../follows/follows.service';
import { SupabaseService } from '../supabase/supabase.service';

const WORKOUT_PAGE_SIZE = 20;

export type FeedItem = {
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
    completedExerciseCount: number;
    topSets: {
      exerciseId: string;
      exerciseName: string;
      photoUrl: string | null;
      weightKg: number;
      reps: number;
    }[];
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
 * completed workouts, sorted the same way apps/mobile/src/feed/feedQueries.ts
 * already does for "my" feed -- ported server-side because reading another
 * user's workouts is exactly the cross-user-trusted read CLAUDE.md's hybrid
 * pattern reserves for the backend (workouts RLS is strictly own-row, so
 * this can only work via the service-role client after FollowsService
 * confirms an accepted follow).
 *
 * Nutrition logs are deliberately not part of Feed, for either source -- see
 * apps/mobile/src/feed/feedQueries.ts's own comment.
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
      // A workout a trainer logged for a client is the client's own, but it is not
      // something the client chose to share with followers (trainer mode, workouts only).
      .is('logged_by', null)
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
          // performedAt, not completedAt -- the date a workout is attributed
          // to is editable after the fact (see EditWorkoutScreen), while
          // completedAt is a "this is done" marker whose own value doesn't
          // move with an edit. Every other workout query in the app (own
          // history, the calendar, PR ordering) already sorts/filters by
          // performed_at; this keeps Feed consistent with that rather than
          // silently showing a stale position/date after a workout is moved.
          timestamp: workout.performedAt as string,
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
            completedExerciseCount: workout.completedExerciseCount,
            topSets: workout.topSets,
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
    const workoutIds = workouts.map((w) => w.id);
    const splitDaysQuery =
      splitDayIds.length > 0
        ? client
            .from('workout_split_days')
            .select('id, name, workout_split_day_muscle_groups(muscle_group)')
            .in('id', splitDayIds)
        : null;
    const [splitDaysResult, workoutExercisesResult] = await Promise.all([
      splitDaysQuery,
      client
        .from('workout_exercises')
        .select('id, workout_id, exercise_id, order_index, exercises(name, photo_url)')
        .in('workout_id', workoutIds)
        .is('deleted_at', null),
    ]);
    if (splitDaysResult) {
      const { data, error } = splitDaysResult;
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

    const { data: workoutExercises, error: weError } = workoutExercisesResult;
    if (weError) throw new InternalServerErrorException('Failed to load friends feed');

    const workoutIdByExerciseId = new Map<string, string>();
    const exerciseCountByWorkoutId = new Map<string, number>();
    const exerciseInfoById = new Map<
      string,
      { exerciseId: string; exerciseName: string; photoUrl: string | null; orderIndex: number }
    >();
    for (const we of workoutExercises ?? []) {
      workoutIdByExerciseId.set(we.id as string, we.workout_id as string);
      const embedded = we.exercises as unknown as { name: string; photo_url: string | null } | null;
      exerciseInfoById.set(we.id as string, {
        exerciseId: we.exercise_id as string,
        exerciseName: embedded?.name ?? '',
        photoUrl: embedded?.photo_url ?? null,
        orderIndex: we.order_index as number,
      });
      exerciseCountByWorkoutId.set(
        we.workout_id as string,
        (exerciseCountByWorkoutId.get(we.workout_id as string) ?? 0) + 1,
      );
    }

    const completedSetCountByWorkoutId = new Map<string, number>();
    const totalVolumeKgByWorkoutId = new Map<string, number>();
    const setsByExerciseRowId = new Map<
      string,
      { setIndex: number; weightKg: number; reps: number }[]
    >();
    const workoutExerciseIds = Array.from(workoutIdByExerciseId.keys());
    if (workoutExerciseIds.length > 0) {
      const { data: sets, error: setsError } = await client
        .from('sets')
        .select('id, workout_exercise_id, set_index, weight_kg, reps')
        .in('workout_exercise_id', workoutExerciseIds)
        .is('deleted_at', null)
        .not('completed_at', 'is', null)
        .not('weight_kg', 'is', null)
        .not('reps', 'is', null);
      if (setsError) throw new InternalServerErrorException('Failed to load friends feed');

      for (const set of sets ?? []) {
        const workoutId = workoutIdByExerciseId.get(set.workout_exercise_id as string);
        if (!workoutId) continue;
        const exerciseRowId = set.workout_exercise_id as string;
        const bucket = setsByExerciseRowId.get(exerciseRowId) ?? [];
        bucket.push({
          setIndex: set.set_index as number,
          weightKg: Number(set.weight_kg),
          reps: Number(set.reps),
        });
        setsByExerciseRowId.set(exerciseRowId, bucket);
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

    const exerciseRowIdsByWorkoutId = new Map<string, string[]>();
    for (const [exerciseRowId, workoutId] of workoutIdByExerciseId) {
      const list = exerciseRowIdsByWorkoutId.get(workoutId) ?? [];
      list.push(exerciseRowId);
      exerciseRowIdsByWorkoutId.set(workoutId, list);
    }

    return workouts.map((workout) => {
      const exerciseRows = (exerciseRowIdsByWorkoutId.get(workout.id) ?? [])
        .map((id) => ({ id, info: exerciseInfoById.get(id)! }))
        .sort((a, b) => a.info.orderIndex - b.info.orderIndex);
      const topSets: {
        exerciseId: string;
        exerciseName: string;
        photoUrl: string | null;
        weightKg: number;
        reps: number;
      }[] = [];
      let completedExerciseCount = 0;
      for (const row of exerciseRows) {
        const completed = setsByExerciseRowId.get(row.id) ?? [];
        if (completed.length === 0) continue;
        completedExerciseCount += 1;
        // Same rule as the mobile heaviestSet: sets in set order, first heaviest wins.
        const ordered = [...completed].sort((x, y) => x.setIndex - y.setIndex);
        let top = ordered[0]!;
        for (const set of ordered) {
          if (set.weightKg > top.weightKg) top = set;
        }
        topSets.push({
          exerciseId: row.info.exerciseId,
          exerciseName: row.info.exerciseName,
          photoUrl: row.info.photoUrl,
          weightKg: top.weightKg,
          reps: top.reps,
        });
      }

      const day = workout.workout_split_day_id
        ? splitDayInfo.get(workout.workout_split_day_id)
        : undefined;
      return {
        id: workout.id,
        userId: workout.user_id,
        name: workout.name,
        performedAt: workout.performed_at,
        completedAt: workout.completed_at,
        splitDayName: day?.name ?? null,
        muscleGroups: day?.muscleGroups ?? [],
        completedSetCount: completedSetCountByWorkoutId.get(workout.id) ?? 0,
        totalVolumeKg: totalVolumeKgByWorkoutId.get(workout.id) ?? 0,
        durationMinutes: computeDurationMinutes(workout.performed_at, workout.completed_at),
        exerciseCount: exerciseCountByWorkoutId.get(workout.id) ?? 0,
        completedExerciseCount,
        topSets,
      };
    });
  }
}
