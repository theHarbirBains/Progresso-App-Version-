import { Injectable, NotFoundException } from '@nestjs/common';
import { SupabaseService } from '../supabase/supabase.service';

export interface UserProfile {
  weightUnit: 'kg' | 'lb';
  displayName: string | null;
}

@Injectable()
export class UsersService {
  constructor(private readonly supabaseService: SupabaseService) {}

  async getProfile(userId: string): Promise<UserProfile> {
    const { data, error } = await this.supabaseService
      .getClient()
      .from('users')
      .select('weight_unit, display_name')
      .eq('id', userId)
      .maybeSingle();

    if (error || !data) {
      throw new NotFoundException('User profile not found');
    }

    return { weightUnit: data.weight_unit, displayName: data.display_name };
  }
}
