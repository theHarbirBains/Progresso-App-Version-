import {
  ForbiddenException,
  Injectable,
  InternalServerErrorException,
  NotFoundException,
} from '@nestjs/common';
import { FollowsService, type FollowUserSummary } from '../follows/follows.service';
import { SocialPushService } from '../notifications/social-push.service';
import { isBlockedEitherWay, loadBlocks } from '../safety/blocks';
import { SupabaseService } from '../supabase/supabase.service';
import { canSeeActivity, relationshipWith } from './relationship';

const UNIQUE_VIOLATION = '23505';
/** How much of a comment its push shows. */
const PUSH_EXCERPT = 80;

interface WorkoutRow {
  id: string;
  user_id: string;
  name: string;
  performed_at: string;
  completed_at: string | null;
  deleted_at: string | null;
  logged_by: string | null;
}

export interface WorkoutSet {
  id: string;
  setIndex: number;
  side: 'left' | 'right' | null;
  weightKg: number | null;
  reps: number | null;
  durationSeconds: number | null;
  completedAt: string | null;
  /** A warm-up: shown, marked W, counted toward nothing. */
  isWarmup: boolean;
  /** A drop set: part of the working set before it, shown under it. */
  isDrop: boolean;
}

/** Someone else's workout, as the app shows it read-only: what they logged, and on what. */
export interface WorkoutForViewer {
  id: string;
  name: string;
  performedAt: string;
  completedAt: string | null;
  author: FollowUserSummary;
  exercises: {
    id: string;
    exerciseId: string;
    exerciseName: string;
    muscleGroup: string;
    movementType: string;
    measurementType: string;
    photoUrl: string | null;
    gym: string | null;
    grip: string | null;
    attachment: string | null;
    orderIndex: number;
    sets: WorkoutSet[];
  }[];
}

export interface WorkoutComment {
  id: string;
  workoutId: string;
  user: FollowUserSummary;
  body: string;
  createdAt: string;
  /** Its writer, or the workout's owner, can delete it. */
  canDelete: boolean;
}

export interface WorkoutSocial {
  likeCount: number;
  likedByMe: boolean;
  /** Who liked it, newest first. */
  likers: FollowUserSummary[];
  /** Oldest first, as a conversation reads. */
  comments: WorkoutComment[];
}

export interface SocialSummary {
  likeCount: number;
  commentCount: number;
  likedByMe: boolean;
}

function unknownUser(id: string): FollowUserSummary {
  return { id, username: null, displayName: null, avatarUrl: null };
}

/**
 * A finished workout's likes and comments, and the workout itself for someone else to read. A
 * workout can be seen -- and liked and commented on -- by its owner, and by the people whose
 * follow they accepted, unless a trainer logged it (that isn't something the owner chose to
 * share). Anything from someone blocked either way is left out; a workout that can't be seen
 * reads as not found, so nothing about it leaks. A like or a comment is pushed to the owner
 * (when they want it), never for their own.
 */
@Injectable()
export class WorkoutSocialService {
  constructor(
    private readonly supabaseService: SupabaseService,
    private readonly followsService: FollowsService,
    private readonly socialPush: SocialPushService,
  ) {}

  async getWorkout(viewerId: string, workoutId: string): Promise<WorkoutForViewer> {
    const workout = await this.visibleWorkout(viewerId, workoutId);
    const client = this.supabaseService.getClient();
    const { data: exercises, error } = await client
      .from('workout_exercises')
      .select(
        'id, exercise_id, order_index, measurement_type, exercises(name, muscle_group, movement_type, photo_url, gym, grip, attachment)',
      )
      .eq('workout_id', workoutId)
      .is('deleted_at', null)
      .order('order_index', { ascending: true });
    if (error) throw new InternalServerErrorException('Failed to load the workout');
    const exerciseRows = (exercises ?? []) as unknown as {
      id: string;
      exercise_id: string;
      order_index: number;
      measurement_type: string | null;
      exercises: {
        name: string;
        muscle_group: string;
        movement_type: string;
        photo_url: string | null;
        gym: string | null;
        grip: string | null;
        attachment: string | null;
      } | null;
    }[];
    const setsByExercise = new Map<string, WorkoutSet[]>();
    if (exerciseRows.length > 0) {
      const { data: sets, error: setsError } = await client
        .from('sets')
        .select(
          'id, workout_exercise_id, set_index, side, weight_kg, reps, duration_seconds, completed_at, is_warmup, is_drop',
        )
        .in(
          'workout_exercise_id',
          exerciseRows.map((row) => row.id),
        )
        .is('deleted_at', null)
        .not('completed_at', 'is', null)
        .order('set_index', { ascending: true });
      if (setsError) throw new InternalServerErrorException('Failed to load the workout');
      for (const set of (sets ?? []) as {
        id: string;
        workout_exercise_id: string;
        set_index: number;
        side: string;
        weight_kg: string | number | null;
        reps: number | null;
        duration_seconds: number | null;
        completed_at: string | null;
        is_warmup: boolean | null;
        is_drop: boolean | null;
      }[]) {
        const list = setsByExercise.get(set.workout_exercise_id) ?? [];
        list.push({
          id: set.id,
          setIndex: set.set_index,
          side: set.side === 'left' || set.side === 'right' ? set.side : null,
          weightKg: set.weight_kg === null ? null : Number(set.weight_kg),
          reps: set.reps,
          durationSeconds: set.duration_seconds,
          completedAt: set.completed_at,
          isWarmup: set.is_warmup === true,
          isDrop: set.is_drop === true,
        });
        setsByExercise.set(set.workout_exercise_id, list);
      }
    }
    const authors = await this.followsService.getUserSummaries([workout.user_id]);
    return {
      id: workout.id,
      name: workout.name,
      performedAt: workout.performed_at,
      completedAt: workout.completed_at,
      author: authors.get(workout.user_id) ?? unknownUser(workout.user_id),
      exercises: exerciseRows.map((row) => ({
        id: row.id,
        exerciseId: row.exercise_id,
        exerciseName: row.exercises?.name ?? 'Exercise',
        muscleGroup: row.exercises?.muscle_group ?? 'other',
        movementType: row.exercises?.movement_type ?? 'bilateral',
        measurementType: row.measurement_type ?? 'weight_reps',
        photoUrl: row.exercises?.photo_url ?? null,
        gym: row.exercises?.gym ?? null,
        grip: row.exercises?.grip ?? null,
        attachment: row.exercises?.attachment ?? null,
        orderIndex: row.order_index,
        sets: setsByExercise.get(row.id) ?? [],
      })),
    };
  }

