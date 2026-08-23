import { Injectable, InternalServerErrorException } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { createClient, SupabaseClient } from '@supabase/supabase-js';
import { Role } from '../common/enums/role.enum';
import type { EnvironmentVariables } from '../config/env.validation';

/**
 * Server-only Supabase client using the service role key. Bypasses RLS —
 * never exposed to the mobile app, never used to act on behalf of a user
 * without an explicit authorization check first.
 */
@Injectable()
export class SupabaseService {
  private readonly client: SupabaseClient;

  constructor(configService: ConfigService<EnvironmentVariables, true>) {
    this.client = createClient(
      configService.get('SUPABASE_URL', { infer: true }),
      configService.get('SUPABASE_SERVICE_ROLE_KEY', { infer: true }),
      { auth: { autoRefreshToken: false, persistSession: false } },
    );
  }

  getClient(): SupabaseClient {
    return this.client;
  }

  /**
   * The only trusted source for a user's elevated role: a row in
   * admin_users, writable exclusively by service-role. Returns null for a
   * regular user (no row).
   */
  async getAdminRole(userId: string): Promise<Role | null> {
    const { data, error } = await this.client
      .from('admin_users')
      .select('role')
      .eq('user_id', userId)
      .maybeSingle();

    if (error) {
      throw new InternalServerErrorException('Failed to resolve admin role');
    }

    return (data?.role as Role | undefined) ?? null;
  }
}
