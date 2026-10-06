import {
  BadRequestException,
  ForbiddenException,
  HttpException,
  HttpStatus,
  Injectable,
  InternalServerErrorException,
  NotFoundException,
} from '@nestjs/common';
import { createHash, randomInt, randomUUID } from 'node:crypto';
import { SupabaseService } from '../supabase/supabase.service';
import type { AddClientDto } from './dto/add-client.dto';
import type { TrackClientDto } from './dto/track-client.dto';
import type { ResolveExerciseDto, StartLiveWorkoutDto } from './dto/live-session.dto';
import type { LogWorkoutDto } from './dto/log-workout.dto';
import type { UpdateClientProfileDto } from './dto/update-client-profile.dto';

export type TrainerLinkStatus = 'pending' | 'active' | 'ended';
export type TrainerLinkSource = 'managed' | 'linked';

export interface TrainerClientSummary {
  /** null for an invite whose person has not signed in yet. */
  clientId: string | null;
  inviteId: string | null;
  /** Only set for an invite: the address the trainer typed. */
  email: string | null;
  status: 'invited' | 'pending' | 'active';
  /** A tracked client with no account yet: their history is waiting for a claim code. */
  awaitingClaim: boolean;
  source: TrainerLinkSource;
  displayName: string | null;
  birthday: string | null;
  heightValue: number | null;
  heightUnit: 'cm' | 'ft_in';
  weightValue: number | null;
  weightUnit: 'kg' | 'lb';
}

/** What adding a client produced. The invite answer is identical whether or not the email has an account. */
export type AddClientResult =
  | { kind: 'request'; status: 'pending' | 'active'; clientId: string }
  | { kind: 'invite'; status: 'invited' };

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

interface InviteRow {
  id: string;
  email: string;
  display_name: string | null;
  birthday: string | null;
  height_value: number | null;
  height_unit: 'cm' | 'ft_in';
  weight_value: number | null;
  weight_unit: 'kg' | 'lb';
}

interface ProfileFields {
  display_name?: string;
  birthday?: string;
  height_value?: number;
  height_unit?: 'cm' | 'ft_in';
  weight_value?: number;
  weight_unit?: 'kg' | 'lb';
}

const CLAIM_CODE_DAYS = 30;
const DAY_MS = 24 * 60 * 60 * 1000;
const CLAIM_WINDOW_MS = 60 * 60 * 1000;
const CLAIM_ATTEMPTS_PER_WINDOW = 10;
// No 0/O or 1/I/L, so a code read aloud or typed from a screen is unambiguous.
const CLAIM_ALPHABET = 'ABCDEFGHJKMNPQRSTVWXYZ23456789';

function generateClaimCode(): string {
  let code = '';
  for (let i = 0; i < 8; i += 1) code += CLAIM_ALPHABET[randomInt(CLAIM_ALPHABET.length)];
  return code;
}

function normaliseClaimCode(raw: string): string {
  return raw.toUpperCase().replace(/[^A-Z0-9]/g, '');
}

function formatClaimCode(code: string): string {
  return `${code.slice(0, 4)}-${code.slice(4)}`;
}

