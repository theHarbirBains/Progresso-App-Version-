import {
  ConflictException,
  Injectable,
  InternalServerErrorException,
  NotFoundException,
} from '@nestjs/common';
import { SupabaseService } from '../supabase/supabase.service';
import type { UpdateUserDto } from './dto/update-user.dto';

export interface UserProfile {
  weightUnit: 'kg' | 'lb';
  displayName: string | null;
  username: string | null;
}

const USERNAME_UNIQUE_VIOLATION = '23505';

@Injectable()
export class UsersService {
  constructor(private readonly supabaseService: SupabaseService) {}

  async getProfile(userId: string): Promise<UserProfile> {
    const { data, error } = await this.supabaseService
      .getClient()
      .from('users')
      .select('weight_unit, display_name, username')
      .eq('id', userId)
      .maybeSingle();

    if (error || !data) {
      throw new NotFoundException('User profile not found');
    }

    return {
      weightUnit: data.weight_unit,
      displayName: data.display_name,
      username: data.username,
    };
  }

  async updateProfile(userId: string, dto: UpdateUserDto): Promise<UserProfile> {
    const updatePayload: Record<string, unknown> = {};
    if (dto.displayName !== undefined) updatePayload.display_name = dto.displayName;
    if (dto.username !== undefined) updatePayload.username = dto.username;
    if (dto.weightUnit !== undefined) updatePayload.weight_unit = dto.weightUnit;

    if (Object.keys(updatePayload).length === 0) {
      return this.getProfile(userId);
    }

    const { data, error } = await this.supabaseService
      .getClient()
      .from('users')
      .update(updatePayload)
      .eq('id', userId)
      .select('weight_unit, display_name, username')
      .maybeSingle();

    if (error) {
      if (error.code === USERNAME_UNIQUE_VIOLATION) {
        throw new ConflictException('That username is already taken');
      }
      throw new InternalServerErrorException('Failed to update profile');
    }

    if (!data) {
      throw new NotFoundException('User profile not found');
    }

    return {
      weightUnit: data.weight_unit,
      displayName: data.display_name,
      username: data.username,
    };
  }

  /** True when the username is free, or already belongs to this same user. */
  async isUsernameAvailable(username: string, currentUserId: string): Promise<boolean> {
    const normalized = username.toLowerCase().trim();

    const { data, error } = await this.supabaseService
      .getClient()
      .from('users')
      .select('id')
      .eq('username', normalized)
      .maybeSingle();

    if (error) {
      throw new InternalServerErrorException('Failed to check username availability');
    }

    return !data || data.id === currentUserId;
  }
}
