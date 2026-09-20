import { Injectable, InternalServerErrorException, NotFoundException } from '@nestjs/common';
import { SupabaseService } from '../supabase/supabase.service';
import type { CreateEquipmentProfileDto } from './dto/create-equipment-profile.dto';

export interface EquipmentProfileRecord {
  id: string;
  exerciseId: string;
  name: string;
  gym: string | null;
  photoUrl: string | null;
  createdBy: string;
  createdAt: string;
  updatedAt: string;
}

const FOREIGN_KEY_VIOLATION = '23503';

function toEquipmentProfileRecord(row: Record<string, unknown>): EquipmentProfileRecord {
  return {
    id: row.id as string,
    exerciseId: row.exercise_id as string,
    name: row.name as string,
    gym: (row.gym as string | null) ?? null,
    photoUrl: (row.photo_url as string | null) ?? null,
    createdBy: row.created_by as string,
    createdAt: row.created_at as string,
    updatedAt: row.updated_at as string,
  };
}

// Purely descriptive/contextual today: nothing here feeds Top Set/PR
// computation, so creating a profile has no effect on progression history.
// See the equipment_profiles migration for the full rationale.
@Injectable()
export class EquipmentProfilesService {
  constructor(private readonly supabaseService: SupabaseService) {}

  // created_by is always the caller's id -- never taken from the DTO, so a
  // client cannot attribute an equipment profile to another user.
  async create(userId: string, dto: CreateEquipmentProfileDto): Promise<EquipmentProfileRecord> {
    const { data, error } = await this.supabaseService
      .getClient()
      .from('equipment_profiles')
      .insert({
        exercise_id: dto.exerciseId,
        created_by: userId,
        name: dto.name,
        gym: dto.gym ?? null,
        photo_url: dto.photoUrl ?? null,
      })
      .select('*')
      .single();

    if (error) {
      if (error.code === FOREIGN_KEY_VIOLATION) {
        throw new NotFoundException('Exercise not found');
      }
      throw new InternalServerErrorException('Failed to create equipment profile');
    }

    return toEquipmentProfileRecord(data as Record<string, unknown>);
  }
}
