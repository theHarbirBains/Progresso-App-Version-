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
import type { MuscleGroup } from './muscle-group';

export interface ExerciseRecord {
  id: string;
  name: string;
  muscleGroup: MuscleGroup;
  isActive: boolean;
  createdBy: string | null;
  createdAt: string;
  updatedAt: string;
}

const UNIQUE_VIOLATION = '23505';

function toExerciseRecord(row: Record<string, unknown>): ExerciseRecord {
  return {
    id: row.id as string,
    name: row.name as string,
    muscleGroup: row.muscle_group as MuscleGroup,
    isActive: row.is_active as boolean,
    createdBy: (row.created_by as string | null) ?? null,
    createdAt: row.created_at as string,
    updatedAt: row.updated_at as string,
  };
}

@Injectable()
export class ExercisesService {
  constructor(private readonly supabaseService: SupabaseService) {}

  // created_by is always the caller's id -- never taken from the DTO, so a
  // client cannot create a built-in exercise (created_by null) or attribute
  // a custom exercise to another user.
  async createCustom(userId: string, dto: CreateExerciseDto): Promise<ExerciseRecord> {
    const { data, error } = await this.supabaseService
      .getClient()
      .from('exercises')
      .insert({ name: dto.name, muscle_group: dto.muscleGroup, created_by: userId })
      .select('*')
      .single();

    if (error) {
      if (error.code === UNIQUE_VIOLATION) {
        throw new ConflictException('You already have a custom exercise with that name');
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
    if (dto.isActive !== undefined) updatePayload.is_active = dto.isActive;

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
        throw new ConflictException('You already have a custom exercise with that name');
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
