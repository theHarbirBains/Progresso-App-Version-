import { Injectable, InternalServerErrorException } from '@nestjs/common';
import type { MeasurementType } from '../exercises/movement-type';
import { FollowsService, type FollowUserSummary } from '../follows/follows.service';
import { SupabaseService } from '../supabase/supabase.service';
import {
  totalMinutes,
  CARDIO_COLUMNS,
  cardioByWorkout,
  type CardioRow,
  type WorkoutCardio,
} from './workout-cardio';

const WORKOUT_PAGE_SIZE = 20;

/**
 * One exercise's best set in a workout, for what it measures: the heaviest (the Top Set) for
 * weight and reps, the most reps at bodyweight, the longest when timed.
 */
export interface FeedTopSet {
  exerciseId: string;
  exerciseName: string;
  photoUrl: string | null;
  /** The gym it's at and its handle, when its owner gave them: with the photo, which machine. */
  gym: string | null;
  grip: string | null;
  attachment: string | null;
  measurementType: MeasurementType;
  /** Weight and reps only. */
  weightKg: number | null;
  /** Null for a timed exercise. */
  reps: number | null;
  /** A timed exercise's time, in seconds. */
  durationSeconds: number | null;
}

interface FeedSet {
  setIndex: number;
  weightKg: number | null;
  reps: number | null;
  durationSeconds: number | null;
}

/** Whether a set holds what its exercise records -- the mobile app's holdsMeasurement. */
function holdsMeasurement(set: FeedSet, type: MeasurementType): boolean {
  if (type === 'bodyweight') return set.reps !== null;
  if (type === 'timed') return set.durationSeconds !== null;
  return set.weightKg !== null && set.reps !== null;
}

