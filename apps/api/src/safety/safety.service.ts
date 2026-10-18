import {
  BadRequestException,
  Injectable,
  InternalServerErrorException,
  NotFoundException,
} from '@nestjs/common';
import { FollowsService, type FollowUserSummary } from '../follows/follows.service';
import { SupabaseService } from '../supabase/supabase.service';
import type { CreateReportDto } from './dto/create-report.dto';

/**
 * Blocking and reporting (20261020100000_blocks_and_reports.sql). A block is written by the
 * block_user function, which also removes what connected the two people; FollowsService,
 * GroupsService and TrainerService then refuse new connections between them. A report is
 * stored for review in the Supabase dashboard.
 */
@Injectable()
export class SafetyService {
  constructor(
    private readonly supabaseService: SupabaseService,
    private readonly followsService: FollowsService,
  ) {}

  /** The people this user has blocked, most recent first. */
  async listBlocked(userId: string): Promise<FollowUserSummary[]> {
    const { data, error } = await this.supabaseService
      .getClient()
      .from('user_blocks')
      .select('blocked_id')
      .eq('blocker_id', userId)
      .order('created_at', { ascending: false });
    if (error) throw new InternalServerErrorException('Failed to load blocked people');
    const ids = ((data ?? []) as { blocked_id: string }[]).map((row) => row.blocked_id);
    if (ids.length === 0) return [];

    const users = await this.followsService.getUserSummaries(ids);
    return ids.map(
      (id) => users.get(id) ?? { id, username: null, displayName: null, avatarUrl: null },
    );
  }

  async block(userId: string, targetId: string): Promise<void> {
    if (userId === targetId) throw new BadRequestException('You cannot block yourself');
    await this.requireUser(targetId);

    const { error } = await this.supabaseService
      .getClient()
      .rpc('block_user', { p_blocker: userId, p_blocked: targetId });
    if (error) throw new InternalServerErrorException('Failed to block this person');
  }

  /** Idempotent: unblocking someone who isn't blocked does nothing. */
  async unblock(userId: string, targetId: string): Promise<void> {
    const { error } = await this.supabaseService
      .getClient()
      .from('user_blocks')
      .delete()
      .eq('blocker_id', userId)
      .eq('blocked_id', targetId);
    if (error) throw new InternalServerErrorException('Failed to unblock this person');
  }

  async report(userId: string, dto: CreateReportDto): Promise<{ id: string }> {
    if (userId === dto.reportedUserId) throw new BadRequestException('You cannot report yourself');
    await this.requireUser(dto.reportedUserId);

    const client = this.supabaseService.getClient();
    if (dto.workoutId) {
      // Only a workout of the person being reported, so a report always points at real content.
      const { data: workout, error } = await client
        .from('workouts')
        .select('id')
        .eq('id', dto.workoutId)
        .eq('user_id', dto.reportedUserId)
        .maybeSingle();
      if (error) throw new InternalServerErrorException('Failed to look up the workout');
      if (!workout) throw new NotFoundException('Workout not found');
    }

    const { data, error } = await client
      .from('user_reports')
      .insert({
        reporter_id: userId,
        reported_user_id: dto.reportedUserId,
        workout_id: dto.workoutId ?? null,
        reason: dto.reason,
        details: dto.details ? dto.details : null,
      })
      .select('id')
      .single();
    if (error || !data) throw new InternalServerErrorException('Failed to send the report');
    return { id: (data as { id: string }).id };
  }

  private async requireUser(id: string): Promise<void> {
    const { data, error } = await this.supabaseService
      .getClient()
      .from('users')
      .select('id')
      .eq('id', id)
      .maybeSingle();
    if (error) throw new InternalServerErrorException('Failed to look up user');
    if (!data) throw new NotFoundException('User not found');
  }
}