  async getSocial(viewerId: string, workoutId: string): Promise<WorkoutSocial> {
    const workout = await this.visibleWorkout(viewerId, workoutId);
    const client = this.supabaseService.getClient();
    const [likes, comments, blocks] = await Promise.all([
      client
        .from('workout_likes')
        .select('user_id, created_at')
        .eq('workout_id', workoutId)
        .order('created_at', { ascending: false }),
      client
        .from('workout_comments')
        .select('id, user_id, body, created_at')
        .eq('workout_id', workoutId)
        .order('created_at', { ascending: true }),
      loadBlocks(client, viewerId),
    ]);
    if (likes.error || comments.error) {
      throw new InternalServerErrorException('Failed to load likes and comments');
    }
    const likeRows = ((likes.data ?? []) as { user_id: string }[]).filter(
      (row) => !isBlockedEitherWay(blocks, row.user_id),
    );
    const commentRows = (
      (comments.data ?? []) as {
        id: string;
        user_id: string;
        body: string;
        created_at: string;
      }[]
    ).filter((row) => !isBlockedEitherWay(blocks, row.user_id));
    const users = await this.followsService.getUserSummaries([
      ...likeRows.map((row) => row.user_id),
      ...commentRows.map((row) => row.user_id),
    ]);
    return {
      likeCount: likeRows.length,
      likedByMe: likeRows.some((row) => row.user_id === viewerId),
      likers: likeRows.map((row) => users.get(row.user_id) ?? unknownUser(row.user_id)),
      comments: commentRows.map((row) => ({
        id: row.id,
        workoutId,
        user: users.get(row.user_id) ?? unknownUser(row.user_id),
        body: row.body,
        createdAt: row.created_at,
        canDelete: row.user_id === viewerId || workout.user_id === viewerId,
      })),
    };
  }

  /** Each of these workouts' likes and comments, for the ones the viewer can see. */
  async summarize(viewerId: string, workoutIds: string[]): Promise<Record<string, SocialSummary>> {
    const ids = Array.from(new Set(workoutIds));
    if (ids.length === 0) return {};
    const client = this.supabaseService.getClient();
    const [workouts, followeeIds, blocks] = await Promise.all([
      client
        .from('workouts')
        .select('id, user_id, completed_at, deleted_at, logged_by')
        .in('id', ids),
      this.followsService.listAcceptedFolloweeIds(viewerId),
      loadBlocks(client, viewerId),
    ]);
    if (workouts.error) throw new InternalServerErrorException('Failed to load workouts');
    const following = new Set(followeeIds);
    const visible = ((workouts.data ?? []) as WorkoutRow[])
      .filter((row) => row.completed_at !== null && row.deleted_at === null)
      .filter(
        (row) =>
          row.user_id === viewerId ||
          (following.has(row.user_id) &&
            row.logged_by === null &&
            !isBlockedEitherWay(blocks, row.user_id)),
      )
      .map((row) => row.id);
    if (visible.length === 0) return {};
    const [likes, comments] = await Promise.all([
      client.from('workout_likes').select('workout_id, user_id').in('workout_id', visible),
      client.from('workout_comments').select('workout_id, user_id').in('workout_id', visible),
    ]);
    if (likes.error || comments.error) {
      throw new InternalServerErrorException('Failed to load likes and comments');
    }
    const summary: Record<string, SocialSummary> = Object.fromEntries(
      visible.map((id) => [id, { likeCount: 0, commentCount: 0, likedByMe: false }]),
    );
    for (const row of (likes.data ?? []) as { workout_id: string; user_id: string }[]) {
      const entry = summary[row.workout_id];
      if (!entry || isBlockedEitherWay(blocks, row.user_id)) continue;
      entry.likeCount += 1;
      if (row.user_id === viewerId) entry.likedByMe = true;
    }
    for (const row of (comments.data ?? []) as { workout_id: string; user_id: string }[]) {
      const entry = summary[row.workout_id];
      if (!entry || isBlockedEitherWay(blocks, row.user_id)) continue;
      entry.commentCount += 1;
    }
    return summary;
  }