function hashClaimCode(raw: string): string {
  return createHash('sha256').update(normaliseClaimCode(raw)).digest('hex');
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
  /** Recent claim attempts per user, for the limit in claimHistory. */
  private readonly claimAttempts = new Map<string, number[]>();

  constructor(private readonly supabaseService: SupabaseService) {}

  async getStatus(userId: string): Promise<{ isTrainer: boolean }> {
    return { isTrainer: await this.hasTrainerEntitlement(userId) };
  }

  async listClients(trainerId: string): Promise<TrainerClientSummary[]> {
    await this.assertTrainer(trainerId);
    const client = this.supabaseService.getClient();

    const [linksResult, invitesResult, trackedResult] = await Promise.all([
      client
        .from('trainer_clients')
        .select('client_id, status, source')
        .eq('trainer_id', trainerId)
        .in('status', ['pending', 'active']),
      client
        .from('trainer_invites')
        .select(
          'id, email, display_name, birthday, height_value, height_unit, weight_value, weight_unit',
        )
        .eq('trainer_id', trainerId)
        .eq('status', 'pending'),
      client
        .from('trainer_placeholder_clients')
        .select('placeholder_user_id')
        .eq('trainer_id', trainerId)
        .is('claimed_at', null),
    ]);
    if (linksResult.error || invitesResult.error || trackedResult.error) {
      throw new InternalServerErrorException('Failed to load clients');
    }

    const linkRows = (linksResult.data ?? []) as {
      client_id: string;
      status: 'pending' | 'active';
      source: TrainerLinkSource;
    }[];
    const awaiting = new Set(
      ((trackedResult.data ?? []) as { placeholder_user_id: string }[]).map(
        (row) => row.placeholder_user_id,
      ),
    );
    const profiles = linkRows.length
      ? await this.loadProfiles(linkRows.map((row) => row.client_id))
      : new Map<string, ProfileRow>();

    const linked: TrainerClientSummary[] = linkRows.map((row) => {
      const profile = profiles.get(row.client_id);
      return {
        clientId: row.client_id,
        inviteId: null,
        email: null,
        status: row.status,
        awaitingClaim: awaiting.has(row.client_id),
        source: row.source,
        displayName: profile?.display_name ?? null,
        birthday: profile?.birthday ?? null,
        heightValue: profile?.height_value ?? null,
        heightUnit: profile?.height_unit ?? 'cm',
        weightValue: profile?.weight_value ?? null,
        weightUnit: profile?.weight_unit ?? 'kg',
      };
    });

    const invited: TrainerClientSummary[] = ((invitesResult.data ?? []) as InviteRow[]).map(
      (row) => ({
        clientId: null,
        inviteId: row.id,
        email: row.email,
        status: 'invited',
        awaitingClaim: false,
        source: 'managed',
        displayName: row.display_name,
        birthday: row.birthday,
        heightValue: row.height_value,
        heightUnit: row.height_unit,
        weightValue: row.weight_value,
        weightUnit: row.weight_unit,
      }),
    );

    return [...linked, ...invited];
  }

  /**
   * Adds a client by username, or invites one by email. A username finds an
   * existing account and sends it a request, so the result is honest about
   * that. An email is always an invite, and the answer is the same whether or
   * not the email has an account, so it never reveals who is on Progresso.
   */
  async addClient(trainerId: string, dto: AddClientDto): Promise<AddClientResult> {
    await this.assertTrainer(trainerId);
    if (dto.username && dto.email) {
      throw new BadRequestException('Use either a username or an email, not both');
    }
    if (dto.username) {
      return this.addByUsername(trainerId, dto.username.trim().toLowerCase());
    }
    if (dto.email) {
      return this.inviteByEmail(trainerId, dto.email.trim().toLowerCase(), dto);
    }
    throw new BadRequestException('Enter a username or an email address');
  }

  private async addByUsername(trainerId: string, username: string): Promise<AddClientResult> {
    const clientId = await this.findUserIdByUsername(username);
    if (!clientId) {
      throw new NotFoundException('No Progresso user has that username');
    }
    if (clientId === trainerId) {
      throw new BadRequestException('You cannot add yourself as a client');
    }
    const status = await this.requestLink(trainerId, clientId);
    return { kind: 'request', status, clientId };
  }

  private async inviteByEmail(
    trainerId: string,
    email: string,
    dto: AddClientDto,
  ): Promise<AddClientResult> {
    const client = this.supabaseService.getClient();
    const details = {
      display_name: dto.displayName ?? null,
      birthday: dto.birthday ?? null,
      height_value: dto.heightValue ?? null,
      height_unit: dto.heightUnit ?? 'cm',
      weight_value: dto.weightValue ?? null,
      weight_unit: dto.weightUnit ?? 'kg',
    };

    // One pending invite per trainer and email: a second invite updates the first.
    const { data: existing, error: findError } = await client
      .from('trainer_invites')
      .select('id')
      .eq('trainer_id', trainerId)
      .eq('email', email)
      .eq('status', 'pending')
      .maybeSingle();
    if (findError) throw new InternalServerErrorException('Failed to save invite');

    if (existing) {
      const { error } = await client
        .from('trainer_invites')
        .update(details)
        .eq('id', (existing as { id: string }).id);
      if (error) throw new InternalServerErrorException('Failed to save invite');
    } else {
      // Email not yet sent, so the account state is unknown here. It is set just below.
      const { data: created, error } = await client
        .from('trainer_invites')
        .insert({ trainer_id: trainerId, email, ...details })
        .select('id')
        .single();
      if (error || !created) throw new InternalServerErrorException('Failed to save invite');
      await this.audit(
        trainerId,
        null,
        'invite.created',
        'trainer_invites',
        (created as { id: string }).id,
        {},
      );
    }

    // A new email gets an invitation, which also creates its account. An email that
    // already has an account is refused by the auth provider, and that refusal is
    // ignored on purpose: the answer to the trainer must not differ between the two.
    const { error: inviteError } = await client.auth.admin.inviteUserByEmail(email, {
      data: { display_name: dto.displayName ?? null, managed_by_trainer: true },
    });
    const createdAccount = !inviteError;
    if (inviteError && !/already|registered|exists/i.test(inviteError.message)) {
      throw new BadRequestException('Could not send an invite to that email address');
    }

    const { error: flagError } = await client
      .from('trainer_invites')
      .update({ created_account: createdAccount })
      .eq('trainer_id', trainerId)
      .eq('email', email)
      .eq('status', 'pending');
    if (flagError) throw new InternalServerErrorException('Failed to save invite');

    return { kind: 'invite', status: 'invited' };
  }

  /**
   * Attaches the signed-in person's pending invites, if any. Runs for every user
   * at sign-in, so an invite reaches an existing account the same way as a new
   * one. Only a confirmed email counts, so an invite cannot be claimed by someone
   * who merely typed the address.
   */
  async claimInvites(userId: string): Promise<{ claimed: number }> {
    const client = this.supabaseService.getClient();
    const { data: authData, error: authError } = await client.auth.admin.getUserById(userId);
    const user = authData?.user;
    if (authError || !user?.email || !user.email_confirmed_at) {
      return { claimed: 0 };
    }
    const email = user.email.toLowerCase();

    const { data: invites, error } = await client
      .from('trainer_invites')
      .select(
        'id, trainer_id, display_name, birthday, height_value, height_unit, weight_value, weight_unit, created_account',
      )
      .eq('email', email)
      .eq('status', 'pending');
    if (error) throw new InternalServerErrorException('Failed to check invites');

    let claimed = 0;
    for (const invite of (invites ?? []) as (InviteRow & {
      trainer_id: string;
      created_account: boolean;
    })[]) {
      await this.fillMissingProfile(userId, invite);

      const link = await this.findLink(invite.trainer_id, userId);
      if (!link) {
        const { data: created, error: linkError } = await client
          .from('trainer_clients')
          .insert({
            trainer_id: invite.trainer_id,
            client_id: userId,
            status: 'pending',
            source: invite.created_account ? 'managed' : 'linked',
          })
          .select('id')
          .single();
        if (linkError || !created)
          throw new InternalServerErrorException('Failed to attach invite');
        await this.audit(
          invite.trainer_id,
          userId,
          'link.requested',
          'trainer_clients',
          (created as { id: string }).id,
          { via: 'invite' },
        );
      }

      const { error: claimError } = await client
        .from('trainer_invites')
        .update({ status: 'claimed', claimed_by: userId, claimed_at: new Date().toISOString() })
        .eq('id', invite.id);
      if (claimError) throw new InternalServerErrorException('Failed to attach invite');
      claimed += 1;
    }
    return { claimed };
  }

  /** Fills only the profile fields the person has not set. An invite never overwrites their own details. */
  private async fillMissingProfile(userId: string, invite: InviteRow): Promise<void> {
    const { data } = await this.supabaseService
      .getClient()
      .from('users')
      .select('display_name, birthday, height_value, weight_value')
      .eq('id', userId)
      .maybeSingle();
    const profile = (data ?? {}) as Partial<ProfileRow>;

    const fill: ProfileFields = {};
    if (!profile.display_name && invite.display_name) fill.display_name = invite.display_name;
    if (!profile.birthday && invite.birthday) fill.birthday = invite.birthday;
    if (profile.height_value == null && invite.height_value != null) {
      fill.height_value = invite.height_value;
      fill.height_unit = invite.height_unit;
    }
    if (profile.weight_value == null && invite.weight_value != null) {
      fill.weight_value = invite.weight_value;
      fill.weight_unit = invite.weight_unit;
    }
    if (Object.keys(fill).length > 0) await this.updateProfile(userId, fill);
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

  /** The client's active trainers, with each trainer's display name. */
  async listMyTrainers(clientId: string): Promise<TrainerRequestSummary[]> {
    const client = this.supabaseService.getClient();
    const { data: links, error } = await client
      .from('trainer_clients')
      .select('trainer_id, updated_at')
      .eq('client_id', clientId)
      .eq('status', 'active');
    if (error) throw new InternalServerErrorException('Failed to load trainers');

    const rows = (links ?? []) as { trainer_id: string; updated_at: string }[];
    if (rows.length === 0) return [];

    const profiles = await this.loadProfiles(rows.map((row) => row.trainer_id));
    return rows.map((row) => ({
      trainerId: row.trainer_id,
      trainerDisplayName: profiles.get(row.trainer_id)?.display_name ?? null,
      requestedAt: row.updated_at,
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

  /**
   * Tracks a client who has no Progresso account. The account is a placeholder
   * that nobody can sign in to, so every workout the trainer logs has an owner
   * from the start. The trainer gets a claim code to give the client.
   */
  async trackClient(
    trainerId: string,
    dto: TrackClientDto,
  ): Promise<{ clientId: string; claimCode: string; expiresAt: string }> {
    await this.assertTrainer(trainerId);
    const client = this.supabaseService.getClient();

    const { data: created, error: createError } = await client.auth.admin.createUser({
      email: `placeholder-${randomUUID()}@placeholders.invalid`,
      email_confirm: true,
      user_metadata: { placeholder: true },
    });
    if (createError || !created?.user) {
      throw new InternalServerErrorException('Failed to create the client');
    }
    const clientId = created.user.id;

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

    const code = await this.issueClaimCode(trainerId, clientId, true);
    await this.audit(
      trainerId,
      clientId,
      'client.tracked',
      'trainer_placeholder_clients',
      null,
      {},
    );
    return { clientId, ...code };
  }

  /** A new claim code for a tracked client. The old code stops working at once. */
  async regenerateClaimCode(
    trainerId: string,
    clientId: string,
  ): Promise<{ claimCode: string; expiresAt: string }> {
    await this.assertTrainer(trainerId);
    await this.assertActiveLink(trainerId, clientId);
    const { data, error } = await this.supabaseService
      .getClient()
      .from('trainer_placeholder_clients')
      .select('id')
      .eq('trainer_id', trainerId)
      .eq('placeholder_user_id', clientId)
      .is('claimed_at', null)
      .maybeSingle();
    if (error) throw new InternalServerErrorException('Failed to look up the client');
    if (!data) {
      throw new NotFoundException('This client has no history waiting to be claimed');
    }

    const code = await this.issueClaimCode(trainerId, clientId, false);
    await this.audit(
      trainerId,
      clientId,
      'claim_code.regenerated',
      'trainer_placeholder_clients',
      null,
      {},
    );
    return code;
  }

  /**
   * The client enters the code their trainer gave them. Their tracked history moves
   * onto their own account. Their trainer link then waits for them to accept it.
   */
  async claimHistory(userId: string, rawCode: string): Promise<{ workouts: number }> {
    this.enforceClaimLimit(userId);
    const client = this.supabaseService.getClient();

    const { data: row, error } = await client
      .from('trainer_placeholder_clients')
      .select('trainer_id, placeholder_user_id, code_expires_at')
      .eq('code_hash', hashClaimCode(rawCode))
      .is('claimed_at', null)
      .maybeSingle();
    if (error) throw new InternalServerErrorException('Failed to check the code');
    const placeholder = row as {
      trainer_id: string;
      placeholder_user_id: string;
      code_expires_at: string;
    } | null;
    if (!placeholder) {
      throw new BadRequestException(
        'That code is not valid. Check it, or ask your trainer for a new one.',
      );
    }
    if (Date.parse(placeholder.code_expires_at) <= Date.now()) {
      throw new BadRequestException('That code has expired. Ask your trainer for a new one.');
    }
    if (placeholder.trainer_id === userId) {
      throw new BadRequestException('A trainer cannot claim a client they track');
    }

    const { data: moved, error: rpcError } = await client.rpc('claim_placeholder_history', {
      p_placeholder: placeholder.placeholder_user_id,
      p_client: userId,
    });
    if (rpcError) throw this.mapClaimError(rpcError.message);

    // The history now belongs to the client. The placeholder has nothing left and
    // cannot sign in, so a failure to delete it is harmless and not reported.
    await client.auth.admin.deleteUser(placeholder.placeholder_user_id);

    const workouts = Number(moved ?? 0);
    await this.audit(
      placeholder.trainer_id,
      userId,
      'history.claimed',
      'trainer_placeholder_clients',
      null,
      {
        workouts,
      },
    );
    return { workouts };
  }

  private async issueClaimCode(
    trainerId: string,
    placeholderId: string,
    isNew: boolean,
  ): Promise<{ claimCode: string; expiresAt: string }> {
    const raw = generateClaimCode();
    const expiresAt = new Date(Date.now() + CLAIM_CODE_DAYS * DAY_MS).toISOString();
    const client = this.supabaseService.getClient();
    const fields = { code_hash: hashClaimCode(raw), code_expires_at: expiresAt };

    if (isNew) {
      const { error } = await client
        .from('trainer_placeholder_clients')
        .insert({ trainer_id: trainerId, placeholder_user_id: placeholderId, ...fields });
      if (error) throw new InternalServerErrorException('Failed to create a claim code');
    } else {
      const { error } = await client
        .from('trainer_placeholder_clients')
        .update(fields)
        .eq('trainer_id', trainerId)
        .eq('placeholder_user_id', placeholderId)
        .is('claimed_at', null);
      if (error) throw new InternalServerErrorException('Failed to create a claim code');
    }
    return { claimCode: formatClaimCode(normaliseClaimCode(raw)), expiresAt };
  }

  /** At most CLAIM_ATTEMPTS_PER_WINDOW tries per user per hour, so a code cannot be guessed by trying many. */
  private enforceClaimLimit(userId: string): void {
    const now = Date.now();
    const recent = (this.claimAttempts.get(userId) ?? []).filter(
      (at) => now - at < CLAIM_WINDOW_MS,
    );
    if (recent.length >= CLAIM_ATTEMPTS_PER_WINDOW) {
      throw new HttpException('Too many attempts. Try again later.', HttpStatus.TOO_MANY_REQUESTS);
    }
    recent.push(now);
    this.claimAttempts.set(userId, recent);
  }

  private mapClaimError(message: string): Error {
    if (/finish or cancel/.test(message)) {
      return new BadRequestException(message);
    }
    if (/no unclaimed placeholder/.test(message)) {
      return new BadRequestException(
        'That code is no longer valid. Ask your trainer for a new one.',
      );
    }
    return new InternalServerErrorException('Failed to claim the history');
  }

  /**
   * A live session for a client: the trainer adds to it as the session happens, and
   * it stays open until the trainer finishes it. Only one is open per client at a time.
   */
  async startLiveWorkout(
    trainerId: string,
    clientId: string,
    dto: StartLiveWorkoutDto,
  ): Promise<{ workoutId: string }> {
    await this.assertTrainer(trainerId);
    await this.assertActiveLink(trainerId, clientId);
    const { data, error } = await this.supabaseService
      .getClient()
      .from('workouts')
      .insert({
        user_id: clientId,
        name: dto.name,
        performed_at: new Date().toISOString(),
        logged_by: trainerId,
      })
      .select('id')
      .single();
    if (error) {
      if (/duplicate key|unique/i.test(error.message)) {
        throw new BadRequestException('A live session for this client is already open');
      }
      throw new InternalServerErrorException('Failed to start the live session');
    }
    const workoutId = (data as { id: string }).id;
    await this.audit(trainerId, clientId, 'live.started', 'workouts', workoutId, {});
    return { workoutId };
  }

  /** Finishes a live session the trainer started. The client's data is kept as it is. */
  async finishLiveWorkout(trainerId: string, clientId: string, workoutId: string): Promise<void> {
    await this.assertTrainer(trainerId);
    await this.assertActiveLink(trainerId, clientId);
    const { data, error } = await this.supabaseService
      .getClient()
      .from('workouts')
      .update({ completed_at: new Date().toISOString() })
      .eq('id', workoutId)
      .eq('user_id', clientId)
      .eq('logged_by', trainerId)
      .is('completed_at', null)
      .select('id');
    if (error) throw new InternalServerErrorException('Failed to finish the live session');
    if (!data || data.length === 0) throw new NotFoundException('No open live session to finish');
    await this.audit(trainerId, clientId, 'live.finished', 'workouts', workoutId, {});
  }

  /**
   * The exercise to use in a client's live session: the client's own copy of the
   * trainer's exercise (made if needed), or the exercise itself when it is already the
   * client's or a built-in.
   */
  async resolveClientExercise(
    trainerId: string,
    clientId: string,
    dto: ResolveExerciseDto,
  ): Promise<{ exerciseId: string }> {
    await this.assertTrainer(trainerId);
    const { data, error } = await this.supabaseService.getClient().rpc('resolve_client_exercise', {
      p_trainer: trainerId,
      p_client: clientId,
      p_exercise: dto.exerciseId,
    });
    if (error) throw this.mapLogError(error.message);
    return { exerciseId: data as string };
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

  private async findUserIdByUsername(username: string): Promise<string | null> {
    const { data, error } = await this.supabaseService
      .getClient()
      .from('users')
      .select('id')
      .eq('username', username)
      .maybeSingle();
    if (error) throw new InternalServerErrorException('Failed to look up that username');
    return (data as { id: string } | null)?.id ?? null;
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

  private async updateProfile(userId: string, fields: ProfileFields): Promise<void> {
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
