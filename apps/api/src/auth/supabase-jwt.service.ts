import { Injectable } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { createRemoteJWKSet, jwtVerify, type JWTPayload } from 'jose';
import type { EnvironmentVariables } from '../config/env.validation';

export interface SupabaseJwtPayload extends JWTPayload {
  sub: string;
  email?: string;
}

/**
 * Verifies Supabase-issued JWTs against the project's JWKS endpoint.
 * Supabase signs tokens with an asymmetric key by default (since May 2025),
 * so verification only needs the public JWKS, not a shared secret.
 * See https://supabase.com/docs/guides/auth/jwts
 */
@Injectable()
export class SupabaseJwtService {
  private readonly jwks: ReturnType<typeof createRemoteJWKSet>;

  constructor(configService: ConfigService<EnvironmentVariables, true>) {
    const supabaseUrl = configService.get('SUPABASE_URL', { infer: true });
    this.jwks = createRemoteJWKSet(new URL(`${supabaseUrl}/auth/v1/.well-known/jwks.json`));
  }

  async verify(token: string): Promise<SupabaseJwtPayload> {
    const { payload } = await jwtVerify(token, this.jwks);
    return payload as SupabaseJwtPayload;
  }
}