  async like(viewerId: string, workoutId: string): Promise<void> {
    const workout = await this.visibleWorkout(viewerId, workoutId);
    const { error } = await this.supabaseService
      .getClient()
      .from('workout_likes')
      .insert({ workout_id: workoutId, user_id: viewerId });
    // Liked already (another tap, another device): nothing more to do, and no second push.
    if (error?.code === UNIQUE_VIOLATION) return;
    if (error) throw new InternalServerErrorException('Failed to like the workout');
    if (workout.user_id !== viewerId) {
      const name = await this.socialPush.nameOf(viewerId);
      void this.socialPush.notify(workout.user_id, 'likes', {
        title: 'New like',
        body: `${name} liked your workout ${workout.name}.`,
        path: `workouts/${workoutId}`,
      });
    }
  }

  async unlike(viewerId: string, workoutId: string): Promise<void> {
    await this.visibleWorkout(viewerId, workoutId);
    const { error } = await this.supabaseService
      .getClient()
      .from('workout_likes')
      .delete()
      .eq('workout_id', workoutId)
      .eq('user_id', viewerId);
    if (error) throw new InternalServerErrorException('Failed to unlike the workout');
  }

  async comment(viewerId: string, workoutId: string, body: string): Promise<WorkoutComment> {
    const workout = await this.visibleWorkout(viewerId, workoutId);
    const text = body.trim();
    const { data, error } = await this.supabaseService
      .getClient()
      .from('workout_comments')
      .insert({ workout_id: workoutId, user_id: viewerId, body: text })
      .select('id, created_at')
      .single();
    if (error || !data) throw new InternalServerErrorException('Failed to post the comment');
    const users = await this.followsService.getUserSummaries([viewerId]);
    const user = users.get(viewerId) ?? unknownUser(viewerId);
    if (workout.user_id !== viewerId) {
      const name = user.displayName ?? (user.username ? `@${user.username}` : 'Someone');
      void this.socialPush.notify(workout.user_id, 'comments', {
        title: `${name} commented`,
        body: text.length > PUSH_EXCERPT ? `${text.slice(0, PUSH_EXCERPT - 1)}…` : text,
        path: `workouts/${workoutId}`,
      });
    }
    const row = data as { id: string; created_at: string };
    return {
      id: row.id,
      workoutId,
      user,
      body: text,
      createdAt: row.created_at,
      canDelete: true,
    };
  }

  /** Deletes a comment -- its writer's, or any on the viewer's own workout. */
  async deleteComment(viewerId: string, commentId: string): Promise<void> {
    const client = this.supabaseService.getClient();
    const { data, error } = await client
      .from('workout_comments')
      .select('id, user_id, workouts(user_id)')
      .eq('id', commentId)
      .maybeSingle();
    if (error) throw new InternalServerErrorException('Failed to look up the comment');
    const row = data as { user_id: string; workouts: { user_id: string } | null } | null;
    if (!row) throw new NotFoundException('Comment not found');
    if (row.user_id !== viewerId && row.workouts?.user_id !== viewerId) {
      throw new ForbiddenException('Only its writer or the workout’s owner can delete a comment');
    }
    const { error: deleteError } = await client
      .from('workout_comments')
      .delete()
      .eq('id', commentId);
    if (deleteError) throw new InternalServerErrorException('Failed to delete the comment');
  }

  /** The workout, when the viewer can see it; otherwise not found. */
  private async visibleWorkout(viewerId: string, workoutId: string): Promise<WorkoutRow> {
    const client = this.supabaseService.getClient();
    const { data, error } = await client
      .from('workouts')
      .select('id, user_id, name, performed_at, completed_at, deleted_at, logged_by')
      .eq('id', workoutId)
      .maybeSingle();
    if (error) throw new InternalServerErrorException('Failed to look up the workout');
    const workout = data as WorkoutRow | null;
    if (!workout || workout.deleted_at !== null || workout.completed_at === null) {
      throw new NotFoundException('Workout not found');
    }
    if (workout.user_id === viewerId) return workout;
    const relationship = await relationshipWith(client, viewerId, workout.user_id);
    if (!canSeeActivity(relationship) || workout.logged_by !== null) {
      throw new NotFoundException('Workout not found');
    }
    return workout;
  }
}
