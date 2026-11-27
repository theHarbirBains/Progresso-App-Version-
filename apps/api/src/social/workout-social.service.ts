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
import { canSeeActivity, relationshipsWith, relationshipWith } from './relationship';
import {
  CARDIO_COLUMNS,
  toWorkoutCardio,
  type CardioRow,
  type WorkoutCardio,
} from '../feed/workout-cardio';

const UNIQUE_VIOLATION = '23505';

interface WorkoutRow {
  id: string;
  user_id: string;
  name: string;
  performed_at: string;
  completed_at: string | null;
  deleted_at: string | null;
  logged_by: string | null;
  strength_ended_at?: string | null;
  group_id?: string | null;
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

/**
 * One person who trained in a group workout, as someone else sees them: always who they are --
 * the group's record is never changed by who's looking -- and their workout's id only when the
 * viewer may open it (GET /workouts/:id checks again): it's their own, they follow them
 * (accepted), the profile is public, or the viewer trained in the group too. Otherwise null, and
 * nothing of what they did is in the answer.
 */
export interface GroupParticipant {
  user: FollowUserSummary;
  /** The workout this answer is. */
  isAuthor: boolean;
  /** Whether the viewer may see what they did. */
  canSeeWorkout: boolean;
  workoutId: string | null;
}

export interface WorkoutGroupForViewer {
  id: string;
  name: string;
  /** Everyone who trained in it -- the workout's author first -- leaving out anyone blocked
   * either way, and anyone with nothing logged. */
  participants: GroupParticipant[];
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
  /** Its cardio, in the order added -- never sets or exercises. */
  cardio: WorkoutCardio[];
  /** When its strength part ended, for cardio after it. */
  strengthEndedAt: string | null;
  /** The group workout it was part of, or null when it wasn't one. */
  group: WorkoutGroupForViewer | null;
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
    // Reading a workout, someone who trained in the same group may open it too.
    const workout = await this.visibleWorkout(viewerId, workoutId, { groupmates: true });
    const client = this.supabaseService.getClient();
    const { data: cardioRows, error: cardioError } = await client
      .from('workout_cardio')
      .select(CARDIO_COLUMNS)
      .eq('workout_id', workoutId)
      .order('created_at', { ascending: true });
    if (cardioError) throw new InternalServerErrorException('Failed to load the workout');
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
      cardio: ((cardioRows ?? []) as CardioRow[]).map(toWorkoutCardio),
      strengthEndedAt: workout.strength_ended_at ?? null,
      group: workout.group_id ? await this.groupFor(viewerId, workout) : null,
    };
  }

  /**
   * The group a workout was part of, as this viewer may see it: everyone who trained in it, by
   * name and photo, each with their workout's id only where canSeeActivity allows it -- or the
   * viewer trained in it too (the people in a group see its workouts). Nobody is dropped or
   * changed for not being followed; only someone blocked either way is left out.
   */
  private async groupFor(
    viewerId: string,
    workout: WorkoutRow,
  ): Promise<WorkoutGroupForViewer | null> {
    const client = this.supabaseService.getClient();
    const groupId = workout.group_id as string;
    const [group, workouts] = await Promise.all([
      client.from('workout_groups').select('id, name').eq('id', groupId).maybeSingle(),
      client
        .from('workouts')
        .select('id, user_id, created_at')
        .eq('group_id', groupId)
        .is('deleted_at', null)
        .not('completed_at', 'is', null)
        .order('created_at', { ascending: true }),
    ]);
    if (group.error || workouts.error) {
      throw new InternalServerErrorException('Failed to load the group workout');
    }
    if (!group.data) return null;
    const rows = (workouts.data ?? []) as { id: string; user_id: string }[];
    const ids = rows.map((row) => row.id);
    // Only someone who did something: a finished set, or cardio (a trainer who only coached has
    // neither).
    const [sets, cardio] = await Promise.all([
      client
        .from('sets')
        .select('id, workout_exercises!inner(workout_id)')
        .in('workout_exercises.workout_id', ids)
        .is('deleted_at', null)
        .not('completed_at', 'is', null),
      client.from('workout_cardio').select('workout_id').in('workout_id', ids),
    ]);
    if (sets.error || cardio.error) {
      throw new InternalServerErrorException('Failed to load the group workout');
    }
    const active = new Set<string>([
      ...((sets.data ?? []) as unknown as { workout_exercises: { workout_id: string } | null }[])
        .map((row) => row.workout_exercises?.workout_id)
        .filter((id): id is string => typeof id === 'string'),
      ...((cardio.data ?? []) as { workout_id: string }[]).map((row) => row.workout_id),
    ]);
    const trained = rows.filter((row) => row.id === workout.id || active.has(row.id));
    const viewerTrainedHere = trained.some((row) => row.user_id === viewerId);
    const relationships = await relationshipsWith(
      client,
      viewerId,
      trained.map((row) => row.user_id),
    );
    const summaries = await this.followsService.getUserSummaries(trained.map((row) => row.user_id));
    const participants = trained
      .filter((row) => relationships.has(row.user_id))
      .map((row): GroupParticipant => {
        const canSee =
          row.id === workout.id ||
          viewerTrainedHere ||
          canSeeActivity(relationships.get(row.user_id)!);
        return {
          user: summaries.get(row.user_id) ?? unknownUser(row.user_id),
          isAuthor: row.id === workout.id,
          canSeeWorkout: canSee,
          workoutId: canSee ? row.id : null,
        };
      })
      .sort((a, b) => Number(b.isAuthor) - Number(a.isAuthor));
    const name = (group.data as { name: string }).name;
    return { id: groupId, name, participants };
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
      void this.socialPush.record({
        type: 'workout_like',
        recipientId: workout.user_id,
        actorId: viewerId,
        workoutId,
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
    const row = data as { id: string; created_at: string };
    if (workout.user_id !== viewerId) {
      void this.socialPush.record({
        type: 'workout_comment',
        recipientId: workout.user_id,
        actorId: viewerId,
        workoutId,
        commentId: row.id,
        text,
      });
    }
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

  /**
   * The workout, when the viewer can see it; otherwise not found. To read it (`groupmates`),
   * someone who trained in the same group workout may too -- liking and commenting stay with the
   * owner's followers.
   */
  private async visibleWorkout(
    viewerId: string,
    workoutId: string,
    { groupmates = false }: { groupmates?: boolean } = {},
  ): Promise<WorkoutRow> {
    const client = this.supabaseService.getClient();
    const { data, error } = await client
      .from('workouts')
      .select(
        'id, user_id, name, performed_at, completed_at, deleted_at, logged_by, strength_ended_at, group_id',
      )
      .eq('id', workoutId)
      .maybeSingle();
    if (error) throw new InternalServerErrorException('Failed to look up the workout');
    const workout = data as WorkoutRow | null;
    if (!workout || workout.deleted_at !== null || workout.completed_at === null) {
      throw new NotFoundException('Workout not found');
    }
    if (workout.user_id === viewerId) return workout;
    const relationship = await relationshipWith(client, viewerId, workout.user_id);
    if (workout.logged_by !== null) throw new NotFoundException('Workout not found');
    if (canSeeActivity(relationship)) return workout;
    if (groupmates && workout.group_id && (await this.trainedIn(viewerId, workout.group_id))) {
      return workout;
    }
    throw new NotFoundException('Workout not found');
  }

  /** Whether the viewer trained in this group: a workout of their own in it, not deleted. */
  private async trainedIn(viewerId: string, groupId: string): Promise<boolean> {
    const { data, error } = await this.supabaseService
      .getClient()
      .from('workouts')
      .select('id')
      .eq('group_id', groupId)
      .eq('user_id', viewerId)
      .is('deleted_at', null)
      .limit(1);
    if (error) throw new InternalServerErrorException('Failed to look up the workout');
    return ((data ?? []) as unknown[]).length > 0;
  }
}
