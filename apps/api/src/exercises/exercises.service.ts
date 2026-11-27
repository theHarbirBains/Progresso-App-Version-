import {
  ConflictException,
  ForbiddenException,
  Injectable,
  InternalServerErrorException,
  NotFoundException,
} from '@nestjs/common';
import { SupabaseService } from '../supabase/supabase.service';
import type { CreateExerciseDto } from './dto/create-exercise.dto';
import type { UpdateExerciseDto } from './dto/update-exercise.dto';
import { cleanSecondaryGroups, type MuscleGroup } from './muscle-group';
import {
  isLegacyGrip,
  type Equipment,
  type LoadType,
  type LoggingStyle,
  type MeasurementType,
  type MovementType,
  type Pulley,
  type PulleyPosition,
} from './movement-type';

export interface ExerciseRecord {
  id: string;
  name: string;
  muscleGroup: MuscleGroup;
  /** The muscles it also works (never its own group): its page shows them, the heat map counts them. */
  secondaryMuscleGroups: MuscleGroup[];
  movementType: MovementType;
  loggingStyle: LoggingStyle | null;
  measurementType: MeasurementType;
  photoUrl: string | null;
  /** Where the machine is, how it feels next to others like it, its bar or handle. */
  gym: string | null;
  feelNotes: string | null;
  attachment: string | null;
  /** How it's loaded (one stack, two, or plates); the old heavier or lighter pulley, if it has one. */
  loadType: LoadType | null;
  pulley: Pulley | null;
  /** What it's done with, how it's held, where its cable starts, and notes on its setup. */
  equipment: Equipment | null;
  grip: string | null;
  pulleyPosition: PulleyPosition | null;
  setupDetails: string | null;
  isActive: boolean;
  createdBy: string | null;
  createdAt: string;
  updatedAt: string;
}

const UNIQUE_VIOLATION = '23505';

export function toExerciseRecord(row: Record<string, unknown>): ExerciseRecord {
  return {
    id: row.id as string,
    name: row.name as string,
    muscleGroup: row.muscle_group as MuscleGroup,
    secondaryMuscleGroups: (row.secondary_muscle_groups as MuscleGroup[] | null) ?? [],
    movementType: row.movement_type as MovementType,
    loggingStyle: (row.logging_style as LoggingStyle | null) ?? null,
    measurementType: (row.measurement_type as MeasurementType | undefined) ?? 'weight_reps',
    photoUrl: (row.photo_url as string | null) ?? null,
    gym: (row.gym as string | null) ?? null,
    feelNotes: (row.feel_notes as string | null) ?? null,
    attachment: (row.attachment as string | null) ?? null,
    loadType: (row.load_type as LoadType | null) ?? null,
    pulley: (row.pulley as Pulley | null) ?? null,
    equipment: (row.equipment as Equipment | null) ?? null,
    grip: (row.grip as string | null) ?? null,
    pulleyPosition: (row.pulley_position as PulleyPosition | null) ?? null,
    setupDetails: (row.setup_details as string | null) ?? null,
    isActive: row.is_active as boolean,
    createdBy: (row.created_by as string | null) ?? null,
    createdAt: row.created_at as string,
    updatedAt: row.updated_at as string,
  };
}

/**
 * Grip and attachment as they're saved. An older app version sends a grip it offered ("Wide
 * grip") as the attachment, with no grip of its own: that's the grip.
 */
function gripAndAttachment(dto: { grip?: string | null; attachment?: string | null }): {
  grip?: string | null;
  attachment?: string | null;
} {
  if (dto.grip === undefined && isLegacyGrip(dto.attachment)) {
    return { grip: dto.attachment, attachment: null };
  }
  return { grip: dto.grip, attachment: dto.attachment };
}

@Injectable()
export class ExercisesService {
  constructor(private readonly supabaseService: SupabaseService) {}

  // created_by is always the caller's id -- never taken from the DTO, so a
  // client cannot create a built-in exercise (created_by null) or attribute
  // a custom exercise to another user.
  async createCustom(userId: string, dto: CreateExerciseDto): Promise<ExerciseRecord> {
    const held = gripAndAttachment(dto);
    const { data, error } = await this.supabaseService
      .getClient()
      .from('exercises')
      .insert({
        name: dto.name,
        muscle_group: dto.muscleGroup,
        secondary_muscle_groups: cleanSecondaryGroups(
          dto.secondaryMuscleGroups ?? [],
          dto.muscleGroup,
        ),
        created_by: userId,
        movement_type: dto.movementType,
        // Only a unilateral exercise ever has one -- CreateExerciseDto's
        // ValidateIf already guarantees dto.loggingStyle is present when
        // movementType is 'unilateral', so this is never silently null for
        // a unilateral exercise.
        logging_style: dto.movementType === 'unilateral' ? dto.loggingStyle : null,
        measurement_type: dto.measurementType ?? 'weight_reps',
        photo_url: dto.photoUrl ?? null,
        gym: dto.gym ?? null,
        feel_notes: dto.feelNotes ?? null,
        attachment: held.attachment ?? null,
        load_type: dto.loadType ?? null,
        pulley: dto.pulley ?? null,
        equipment: dto.equipment ?? null,
        grip: held.grip ?? null,
        pulley_position: dto.pulleyPosition ?? null,
        setup_details: dto.setupDetails ?? null,
      })
      .select('*')
      .single();

    if (error) {
      if (error.code === UNIQUE_VIOLATION) {
        throw new ConflictException(
          'You already have a custom exercise with that name at that gym',
        );
      }
      throw new InternalServerErrorException('Failed to create exercise');
    }

    return toExerciseRecord(data as Record<string, unknown>);
  }

