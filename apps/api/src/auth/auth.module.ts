import { Module } from '@nestjs/common';
import { SupabaseAuthGuard } from './supabase-auth.guard';
import { SupabaseJwtService } from './supabase-jwt.service';

@Module({
  providers: [SupabaseJwtService, SupabaseAuthGuard],
  exports: [SupabaseJwtService, SupabaseAuthGuard],
})
export class AuthModule {}
