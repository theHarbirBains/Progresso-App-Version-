import {
  ForbiddenException,
  Injectable,
  InternalServerErrorException,
  NotFoundException,
} from '@nestjs/common';
import { FollowsService, type FollowUserSummary } from '../follows/follows.service';
import { isBlockedEitherWay, loadBlocks } from '../safety/blocks';
import { SupabaseService } from '../supabase/supabase.service';
import { toExerciseRecord, type ExerciseRecord } from './exercises.service';

/** How someone's library is shared with this person. */
export type ShareSource = 'trainer' | 'client' | 'friend';

/** Someone else's custom exercise, shared with this person -- never their old notes on it. */
export interface SharedExercise extends Omit<ExerciseRecord, 'feelNotes'> {
  source: ShareSource;
  owner: FollowUserSummary;
  /** This person already has one of their own by that name at that gym. */
  inLibrary: boolean;
}

const UNIQUE_VIOLATION = '23505';

/**
 * One machine in a library: its name, gym, grip and attachment (case and spaces aside), its photo,
 * how it's loaded, its pulley, where its cable starts and its equipment -- as the database's
 * exercise_machine_key has it. Setup notes aren't part of it. Two of a person's exercises may
 * share a name, told apart by these.
 */
function libraryKey(row: {
  name: string;
  gym: string | null;
  grip: string | null;
  attachment: string | null;
  photoUrl: string | null;
  loadType: string | null;
  pulley: string | null;
  pulleyPosition: string | null;
  equipment: string | null;
}): string {
  const text = (value: string | null) => (value ?? '').trim().toLowerCase();
  return [
    text(row.name),
    text(row.gym),
    text(row.grip),
    text(row.attachment),
    row.photoUrl ?? '',
    row.loadType ?? '',
    row.pulley ?? '',
    row.pulleyPosition ?? '',
    row.equipment ?? '',
  ].join('\u001f');
}

/** An exercise as it's shared: everything but an old note on how it feels. */
function withoutNotes(record: ExerciseRecord): Omit<ExerciseRecord, 'feelNotes'> {
  const shared: Partial<ExerciseRecord> = { ...record };
  delete shared.feelNotes;
  return shared as Omit<ExerciseRecord, 'feelNotes'>;
}

/**
 * Exercise libraries shared between people: a trainer and their active clients see each other's
 * custom exercises, and a person sees the custom exercises of the people they follow (an accepted
 * follow, as the Friends feed). A block either way shares nothing, and a tracked client (a
 * trainer's placeholder, not a person yet) has no library of its own to share. Using one makes it
 * the person's own -- a copy in their library (`copy`) -- so their history never depends on the
 * link or the follow lasting.
 */
@Injectable()
export class SharedExercisesService {
  constructor(
    private readonly supabaseService: SupabaseService,
    private readonly followsService: FollowsService,
  ) {}

  /** Everyone who shares their library with this user, and how. */
  private async sharers(userId: string): Promise<Map<string, ShareSource>> {
    const client = this.supabaseService.getClient();
    const [linksResult, followeeIds, blocks] = await Promise.all([
      // userId is the signed-in user's own id, from the verified token (see loadBlocks).
      client
        .from('trainer_clients')
        .select('trainer_id, client_id')
        .eq('status', 'active')
        .or(`trainer_id.eq.${userId},client_id.eq.${userId}`),
      this.followsService.listAcceptedFolloweeIds(userId),
      loadBlocks(client, userId),
    ]);
    if (linksResult.error) throw new InternalServerErrorException('Failed to load trainer links');
    const links = (linksResult.data ?? []) as { trainer_id: string; client_id: string }[];

    const clientIds = links.filter((l) => l.trainer_id === userId).map((l) => l.client_id);
    const tracked = new Set<string>();
    if (clientIds.length > 0) {
      const { data, error } = await client
        .from('trainer_placeholder_clients')
        .select('placeholder_user_id')
        .in('placeholder_user_id', clientIds)
        .is('claimed_at', null);
      if (error) throw new InternalServerErrorException('Failed to load clients');
      for (const row of (data ?? []) as { placeholder_user_id: string }[]) {
        tracked.add(row.placeholder_user_id);
      }
    }

    const sharers = new Map<string, ShareSource>();
    for (const link of links) {
      if (link.client_id === userId) sharers.set(link.trainer_id, 'trainer');
      else if (!tracked.has(link.client_id)) sharers.set(link.client_id, 'client');
    }
    // A trainer or client who is also followed reads as the trainer or client.
    for (const id of followeeIds) if (!sharers.has(id)) sharers.set(id, 'friend');
    for (const id of sharers.keys()) {
      if (id === userId || isBlockedEitherWay(blocks, id)) sharers.delete(id);
    }
    return sharers;
  }