  async updateCustom(
    userId: string,
    exerciseId: string,
    dto: UpdateExerciseDto,
  ): Promise<ExerciseRecord> {
    const existing = await this.getOwnedCustomExercise(userId, exerciseId);

    const updatePayload: Record<string, unknown> = {};
    if (dto.name !== undefined) updatePayload.name = dto.name;
    if (dto.muscleGroup !== undefined) updatePayload.muscle_group = dto.muscleGroup;
    // The muscles it also works, as sent -- and never its own group, so a new main muscle leaves
    // the list too.
    if (dto.secondaryMuscleGroups !== undefined || dto.muscleGroup !== undefined) {
      updatePayload.secondary_muscle_groups = cleanSecondaryGroups(
        dto.secondaryMuscleGroups ?? existing.secondaryMuscleGroups,
        dto.muscleGroup ?? existing.muscleGroup,
      );
    }
    if (dto.isActive !== undefined) updatePayload.is_active = dto.isActive;
    if (dto.movementType !== undefined) {
      updatePayload.movement_type = dto.movementType;
      // Switching to bilateral always clears logging_style (it's only ever
      // meaningful for a unilateral exercise -- see the database's own
      // exercises_logging_style_matches_movement_type check constraint);
      // switching to unilateral requires dto.loggingStyle, already enforced
      // by UpdateExerciseDto's ValidateIf.
      updatePayload.logging_style = dto.movementType === 'unilateral' ? dto.loggingStyle : null;
    } else if (dto.loggingStyle !== undefined) {
      updatePayload.logging_style = dto.loggingStyle;
    }
    if (dto.photoUrl !== undefined) updatePayload.photo_url = dto.photoUrl;
    if (dto.gym !== undefined) updatePayload.gym = dto.gym;
    if (dto.feelNotes !== undefined) updatePayload.feel_notes = dto.feelNotes;
    const held = gripAndAttachment(dto);
    if (held.attachment !== undefined) updatePayload.attachment = held.attachment;
    if (held.grip !== undefined) updatePayload.grip = held.grip;
    if (dto.loadType !== undefined) updatePayload.load_type = dto.loadType;
    if (dto.pulley !== undefined) updatePayload.pulley = dto.pulley;
    if (dto.equipment !== undefined) updatePayload.equipment = dto.equipment;
    if (dto.pulleyPosition !== undefined) updatePayload.pulley_position = dto.pulleyPosition;
    if (dto.setupDetails !== undefined) updatePayload.setup_details = dto.setupDetails;
    if (dto.measurementType !== undefined) updatePayload.measurement_type = dto.measurementType;

    if (Object.keys(updatePayload).length === 0) {
      return existing;
    }

    const { data, error } = await this.supabaseService
      .getClient()
      .from('exercises')
      .update(updatePayload)
      .eq('id', exerciseId)
      .select('*')
      .maybeSingle();

    if (error) {
      if (error.code === UNIQUE_VIOLATION) {
        throw new ConflictException(
          'You already have a custom exercise with that name at that gym',
        );
      }
      throw new InternalServerErrorException('Failed to update exercise');
    }

    if (!data) {
      throw new NotFoundException('Exercise not found');
    }

    return toExerciseRecord(data as Record<string, unknown>);
  }

  /**
   * The backend's Supabase client uses the service-role key and bypasses
   * RLS entirely, so this ownership check -- not the database -- is what
   * actually stops a user from editing a built-in exercise (created_by is
   * null) or someone else's custom exercise.
   */
  private async getOwnedCustomExercise(
    userId: string,
    exerciseId: string,
  ): Promise<ExerciseRecord> {
    const { data, error } = await this.supabaseService
      .getClient()
      .from('exercises')
      .select('*')
      .eq('id', exerciseId)
      .maybeSingle();

    if (error) {
      throw new InternalServerErrorException('Failed to look up exercise');
    }
    if (!data) {
      throw new NotFoundException('Exercise not found');
    }

    const record = toExerciseRecord(data as Record<string, unknown>);
    if (record.createdBy !== userId) {
      throw new ForbiddenException('You can only modify your own custom exercises');
    }

    return record;
  }
}