function score(set: FeedSet, type: MeasurementType): number {
  if (type === 'bodyweight') return set.reps ?? 0;
  if (type === 'timed') return set.durationSeconds ?? 0;
  return set.weightKg ?? 0;
}

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
    topSets: FeedTopSet[];
    /** Its cardio, in the order added -- never sets or exercises. */
    cardio: WorkoutCardio[];
    /** The workout's total time in minutes, for a workout with cardio (workout-cardio.ts). */
    totalMinutes: number | null;
    /** The same, for app versions from before totalMinutes, which read this name. */
    activeMinutes: number | null;
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
    return this.workoutPage(followeeIds, page, { includeTrainerLogged: false });
  }

  /**
   * One person's finished workouts, newest first, as the Friends feed shows them -- for their
   * profile. The caller has checked the viewer may see them. A workout a trainer logged is
   * left out unless it's the person looking at their own.
   */
  async getPersonWorkouts(
    ownerId: string,
    page: number,
    { includeTrainerLogged }: { includeTrainerLogged: boolean },
  ): Promise<FeedPage> {
    return this.workoutPage([ownerId], page, { includeTrainerLogged });
  }

  private async workoutPage(
    ownerIds: string[],
    page: number,
    { includeTrainerLogged }: { includeTrainerLogged: boolean },
  ): Promise<FeedPage> {
    const client = this.supabaseService.getClient();
    const items: FeedItem[] = [];

    const from = page * WORKOUT_PAGE_SIZE;
    const to = from + WORKOUT_PAGE_SIZE - 1;
    let query = client
      .from('workouts')
      .select(
        'id, user_id, name, performed_at, completed_at, workout_split_day_id, strength_ended_at',
      )
      .in('user_id', ownerIds)
      .not('completed_at', 'is', null)
      .is('deleted_at', null);
    // A workout a trainer logged for a client is the client's own, but it is not
    // something the client chose to share with followers (trainer mode, workouts only).
    if (!includeTrainerLogged) query = query.is('logged_by', null);
    const { data: workoutRows, error: workoutsError } = await query
      .order('performed_at', { ascending: false })
      .range(from, to);
    if (workoutsError) throw new InternalServerErrorException('Failed to load friends feed');

    const hasMore = (workoutRows ?? []).length === WORKOUT_PAGE_SIZE;
    const authorIds = new Set<string>((workoutRows ?? []).map((w) => w.user_id as string));

    if (workoutRows && workoutRows.length > 0) {
      const enriched = await this.enrichWorkouts(client, workoutRows);
      for (const workout of enriched) {
        // A workout finished with nothing in it isn't one to show anyone -- cardio alone is
        // something.
        if (workout.completedSetCount === 0 && workout.cardio.length === 0) continue;
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
            cardio: workout.cardio,
            totalMinutes: workout.totalMinutes,
            activeMinutes: workout.totalMinutes,
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
      strength_ended_at?: string | null;
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
    const [splitDaysResult, workoutExercisesResult, cardioResult] = await Promise.all([
      splitDaysQuery,
      client
        .from('workout_exercises')
        .select(
          'id, workout_id, exercise_id, order_index, measurement_type, exercises(name, photo_url, gym, grip, attachment)',
        )
        .in('workout_id', workoutIds)
        .is('deleted_at', null),
      client
        .from('workout_cardio')
        .select(CARDIO_COLUMNS)
        .in('workout_id', workoutIds)
        .order('created_at', { ascending: true }),
    ]);
    if (cardioResult.error) throw new InternalServerErrorException('Failed to load friends feed');
    const cardioOf = cardioByWorkout((cardioResult.data ?? []) as CardioRow[]);
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
      {
        exerciseId: string;
        exerciseName: string;
        photoUrl: string | null;
        gym: string | null;
        grip: string | null;
        attachment: string | null;
        orderIndex: number;
        measurementType: MeasurementType;
      }
    >();
    for (const we of workoutExercises ?? []) {
      workoutIdByExerciseId.set(we.id as string, we.workout_id as string);
      const embedded = we.exercises as unknown as {
        name: string;
        photo_url: string | null;
        gym: string | null;
        grip: string | null;
        attachment: string | null;
      } | null;
      exerciseInfoById.set(we.id as string, {
        exerciseId: we.exercise_id as string,
        exerciseName: embedded?.name ?? '',
        photoUrl: embedded?.photo_url ?? null,
        gym: embedded?.gym ?? null,
        grip: embedded?.grip ?? null,
        attachment: embedded?.attachment ?? null,
        orderIndex: we.order_index as number,
        // What the exercise was logged as (snapshotted per logged exercise).
        measurementType: (we.measurement_type as MeasurementType | null) ?? 'weight_reps',
      });
      exerciseCountByWorkoutId.set(
        we.workout_id as string,
        (exerciseCountByWorkoutId.get(we.workout_id as string) ?? 0) + 1,
      );
    }

    const completedSetCountByWorkoutId = new Map<string, number>();
    const totalVolumeKgByWorkoutId = new Map<string, number>();
    const setsByExerciseRowId = new Map<string, FeedSet[]>();
    // When each finished set was finished, warm-ups too: how long the lifting took, for the
    // workout's total time beside its cardio (workout-cardio.ts).
    const setTimesByWorkoutId = new Map<string, string[]>();
    const workoutExerciseIds = Array.from(workoutIdByExerciseId.keys());
    if (workoutExerciseIds.length > 0) {
      const { data: sets, error: setsError } = await client
        .from('sets')
        .select(
          'id, workout_exercise_id, set_index, weight_kg, reps, duration_seconds, completed_at, is_warmup, is_drop',
        )
        .in('workout_exercise_id', workoutExerciseIds)
        .is('deleted_at', null)
        .not('completed_at', 'is', null);
      if (setsError) throw new InternalServerErrorException('Failed to load friends feed');

      for (const set of sets ?? []) {
        const exerciseRowId = set.workout_exercise_id as string;
        const workoutId = workoutIdByExerciseId.get(exerciseRowId);
        if (!workoutId) continue;
        if (typeof set.completed_at === 'string') {
          const times = setTimesByWorkoutId.get(workoutId) ?? [];
          times.push(set.completed_at);
          setTimesByWorkoutId.set(workoutId, times);
        }
        // A card's figures and top sets count working sets only: a warm-up counts toward nothing.
        if (set.is_warmup === true) continue;
        const type = exerciseInfoById.get(exerciseRowId)?.measurementType ?? 'weight_reps';
        const feedSet: FeedSet = {
          setIndex: set.set_index as number,
          weightKg: set.weight_kg === null ? null : Number(set.weight_kg),
          reps: set.reps === null ? null : Number(set.reps),
          durationSeconds:
            set.duration_seconds === null || set.duration_seconds === undefined
              ? null
              : Number(set.duration_seconds),
        };
        // Only a set holding what its exercise records counts as logged.
        if (!holdsMeasurement(feedSet, type)) continue;
        // A drop set is part of the set before it: its volume counts, but it's never a set of
        // its own or a top set.
        if (set.is_drop === true) {
          if (type === 'weight_reps') {
            totalVolumeKgByWorkoutId.set(
              workoutId,
              (totalVolumeKgByWorkoutId.get(workoutId) ?? 0) + feedSet.weightKg! * feedSet.reps!,
            );
          }
          continue;
        }
        const bucket = setsByExerciseRowId.get(exerciseRowId) ?? [];
        bucket.push(feedSet);
        setsByExerciseRowId.set(exerciseRowId, bucket);
        completedSetCountByWorkoutId.set(
          workoutId,
          (completedSetCountByWorkoutId.get(workoutId) ?? 0) + 1,
        );
        // Volume is weight x reps: weighted exercises only.
        if (type === 'weight_reps') {
          totalVolumeKgByWorkoutId.set(
            workoutId,
            (totalVolumeKgByWorkoutId.get(workoutId) ?? 0) + feedSet.weightKg! * feedSet.reps!,
          );
        }
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
      const topSets: FeedTopSet[] = [];
      let completedExerciseCount = 0;
      for (const row of exerciseRows) {
        const completed = setsByExerciseRowId.get(row.id) ?? [];
        if (completed.length === 0) continue;
        completedExerciseCount += 1;
        const type = row.info.measurementType;
        // Same rule as the mobile bestLoggedSet: sets in set order, the first best wins.
        const ordered = [...completed].sort((x, y) => x.setIndex - y.setIndex);
        let top = ordered[0]!;
        for (const set of ordered) {
          if (score(set, type) > score(top, type)) top = set;
        }
        topSets.push({
          exerciseId: row.info.exerciseId,
          exerciseName: row.info.exerciseName,
          photoUrl: row.info.photoUrl,
          gym: row.info.gym,
          grip: row.info.grip,
          attachment: row.info.attachment,
          measurementType: type,
          weightKg: type === 'weight_reps' ? top.weightKg : null,
          reps: type === 'timed' ? null : top.reps,
          durationSeconds: type === 'timed' ? top.durationSeconds : null,
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
        cardio: cardioOf.get(workout.id) ?? [],
        totalMinutes: totalMinutes({
          performedAt: workout.performed_at,
          completedAt: workout.completed_at,
          hasStrength: (completedSetCountByWorkoutId.get(workout.id) ?? 0) > 0,
          setTimes: setTimesByWorkoutId.get(workout.id) ?? [],
          cardio: cardioOf.get(workout.id) ?? [],
        }),
      };
    });
  }
}
