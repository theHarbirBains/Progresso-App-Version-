import {
  BadRequestException,
  ForbiddenException,
  Injectable,
  InternalServerErrorException,
  NotFoundException,
} from '@nestjs/common';
import { SupabaseService } from '../supabase/supabase.service';
import type { AddClientDto } from './dto/add-client.dto';
import type { LogWorkoutDto } from './dto/log-workout.dto';
import type { UpdateClientProfileDto } from './dto/update-client-profile.dto';

export type TrainerLinkStatus = 'pending' | 'active' | 'ended';
export type TrainerLinkSource = 'managed' | 'linked';

export interface TrainerClientSummary {
  clientId: string;
  status: 'pending' | 'active';
  source: TrainerLinkSource;
  displayName: string | null;
  birthday: string | null;
  heightValue: number | null;
  heightUnit: 'cm' | 'ft_in';
  weightValue: number | null;
  weightUnit: 'kg' | 'lb';
}

export interface TrainerRequestSummary {
  trainerId: string;
  trainerDisplayName: string | null;
  requestedAt: string;
}

export interface TrainerActionSummary {
  id: string;
  trainerId: string;
  clientId: string | null;
  action: string;
  targetTable: string | null;
  targetId: string | null;
  details: Record<string, unknown>;
  createdAt: string;
}

const TRAINER_ENTITLEMENT = 'trainer';
const ACTION_LIST_LIMIT = 100;

interface LinkRow {
  id: string;
  status: TrainerLinkStatus;
  source: TrainerLinkSource;
}

interface ProfileFields {
  display_name?: string;
  birthday?: string;
  height_value?: number;
  height_unit?: 'cm' | 'ft_in';
  weight_value?: number;
  weight_unit?: 'kg' | 'lb';
}

/**
 * Trainer mode, workouts only (docs/proposals/trainer-mode/README.md).
 *
 * Every method here is cross-user-trusted, so it runs through the service-role
 * client and checks authorization in code first. The database enforces the
 * same rules independently (trainer policies, and trainer_log_workout), so a
 * bug here cannot expose another user's data through the mobile app's own
 * direct reads.
 */
@Injectable()
export class TrainerService {
  constructor(private readonly supabaseService: SupabaseService) {}

  async getStatus(userId: string): Promise<{ isTrainer: boolean }> {
    return { isTrainer: await this.hasTrainerEntitlement(userId) };
  }

  async listClients(trainerId: string): Promise<TrainerClientSummary[]> {
    await this.assertTrainer(trainerId);
    const client = this.supabaseService.getClient();

    const { data: links, error: linksError } = await client
      .from('trainer_clients')
      .select('client_id, status, source')
      .eq('trainer_id', trainerId)
      .in('status', ['pending', 'active']);
    if (linksError) throw new InternalServerErrorException('Failed to load clients');

    const linkRows = (links ?? []) as {
      client_id: string;
      status: 'pending' | 'active';
      source: TrainerLinkSource;
    }[];
    if (linkRows.length === 0) return [];

    const profiles = await this.loadProfiles(linkRows.map((row) => row.client_id));
    return linkRows.map((row) => {
      const profile = profiles.get(row.client_id);
      return {
        clientId: row.client_id,
        status: row.status,
        source: row.source,
        displayName: profile?.display_name ?? null,
        birthday: profile?.birthday ?? null,
        heightValue: profile?.height_value ?? null,
        heightUnit: profile?.height_unit ?? 'cm',
        weightValue: profile?.weight_value ?? null,
        weightUnit: profile?.weight_unit ?? 'kg',
      };
    });
  }