  /** This user's own active custom exercises. */
  private async ownExercises(userId: string): Promise<ExerciseRecord[]> {
    const { data, error } = await this.supabaseService
      .getClient()
      .from('exercises')
      .select('*')
      .eq('created_by', userId)
      .eq('is_active', true);
    if (error) throw new InternalServerErrorException('Failed to load your exercises');
    return ((data ?? []) as Record<string, unknown>[]).map(toExerciseRecord);
  }

  /** Every custom exercise shared with this user, A-Z, each with its owner and how it's shared. */
  async list(userId: string): Promise<SharedExercise[]> {
    const sharers = await this.sharers(userId);
    if (sharers.size === 0) return [];
    const ownerIds = Array.from(sharers.keys());

    const [exercisesResult, own, owners] = await Promise.all([
      this.supabaseService
        .getClient()
        .from('exercises')
        .select('*')
        .in('created_by', ownerIds)
        .eq('is_active', true)
        .order('name', { ascending: true }),
      this.ownExercises(userId),
      this.followsService.getUserSummaries(ownerIds),
    ]);
    if (exercisesResult.error) {
      throw new InternalServerErrorException('Failed to load shared exercises');
    }

    const mine = new Set(own.map(libraryKey));
    return ((exercisesResult.data ?? []) as Record<string, unknown>[]).map((row) => {
      const exercise = withoutNotes(toExerciseRecord(row));
      const ownerId = exercise.createdBy as string;
      return {
        ...exercise,
        source: sharers.get(ownerId) as ShareSource,
        owner: owners.get(ownerId) ?? {
          id: ownerId,
          username: null,
          displayName: null,
          avatarUrl: null,
        },
        inLibrary: mine.has(libraryKey(exercise)),
      };
    });
  }

  /**
   * Makes a shared exercise this user's own: their own of the very same machine (libraryKey) if
   * they have one, otherwise a copy of it in their library -- its name, muscle, movement, what it
   * measures, photo, gym, equipment, grip, attachment, loading, pulley and setup notes. A built-in,
   * or one already theirs, is returned as it is.
   */
  async copy(userId: string, exerciseId: string): Promise<ExerciseRecord> {
    const client = this.supabaseService.getClient();
    const { data, error } = await client
      .from('exercises')
      .select('*')
      .eq('id', exerciseId)
      .maybeSingle();
    if (error) throw new InternalServerErrorException('Failed to look up exercise');
    if (!data) throw new NotFoundException('Exercise not found');
    const source = toExerciseRecord(data as Record<string, unknown>);
    if (!source.isActive) throw new NotFoundException('That exercise has been deleted');
    if (source.createdBy === null || source.createdBy === userId) return source;

    const sharers = await this.sharers(userId);
    if (!sharers.has(source.createdBy)) {
      throw new ForbiddenException('That exercise is not shared with you');
    }

    const existing = await this.findOwn(userId, source);
    if (existing) return existing;

    const { data: created, error: insertError } = await client
      .from('exercises')
      .insert({
        created_by: userId,
        name: source.name,
        muscle_group: source.muscleGroup,
        movement_type: source.movementType,
        logging_style: source.loggingStyle,
        measurement_type: source.measurementType,
        photo_url: source.photoUrl,
        gym: source.gym,
        attachment: source.attachment,
        load_type: source.loadType,
        pulley: source.pulley,
        equipment: source.equipment,
        grip: source.grip,
        pulley_position: source.pulleyPosition,
        setup_details: source.setupDetails,
      })
      .select('*')
      .single();
    if (insertError) {
      // Added a moment ago (another tap, another device): that one is theirs.
      if (insertError.code === UNIQUE_VIOLATION) {
        const raced = await this.findOwn(userId, source);
        if (raced) return raced;
      }
      throw new InternalServerErrorException('Failed to add the exercise to your library');
    }
    return toExerciseRecord(created as Record<string, unknown>);
  }

  private async findOwn(userId: string, like: ExerciseRecord): Promise<ExerciseRecord | null> {
    const key = libraryKey(like);
    return (await this.ownExercises(userId)).find((own) => libraryKey(own) === key) ?? null;
  }
}
