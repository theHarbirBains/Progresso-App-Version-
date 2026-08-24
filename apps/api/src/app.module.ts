import { Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { APP_GUARD } from '@nestjs/core';
import { AdminModule } from './admin/admin.module';
import { AuthModule } from './auth/auth.module';
import { SupabaseAuthGuard } from './auth/supabase-auth.guard';
import { validate } from './config/env.validation';
import { RolesGuard } from './common/guards/roles.guard';
import { ExercisesModule } from './exercises/exercises.module';
import { HealthModule } from './health/health.module';
import { RevenueCatModule } from './revenuecat/revenuecat.module';
import { SupabaseModule } from './supabase/supabase.module';
import { UsersModule } from './users/users.module';

@Module({
  imports: [
    ConfigModule.forRoot({
      isGlobal: true,
      validate,
      envFilePath: process.env.NODE_ENV === 'test' ? '.env.test' : '.env',
    }),
    SupabaseModule,
    AuthModule,
    HealthModule,
    UsersModule,
    ExercisesModule,
    AdminModule,
    RevenueCatModule,
  ],
  providers: [
    {
      provide: APP_GUARD,
      useClass: SupabaseAuthGuard,
    },
    {
      // Runs after SupabaseAuthGuard (registration order). No-ops on any
      // route without @Roles(...), so it costs nothing on the common path.
      provide: APP_GUARD,
      useClass: RolesGuard,
    },
  ],
})
export class AppModule {}