  /**
   * Adds a client by email. A new email creates a managed account (an invite
   * is sent) and the trainer can log for it straight away. An existing account
   * gets a pending link request, which the client must accept.
   */
  async addClient(
    trainerId: string,
    dto: AddClientDto,
  ): Promise<{ clientId: string; status: 'pending' | 'active'; source: TrainerLinkSource }> {
    await this.assertTrainer(trainerId);
    const email = dto.email.trim().toLowerCase();
    const existingId = await this.findUserIdByEmail(email);

    if (existingId === trainerId) {
      throw new BadRequestException('You cannot add yourself as a client');
    }

    if (existingId) {
      const status = await this.requestLink(trainerId, existingId);
      return { clientId: existingId, status, source: 'linked' };
    }

    if (!dto.displayName) {
      throw new BadRequestException('A name is required to add a new client');
    }

    const client = this.supabaseService.getClient();
    const { data, error } = await client.auth.admin.inviteUserByEmail(email, {
      data: { display_name: dto.displayName, managed_by_trainer: true },
    });
    if (error || !data?.user) {
      throw new BadRequestException('Could not send an invite to that email address');
    }
    const clientId = data.user.id;

    await this.updateProfile(clientId, {
      display_name: dto.displayName,
      birthday: dto.birthday,
      height_value: dto.heightValue,
      height_unit: dto.heightUnit,
      weight_value: dto.weightValue,
      weight_unit: dto.weightUnit,
    });

    const { error: linkError } = await client.from('trainer_clients').insert({
      trainer_id: trainerId,
      client_id: clientId,
      status: 'active',
      source: 'managed',
    });
    if (linkError) throw new InternalServerErrorException('Failed to link client');

    await this.audit(trainerId, clientId, 'client.created', 'trainer_clients', null, {});
    return { clientId, status: 'active', source: 'managed' };
  }

  /** Edits a managed client's profile. Linked accounts belong to their owner, so they are refused. */
  async updateManagedProfile(
    trainerId: string,
    clientId: string,
    dto: UpdateClientProfileDto,
  ): Promise<void> {
    await this.assertTrainer(trainerId);
    const link = await this.assertActiveLink(trainerId, clientId);
    if (link.source !== 'managed') {
      throw new ForbiddenException('Only a client you created can be edited here');
    }

    const changed = Object.keys(dto).filter(
      (key) => dto[key as keyof UpdateClientProfileDto] !== undefined,
    );
    await this.updateProfile(clientId, {
      display_name: dto.displayName,
      birthday: dto.birthday,
      height_value: dto.heightValue,
      height_unit: dto.heightUnit,
      weight_value: dto.weightValue,
      weight_unit: dto.weightUnit,
    });
    await this.audit(trainerId, clientId, 'client.profile_updated', 'users', clientId, {
      fields: changed,
    });
  }

  /**
   * Logs a whole workout for an active client, through the atomic
   * trainer_log_workout function (one transaction; PRs recompute inside it).
   */
  async logWorkout(
    trainerId: string,
    clientId: string,
    dto: LogWorkoutDto,
  ): Promise<{ workoutId: string }> {
    await this.assertTrainer(trainerId);
    await this.assertActiveLink(trainerId, clientId);

    const payload = {
      name: dto.name,
      performedAt: dto.performedAt,
      completedAt: dto.completedAt ?? null,
      notes: dto.notes ?? null,
      exercises: dto.exercises.map((exercise) => ({
        exerciseId: exercise.exerciseId,
        sets: exercise.sets.map((set) => ({
          setIndex: set.setIndex,
          side: set.side ?? 'none',
          weightKg: set.weightKg,
          reps: set.reps,
        })),
      })),
    };

    const { data, error } = await this.supabaseService.getClient().rpc('trainer_log_workout', {
      p_trainer_id: trainerId,
      p_client_id: clientId,
      p_payload: payload,
    });
    if (error) throw this.mapLogError(error.message);

    const workoutId = data as string;
    await this.audit(trainerId, clientId, 'workout.logged', 'workouts', workoutId, {
      exercises: dto.exercises.length,
    });
    return { workoutId };
  }

  /** The caller's pending link requests from trainers (client side). */
  async listRequests(clientId: string): Promise<TrainerRequestSummary[]> {
    const client = this.supabaseService.getClient();
    const { data: links, error } = await client
      .from('trainer_clients')
      .select('trainer_id, created_at')
      .eq('client_id', clientId)
      .eq('status', 'pending');
    if (error) throw new InternalServerErrorException('Failed to load trainer requests');

    const rows = (links ?? []) as { trainer_id: string; created_at: string }[];
    if (rows.length === 0) return [];

    const profiles = await this.loadProfiles(rows.map((row) => row.trainer_id));
    return rows.map((row) => ({
      trainerId: row.trainer_id,
      trainerDisplayName: profiles.get(row.trainer_id)?.display_name ?? null,
      requestedAt: row.created_at,
    }));
  }

