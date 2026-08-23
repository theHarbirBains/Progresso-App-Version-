import { Injectable } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { createClient, SupabaseClient } from '@supabase/supabase-js';
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
}