  /** Client accepts or declines a trainer's pending request. */
  async respondToRequest(
    clientId: string,
    trainerId: string,
    action: 'accept' | 'decline',
  ): Promise<void> {
    const link = await this.findLink(trainerId, clientId);
    if (!link || link.status !== 'pending') {
      throw new NotFoundException('Trainer request not found');
    }

    const update: { status: TrainerLinkStatus; ended_at: string | null } =
      action === 'accept'
        ? { status: 'active', ended_at: null }
        : { status: 'ended', ended_at: new Date().toISOString() };
    await this.updateLink(trainerId, clientId, update);
    await this.audit(
      trainerId,
      clientId,
      action === 'accept' ? 'link.accepted' : 'link.declined',
      'trainer_clients',
      link.id,
      {},
    );
  }

  /**
   * Ends a link. Either party may end it. Data is kept; the trainer loses
   * access immediately.
   */
  async endLink(actorId: string, trainerId: string, clientId: string): Promise<void> {
    if (actorId !== trainerId && actorId !== clientId) {
      throw new ForbiddenException('Only the trainer or the client can end this link');
    }
    const link = await this.findLink(trainerId, clientId);
    if (!link || link.status === 'ended') {
      throw new NotFoundException('No active link to end');
    }

    await this.updateLink(trainerId, clientId, {
      status: 'ended',
      ended_at: new Date().toISOString(),
    });
    await this.audit(trainerId, clientId, 'link.ended', 'trainer_clients', link.id, {
      endedBy: actorId === trainerId ? 'trainer' : 'client',
    });
  }

  /** Audit entries about the caller, whether they were the trainer or the client. */
  async listActions(userId: string): Promise<TrainerActionSummary[]> {
    const { data, error } = await this.supabaseService
      .getClient()
      .from('trainer_actions')
      .select('id, trainer_id, client_id, action, target_table, target_id, details, created_at')
      .or(`trainer_id.eq.${userId},client_id.eq.${userId}`)
      .order('created_at', { ascending: false })
      .limit(ACTION_LIST_LIMIT);
    if (error) throw new InternalServerErrorException('Failed to load activity');

    return ((data ?? []) as Record<string, unknown>[]).map((row) => ({
      id: row.id as string,
      trainerId: row.trainer_id as string,
      clientId: (row.client_id as string | null) ?? null,
      action: row.action as string,
      targetTable: (row.target_table as string | null) ?? null,
      targetId: (row.target_id as string | null) ?? null,
      details: (row.details as Record<string, unknown>) ?? {},
      createdAt: row.created_at as string,
    }));
  }

  // ---- internals -----------------------------------------------------------

  private async hasTrainerEntitlement(userId: string): Promise<boolean> {
    const { data, error } = await this.supabaseService
      .getClient()
      .from('subscriptions')
      .select('id')
      .eq('user_id', userId)
      .eq('entitlement_id', TRAINER_ENTITLEMENT)
      .eq('status', 'active')
      .gt('current_period_ends_at', new Date().toISOString())
      .maybeSingle();
    if (error) throw new InternalServerErrorException('Failed to check trainer subscription');
    return data !== null;
  }

  private async assertTrainer(trainerId: string): Promise<void> {
    if (!(await this.hasTrainerEntitlement(trainerId))) {
      throw new ForbiddenException('A Trainer subscription is required');
    }
  }

  private async findLink(trainerId: string, clientId: string): Promise<LinkRow | null> {
    const { data, error } = await this.supabaseService
      .getClient()
      .from('trainer_clients')
      .select('id, status, source')
      .eq('trainer_id', trainerId)
      .eq('client_id', clientId)
      .maybeSingle();
    if (error) throw new InternalServerErrorException('Failed to look up trainer link');
    return (data as LinkRow | null) ?? null;
  }

  private async assertActiveLink(trainerId: string, clientId: string): Promise<LinkRow> {
    const link = await this.findLink(trainerId, clientId);
    if (!link || link.status !== 'active') {
      throw new ForbiddenException('Not an active client of this trainer');
    }
    return link;
  }

  /** Returns the status the link is now in: pending for a request, or active if it already was. */
  private async requestLink(trainerId: string, clientId: string): Promise<'pending' | 'active'> {
    const link = await this.findLink(trainerId, clientId);
    if (link) {
      if (link.status === 'active' || link.status === 'pending') return link.status;
      // A re-request is for an account the client owns, so the link is linked
      // even if it was managed before. The trainer must not keep edit rights.
      await this.updateLink(trainerId, clientId, {
        status: 'pending',
        ended_at: null,
        source: 'linked',
      });
      await this.audit(trainerId, clientId, 'link.requested', 'trainer_clients', link.id, {});
      return 'pending';
    }

    const { data, error } = await this.supabaseService
      .getClient()
      .from('trainer_clients')
      .insert({ trainer_id: trainerId, client_id: clientId, status: 'pending', source: 'linked' })
      .select('id')
      .single();
    if (error || !data) throw new InternalServerErrorException('Failed to send request');

    await this.audit(
      trainerId,
      clientId,
      'link.requested',
      'trainer_clients',
      (data as { id: string }).id,
      {},
    );
    return 'pending';
  }

  private async updateLink(
    trainerId: string,
    clientId: string,
    update: { status: TrainerLinkStatus; ended_at: string | null; source?: TrainerLinkSource },
  ): Promise<void> {
    const { error } = await this.supabaseService
      .getClient()
      .from('trainer_clients')
      .update(update)
      .eq('trainer_id', trainerId)
      .eq('client_id', clientId);
    if (error) throw new InternalServerErrorException('Failed to update trainer link');
  }

  private async findUserIdByEmail(email: string): Promise<string | null> {
    const { data, error } = await this.supabaseService
      .getClient()
      .rpc('find_auth_user_id_by_email', { p_email: email });
    if (error) throw new InternalServerErrorException('Failed to look up that email');
    return (data as string | null) ?? null;
  }

  private async loadProfiles(userIds: string[]): Promise<Map<string, ProfileRow>> {
    const { data, error } = await this.supabaseService
      .getClient()
      .from('users')
      .select('id, display_name, birthday, height_value, height_unit, weight_value, weight_unit')
      .in('id', userIds);
    if (error) throw new InternalServerErrorException('Failed to load profiles');

    const map = new Map<string, ProfileRow>();
    for (const row of (data ?? []) as ProfileRow[]) map.set(row.id, row);
    return map;
  }

  private async updateProfile(
    userId: string,
    fields: ProfileFields & Record<string, unknown>,
  ): Promise<void> {
    const payload: Record<string, unknown> = {};
    for (const [key, value] of Object.entries(fields)) {
      if (value !== undefined) payload[key] = value;
    }
    if (Object.keys(payload).length === 0) return;

    const { error } = await this.supabaseService
      .getClient()
      .from('users')
      .update(payload)
      .eq('id', userId);
    if (error) throw new InternalServerErrorException('Failed to save client profile');
  }

  private async audit(
    trainerId: string,
    clientId: string | null,
    action: string,
    targetTable: string | null,
    targetId: string | null,
    details: Record<string, unknown>,
  ): Promise<void> {
    const { error } = await this.supabaseService.getClient().from('trainer_actions').insert({
      trainer_id: trainerId,
      client_id: clientId,
      action,
      target_table: targetTable,
      target_id: targetId,
      details,
    });
    if (error) throw new InternalServerErrorException('Failed to record trainer activity');
  }

  private mapLogError(message: string): Error {
    if (/not an active client|entitlement is not active|not in this trainer/.test(message)) {
      return new ForbiddenException(message);
    }
    if (/is not available/.test(message)) {
      return new BadRequestException(message);
    }
    return new InternalServerErrorException('Failed to log workout');
  }
}

interface ProfileRow extends ProfileFields {
  id: string;
}
