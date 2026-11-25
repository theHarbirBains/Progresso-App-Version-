import {
  BadRequestException,
  ConflictException,
  ForbiddenException,
  GoneException,
  Injectable,
  InternalServerErrorException,
  Logger,
  NotFoundException,
  Optional,
} from '@nestjs/common';
import { randomUUID } from 'node:crypto';
import { SocialPushService } from '../notifications/social-push.service';
import { isBlockedEitherWay, loadBlocks } from '../safety/blocks';
import { SupabaseService } from '../supabase/supabase.service';
import type { AddGuestDto, CreateGroupDto } from './dto/groups.dto';

export interface GroupSummary {
  id: string;
  name: string;
  hostId: string;
  startedAt: string;
  myRole: 'host' | 'member';
}

export interface GroupMemberView {
  userId: string;
  displayName: string | null;
  role: 'host' | 'member';
  status: 'invited' | 'joined';
  isGuest: boolean;
  /** This member's workout in the group. Every joined member can read and edit it. */
  workoutId: string | null;
  /** The day of the member’s split their group workout is, or null for none. */
  workoutSplitDayId: string | null;
  workoutName: string | null;
}

/**
 * One invite to a group, as everyone in it sees it: who it's for, who sent it and what became of
 * it -- waiting, accepted, declined, cancelled, or expired with the group finished.
 */
export interface GroupInvitation {
  userId: string;
  displayName: string | null;
  status: 'pending' | 'accepted' | 'declined' | 'cancelled' | 'expired';
  invitedById: string | null;
  invitedByDisplayName: string | null;
  invitedAt: string;
  respondedAt: string | null;
  /** The viewer may take it back: it's waiting, and they sent it or they're the host. */
  canCancel: boolean;
}

export interface GroupDetail {
  id: string;
  name: string;
  status: 'live' | 'finished';
  hostId: string;
  startedAt: string;
  finishedAt: string | null;
  members: GroupMemberView[];
  /** Every invite sent to it, newest first. */
  invitations: GroupInvitation[];
}

export interface GroupInvite {
  groupId: string;
  name: string;
  hostDisplayName: string | null;
  /** Who sent it (anyone in the group can): "Sam wants to start a live workout with you." */
  invitedById: string | null;
  invitedByDisplayName: string | null;
  invitedAt: string;
}

/** What became of an invite asked for (POST /groups/:id/invites), one a person. */
export interface InviteResult {
  userId: string;
  /** invited: sent now, or waiting already (never twice); joined: in the group already. */
  status: 'invited' | 'joined' | 'skipped';
}

type MemberStatus = 'invited' | 'joined' | 'left' | 'declined' | 'cancelled';

interface MemberRow {
  id: string;
  user_id: string;
  role: 'host' | 'member';
  status: MemberStatus;
  is_guest: boolean;
  added_by?: string | null;
  invited_at?: string | null;
  responded_at?: string | null;
}

const MEMBER_COLUMNS = 'id, user_id, role, status, is_guest, added_by, invited_at, responded_at';

interface ExerciseSetsRow {
  id: string;
  sets: { completed_at: string | null; deleted_at: string | null }[] | null;
}

/**
 * Group workouts: a host and members, each with their own workout in the group.
 * Joined members can read and edit every group workout's exercises and sets (the
 * database policies enforce that). Members are friends, clients, or guests (a
 * guest is a placeholder account with no login). Everything here runs through the
 * service-role client after an explicit membership check.
 */
@Injectable()
export class GroupsService {
  private readonly logger = new Logger(GroupsService.name);

  constructor(
    private readonly supabaseService: SupabaseService,
    // Pushes an invite to its invitee, and the answer to its sender (when they want it).
    @Optional() private readonly socialPush?: SocialPushService,
  ) {}

  /**
   * Starts a group and adds the people working out today. This is the only place people
   * are added: once the group has started there is no route to add anyone. A person who
   * cannot be added (not a friend or client, or an unknown guest) is returned in `skipped`
   * and the group still starts.
   */
  async create(
    userId: string,
    dto: CreateGroupDto,
  ): Promise<{ groupId: string; skipped: string[] }> {
    const client = this.supabaseService.getClient();

    // Your own workout in the group: a day of your split, a named workout outside it,
    // or the group's own name.
    let workoutName = dto.name;
    let splitDayId: string | undefined;
    if (dto.splitDayId) {
      splitDayId = dto.splitDayId;
      workoutName = await this.ownedSplitDayName(userId, dto.splitDayId);
    } else if (dto.workoutName) {
      workoutName = dto.workoutName;
    }

    if (dto.workoutId) {
      // Starting from a workout: it must be the caller's own open, solo workout.
      const { data: workout, error } = await client
        .from('workouts')
        .select('id')
        .eq('id', dto.workoutId)
        .eq('user_id', userId)
        .is('completed_at', null)
        .is('deleted_at', null)
        .is('group_id', null)
        .is('logged_by', null)
        .maybeSingle();
      if (error) throw new InternalServerErrorException('Failed to look up the workout');
      if (!workout) throw new NotFoundException('No open workout of yours to start a group from');
    }

    const { data: group, error: groupError } = await client
      .from('workout_groups')
      .insert({ host_id: userId, name: dto.name })
      .select('id')
      .single();
    if (groupError || !group) throw new InternalServerErrorException('Failed to start the group');
    const groupId = (group as { id: string }).id;

    const { error: memberError } = await client.from('workout_group_members').insert({
      group_id: groupId,
      user_id: userId,
      role: 'host',
      status: 'joined',
      is_guest: false,
      added_by: userId,
    });
    if (memberError) throw new InternalServerErrorException('Failed to join the group');

    if (dto.workoutId) {
      const { error } = await client
        .from('workouts')
        .update({ group_id: groupId })
        .eq('id', dto.workoutId);
      if (error) throw new InternalServerErrorException('Failed to add the workout to the group');
    } else {
      await this.createMemberWorkout(userId, groupId, workoutName, splitDayId);
    }

    const skipped: string[] = [];
    for (const username of dto.friendUsernames ?? []) {
      await this.inviteMember(userId, groupId, username).catch(() => skipped.push(username));
    }
    for (const clientId of dto.clientIds ?? []) {
      await this.addClient(userId, groupId, clientId).catch(() => skipped.push(clientId));
    }
    for (const displayName of dto.guestNames ?? []) {
      await this.addGuest(userId, groupId, { displayName }).catch(() => skipped.push(displayName));
    }

    return { groupId, skipped };
  }

  /** Live groups the caller is in. */
  async listMine(userId: string): Promise<GroupSummary[]> {
    const client = this.supabaseService.getClient();
    const { data: rows, error } = await client
      .from('workout_group_members')
      .select('group_id, role')
      .eq('user_id', userId)
      .eq('status', 'joined');
    if (error) throw new InternalServerErrorException('Failed to load groups');

    const memberships = (rows ?? []) as { group_id: string; role: 'host' | 'member' }[];
    if (memberships.length === 0) return [];

    const { data: groups, error: groupsError } = await client
      .from('workout_groups')
      .select('id, name, host_id, started_at')
      .in(
        'id',
        memberships.map((row) => row.group_id),
      )
      .eq('status', 'live');
    if (groupsError) throw new InternalServerErrorException('Failed to load groups');

    const roleByGroup = new Map(memberships.map((row) => [row.group_id, row.role]));
    return (
      (groups ?? []) as { id: string; name: string; host_id: string; started_at: string }[]
    ).map((g) => ({
      id: g.id,
      name: g.name,
      hostId: g.host_id,
      startedAt: g.started_at,
      myRole: roleByGroup.get(g.id) ?? 'member',
    }));
  }

  /** Invitations waiting for the caller to accept. */
  async listInvites(userId: string): Promise<GroupInvite[]> {
    const client = this.supabaseService.getClient();
    const { data: rows, error } = await client
      .from('workout_group_members')
      .select('group_id, created_at, invited_at, added_by')
      .eq('user_id', userId)
      .eq('status', 'invited');
    if (error) throw new InternalServerErrorException('Failed to load invites');

    const invites = (
      (rows ?? []) as {
        group_id: string;
        created_at: string;
        invited_at: string | null;
        added_by: string | null;
      }[]
    ).sort((a, b) => (b.invited_at ?? b.created_at).localeCompare(a.invited_at ?? a.created_at));
    if (invites.length === 0) return [];

    const { data: groups, error: groupsError } = await client
      .from('workout_groups')
      .select('id, name, host_id')
      .in(
        'id',
        invites.map((row) => row.group_id),
      )
      .eq('status', 'live');
    if (groupsError) throw new InternalServerErrorException('Failed to load invites');

    const groupRows = (groups ?? []) as { id: string; name: string; host_id: string }[];
    const names = await this.loadDisplayNames([
      ...groupRows.map((g) => g.host_id),
      ...invites.flatMap((invite) => (invite.added_by ? [invite.added_by] : [])),
    ]);
    // Only a live group's: one that's finished has expired.
    return invites.flatMap((invite) => {
      const group = groupRows.find((g) => g.id === invite.group_id);
      if (!group) return [];
      return [
        {
          groupId: group.id,
          name: group.name,
          hostDisplayName: names.get(group.host_id) ?? null,
          invitedById: invite.added_by,
          invitedByDisplayName: invite.added_by ? (names.get(invite.added_by) ?? null) : null,
          invitedAt: invite.invited_at ?? invite.created_at,
        },
      ];
    });
  }

  /** The group, its members and each member's workout. Only joined members see it. */
  async getDetail(userId: string, groupId: string): Promise<GroupDetail> {
    await this.requireJoined(userId, groupId);
    const client = this.supabaseService.getClient();

    const { data: group, error: groupError } = await client
      .from('workout_groups')
      .select('id, name, status, host_id, started_at, finished_at')
      .eq('id', groupId)
      .maybeSingle();
    if (groupError) throw new InternalServerErrorException('Failed to load the group');
    if (!group) throw new NotFoundException('Group not found');
    const groupRow = group as {
      id: string;
      name: string;
      status: 'live' | 'finished';
      host_id: string;
      started_at: string;
      finished_at: string | null;
    };

    const { data: memberRows, error: membersError } = await client
      .from('workout_group_members')
      .select(MEMBER_COLUMNS)
      .eq('group_id', groupId);
    if (membersError) throw new InternalServerErrorException('Failed to load members');
    const rows = (memberRows ?? []) as MemberRow[];
    const members = rows.filter((m) => m.status === 'invited' || m.status === 'joined');
    // Every invite there's been: its invitee's row, whatever became of it.
    const invited = rows.filter((m) => m.invited_at);

    const { data: workouts, error: workoutsError } = await client
      .from('workouts')
      .select('id, user_id, name, workout_split_day_id')
      .eq('group_id', groupId)
      .is('deleted_at', null);
    if (workoutsError) throw new InternalServerErrorException('Failed to load workouts');
    const workoutByUser = new Map(
      (
        (workouts ?? []) as {
          id: string;
          user_id: string;
          name: string;
          workout_split_day_id: string | null;
        }[]
      ).map((w) => [w.user_id, { id: w.id, name: w.name, splitDayId: w.workout_split_day_id }]),
    );

    const names = await this.loadDisplayNames([
      ...rows.map((m) => m.user_id),
      ...invited.flatMap((m) => (m.added_by ? [m.added_by] : [])),
    ]);
    const live = groupRow.status === 'live';
    const invitations = invited
      .map((m): GroupInvitation => {
        const status =
          m.status === 'invited'
            ? live
              ? 'pending'
              : 'expired'
            : m.status === 'joined' || m.status === 'left'
              ? 'accepted'
              : m.status;
        return {
          userId: m.user_id,
          displayName: names.get(m.user_id) ?? null,
          status,
          invitedById: m.added_by ?? null,
          invitedByDisplayName: m.added_by ? (names.get(m.added_by) ?? null) : null,
          invitedAt: m.invited_at as string,
          respondedAt: m.responded_at ?? null,
          canCancel: status === 'pending' && (m.added_by === userId || groupRow.host_id === userId),
        };
      })
      .sort((a, b) => b.invitedAt.localeCompare(a.invitedAt));
    return {
      invitations,
      id: groupRow.id,
      name: groupRow.name,
      status: groupRow.status,
      hostId: groupRow.host_id,
      startedAt: groupRow.started_at,
      finishedAt: groupRow.finished_at,
      members: members.map((m) => ({
        userId: m.user_id,
        displayName: names.get(m.user_id) ?? null,
        role: m.role,
        status: m.status === 'joined' ? 'joined' : 'invited',
        isGuest: m.is_guest,
        workoutId: workoutByUser.get(m.user_id)?.id ?? null,
        workoutSplitDayId: workoutByUser.get(m.user_id)?.splitDayId ?? null,
        workoutName: workoutByUser.get(m.user_id)?.name ?? null,
      })),
    };
  }

  /** Invites a friend or a client by username (as a group starts). See inviteUser. */
  async inviteMember(
    userId: string,
    groupId: string,
    username: string,
  ): Promise<{ userId: string; status: 'invited' | 'joined' }> {
    const client = this.supabaseService.getClient();
    const { data: target, error } = await client
      .from('users')
      .select('id')
      .eq('username', username.toLowerCase())
      .maybeSingle();
    if (error) throw new InternalServerErrorException('Failed to look up that username');
    const targetId = (target as { id: string } | null)?.id;
    if (!targetId) throw new NotFoundException('No Progresso user has that username');
    return this.inviteUser(userId, groupId, targetId);
  }

  /**
   * Invites a friend or a client (an accepted follow, or an active trainer link, either way --
   * never across a block). Anyone in a live group can invite, as it starts or while it's going;
   * the invitee accepts or declines, with no code to type. Never twice: someone invited already,
   * or in the group, is as they are. Someone who declined, or whose invite was cancelled, can be
   * invited again -- a new invite. A new one is pushed to them (when they want it).
   */
  async inviteUser(
    userId: string,
    groupId: string,
    targetId: string,
  ): Promise<{ userId: string; status: 'invited' | 'joined' }> {
    await this.requireLive(groupId);
    await this.requireJoined(userId, groupId);
    const client = this.supabaseService.getClient();
    if (targetId === userId) throw new BadRequestException('You are already in this group');

    // Only someone with an account: a guest or a tracked client is added, never invited.
    const { data: target, error: targetError } = await client
      .from('users')
      .select('id')
      .eq('id', targetId)
      .not('onboarding_completed_at', 'is', null)
      .maybeSingle();
    if (targetError) throw new InternalServerErrorException('Failed to look up that person');
    if (!target) throw new NotFoundException('No Progresso user has that username');

    // A block in either direction reads exactly like not being connected.
    const blocks = await loadBlocks(client, userId);
    if (isBlockedEitherWay(blocks, targetId) || !(await this.areConnected(userId, targetId))) {
      throw new ForbiddenException('You can invite your friends and your clients');
    }

    const existing = await this.findMember(groupId, targetId);
    if (existing && existing.status === 'joined') return { userId: targetId, status: 'joined' };
    if (existing && existing.status === 'invited') return { userId: targetId, status: 'invited' };

    const row = {
      role: 'member' as const,
      status: 'invited' as const,
      is_guest: false,
      added_by: userId,
      invited_at: new Date().toISOString(),
      responded_at: null,
    };
    const { error: writeError } = existing
      ? await client.from('workout_group_members').update(row).eq('id', existing.id)
      : await client
          .from('workout_group_members')
          .insert({ group_id: groupId, user_id: targetId, ...row });
    if (writeError) throw new InternalServerErrorException('Failed to send the invite');
    void this.pushInvite(userId, targetId, groupId);
    return { userId: targetId, status: 'invited' };
  }

  /**
   * Invites several friends to a live group at once, from inside it (any joined member). Each is
   * invited on its own, so one who can't be (not a friend, blocked, no account) is `skipped` and
   * the rest still go.
   */
  async inviteMany(userId: string, groupId: string, targetIds: string[]): Promise<InviteResult[]> {
    await this.requireLive(groupId);
    await this.requireJoined(userId, groupId);
    const results: InviteResult[] = [];
    for (const targetId of targetIds) {
      try {
        results.push(await this.inviteUser(userId, groupId, targetId));
      } catch {
        results.push({ userId: targetId, status: 'skipped' });
      }
    }
    return results;
  }

  /**
   * Takes back an invite still waiting: its sender's, or anyone's for the host. It reads as
   * cancelled from then on -- the invitee can no longer accept it -- and can be sent again later.
   */
  async cancelInvite(userId: string, groupId: string, targetId: string): Promise<void> {
    await this.requireJoined(userId, groupId);
    const client = this.supabaseService.getClient();
    const member = await this.findMember(groupId, targetId);
    if (!member || member.status !== 'invited') throw new NotFoundException('Invite not found');
    const { data: group, error: groupError } = await client
      .from('workout_groups')
      .select('host_id')
      .eq('id', groupId)
      .maybeSingle();
    if (groupError) throw new InternalServerErrorException('Failed to load the group');
    const hostId = (group as { host_id: string } | null)?.host_id;
    if (member.added_by !== userId && hostId !== userId) {
      throw new ForbiddenException('Only whoever sent an invite, or the host, can cancel it');
    }
    const { error } = await client
      .from('workout_group_members')
      .update({ status: 'cancelled', responded_at: new Date().toISOString() })
      .eq('id', member.id)
      .eq('status', 'invited');
    if (error) throw new InternalServerErrorException('Failed to cancel the invite');
  }

  /** Adds someone with no account. They get a placeholder account and their own workout in the group. */
  async addGuest(userId: string, groupId: string, dto: AddGuestDto): Promise<{ userId: string }> {
    await this.requireLive(groupId);
    await this.requireJoined(userId, groupId);
    const client = this.supabaseService.getClient();

    const { data: created, error: createError } = await client.auth.admin.createUser({
      email: `guest-${randomUUID()}@placeholders.invalid`,
      email_confirm: true,
      user_metadata: { guest: true },
    });
    if (createError || !created?.user)
      throw new InternalServerErrorException('Failed to add the guest');
    const guestId = created.user.id;

    const { error: profileError } = await client
      .from('users')
      .update({ display_name: dto.displayName })
      .eq('id', guestId);
    if (profileError) throw new InternalServerErrorException('Failed to add the guest');

    const { error: memberError } = await client.from('workout_group_members').insert({
      group_id: groupId,
      user_id: guestId,
      role: 'member',
      status: 'joined',
      is_guest: true,
      added_by: userId,
    });
    if (memberError) throw new InternalServerErrorException('Failed to add the guest');

    const group = await this.loadGroupName(groupId);
    await this.createMemberWorkout(guestId, groupId, group);
    return { userId: guestId };
  }

  /** Accept or decline an invitation. Accepting gives the caller their own workout in the group. */
  async respondToInvite(
    userId: string,
    groupId: string,
    action: 'accept' | 'decline',
  ): Promise<void> {
    const member = await this.findMember(groupId, userId);
    if (!member || member.status !== 'invited') throw new NotFoundException('Invite not found');
    const client = this.supabaseService.getClient();
    // A group that's finished takes no answers: its invites have expired.
    const { data: group, error: groupError } = await client
      .from('workout_groups')
      .select('status')
      .eq('id', groupId)
      .maybeSingle();
    if (groupError) throw new InternalServerErrorException('Failed to load the group');
    if ((group as { status: string } | null)?.status !== 'live') {
      throw new GoneException('This workout has already finished');
    }
    const respondedAt = new Date().toISOString();

    if (action === 'decline') {
      const { error } = await client
        .from('workout_group_members')
        .update({ status: 'declined', responded_at: respondedAt })
        .eq('id', member.id)
        .eq('status', 'invited');
      if (error) throw new InternalServerErrorException('Failed to decline the invite');
      void this.pushAnswer(userId, member.added_by ?? null, groupId, 'declined');
      return;
    }

    // Only this invite's own row changes: nobody else in the group is touched.
    const { error } = await client
      .from('workout_group_members')
      .update({ status: 'joined', responded_at: respondedAt })
      .eq('id', member.id)
      .eq('status', 'invited');
    if (error) throw new InternalServerErrorException('Failed to accept the invite');
    void this.pushAnswer(userId, member.added_by ?? null, groupId, 'accepted');

    const { data: existing, error: existingError } = await client
      .from('workouts')
      .select('id')
      .eq('user_id', userId)
      .eq('group_id', groupId)
      .is('deleted_at', null)
      .maybeSingle();
    if (existingError) throw new InternalServerErrorException('Failed to set up your workout');
    if (!existing) {
      const name = await this.loadGroupName(groupId);
      await this.createMemberWorkout(userId, groupId, name);
    }
  }

  /**
   * Finishes the group for everyone: every open group workout is completed. An exercise added
   * in the group is added to everyone's workout, so first each person's loses the ones they did
   * nothing on -- people often do their own variation -- and keeps only what they did.
   */
  async finish(userId: string, groupId: string): Promise<void> {
    await this.requireJoined(userId, groupId);
    await this.requireLive(groupId);
    const client = this.supabaseService.getClient();
    const now = new Date().toISOString();

    await this.dropUndoneExercises(groupId, now);

    const { error: groupError } = await client
      .from('workout_groups')
      .update({ status: 'finished', finished_at: now })
      .eq('id', groupId);
    if (groupError) throw new InternalServerErrorException('Failed to finish the group');

    const { error } = await client
      .from('workouts')
      .update({ completed_at: now })
      .eq('group_id', groupId)
      .is('completed_at', null)
      .is('deleted_at', null);
    if (error) throw new InternalServerErrorException('Failed to finish the group workouts');
  }

  /** Leaves the group. The host finishes the group instead, so it is never left without one. */
  async leave(userId: string, groupId: string): Promise<void> {
    const member = await this.requireJoined(userId, groupId);
    if (member.role === 'host') {
      throw new BadRequestException('The host finishes the group instead of leaving it');
    }
    const client = this.supabaseService.getClient();
    const now = new Date().toISOString();

    const { error } = await client
      .from('workout_group_members')
      .update({ status: 'left' })
      .eq('id', member.id);
    if (error) throw new InternalServerErrorException('Failed to leave the group');

    // Leaving discards this person's open workout. Only Finish Group Workout logs a workout.
    const { error: workoutError } = await client
      .from('workouts')
      .update({ deleted_at: now })
      .eq('group_id', groupId)
      .eq('user_id', userId)
      .is('completed_at', null)
      .is('deleted_at', null);
    if (workoutError) throw new InternalServerErrorException('Failed to discard your workout');
  }

  /**
   * Cancels the caller's workout in the group. It is discarded, never counted in history.
   * A member then leaves the group. The host ends the group for everyone instead, so it is
   * never left without one.
   */
  async cancel(userId: string, groupId: string): Promise<void> {
    const member = await this.requireJoined(userId, groupId);
    await this.requireLive(groupId);
    const client = this.supabaseService.getClient();
    const now = new Date().toISOString();

    // A cancel never logs a workout. The host's cancel discards everyone's open workout in
    // the group and ends it; a member's discards only their own and leaves the group.
    let discard = client
      .from('workouts')
      .update({ deleted_at: now })
      .eq('group_id', groupId)
      .is('completed_at', null)
      .is('deleted_at', null);
    if (member.role !== 'host') discard = discard.eq('user_id', userId);
    const { error } = await discard;
    if (error) throw new InternalServerErrorException('Failed to cancel the workout');

    if (member.role === 'host') {
      const { error: endError } = await client
        .from('workout_groups')
        .update({ status: 'finished', finished_at: now })
        .eq('id', groupId);
      if (endError) throw new InternalServerErrorException('Failed to end the group');
      return;
    }
    const { error: leaveError } = await client
      .from('workout_group_members')
      .update({ status: 'left' })
      .eq('id', member.id);
    if (leaveError) throw new InternalServerErrorException('Failed to leave the group');
  }

  /**
   * Adds one of the caller's active clients. A tracked client (one with no account of
   * their own) joins straight away, because the trainer is bringing them. A client with
   * an account is invited and accepts, as anyone else does.
   */
  async addClient(
    userId: string,
    groupId: string,
    clientId: string,
  ): Promise<{ userId: string; status: 'invited' | 'joined' }> {
    await this.requireLive(groupId);
    await this.requireJoined(userId, groupId);
    await this.assertTrainerEntitlement(userId);
    const client = this.supabaseService.getClient();

    const { data: link, error: linkError } = await client
      .from('trainer_clients')
      .select('id')
      .eq('trainer_id', userId)
      .eq('client_id', clientId)
      .eq('status', 'active')
      .maybeSingle();
    if (linkError) throw new InternalServerErrorException('Failed to check your clients');
    if (!link) throw new ForbiddenException('Only your active clients can be added this way');

    const existing = await this.findMember(groupId, clientId);
    if (existing && (existing.status === 'invited' || existing.status === 'joined')) {
      return { userId: clientId, status: existing.status };
    }

    const { data: tracked, error: trackedError } = await client
      .from('trainer_placeholder_clients')
      .select('id')
      .eq('trainer_id', userId)
      .eq('placeholder_user_id', clientId)
      .is('claimed_at', null)
      .maybeSingle();
    if (trackedError) throw new InternalServerErrorException('Failed to check your clients');

    const joinsNow = tracked !== null;
    const status = joinsNow ? 'joined' : 'invited';
    const row = {
      role: 'member' as const,
      status,
      is_guest: false,
      added_by: userId,
      // A client with an account is invited, as a friend is; a tracked client joins straight off.
      invited_at: joinsNow ? null : new Date().toISOString(),
      responded_at: null,
    };
    const { error: writeError } = existing
      ? await client.from('workout_group_members').update(row).eq('id', existing.id)
      : await client
          .from('workout_group_members')
          .insert({ group_id: groupId, user_id: clientId, ...row });
    if (writeError) throw new InternalServerErrorException('Failed to add the client');
    if (!joinsNow) void this.pushInvite(userId, clientId, groupId);

    if (joinsNow) {
      const name = await this.loadGroupName(groupId);
      await this.createMemberWorkout(clientId, groupId, name);
    }
    return { userId: clientId, status };
  }

  /** The caller picks which day of their split their group workout is, or clears it. */
  async setMyWorkoutDay(userId: string, groupId: string, splitDayId: string | null): Promise<void> {
    await this.requireJoined(userId, groupId);
    if (splitDayId) await this.ownedSplitDayName(userId, splitDayId);
    const { error } = await this.supabaseService
      .getClient()
      .from('workouts')
      .update({ workout_split_day_id: splitDayId })
      .eq('group_id', groupId)
      .eq('user_id', userId)
      .is('deleted_at', null);
    if (error) throw new InternalServerErrorException('Failed to set the day');
  }

  // ---- internals -----------------------------------------------------------

  /** The name of a day in one of the caller's own splits. Anyone else's day is not found. */
  private async ownedSplitDayName(userId: string, splitDayId: string): Promise<string> {
    const client = this.supabaseService.getClient();
    const { data: day, error } = await client
      .from('workout_split_days')
      .select('name, workout_split_id')
      .eq('id', splitDayId)
      .maybeSingle();
    if (error) throw new InternalServerErrorException('Failed to look up the day');
    const row = day as { name: string; workout_split_id: string } | null;
    if (!row) throw new NotFoundException('That day is not in your split');

    const { data: split, error: splitError } = await client
      .from('workout_splits')
      .select('id')
      .eq('id', row.workout_split_id)
      .eq('user_id', userId)
      .maybeSingle();
    if (splitError) throw new InternalServerErrorException('Failed to look up the day');
    if (!split) throw new NotFoundException('That day is not in your split');
    return row.name;
  }

  /** Trainer actions need the Trainer entitlement, as they do everywhere else in trainer mode. */
  private async assertTrainerEntitlement(userId: string): Promise<void> {
    const { data, error } = await this.supabaseService
      .getClient()
      .from('subscriptions')
      .select('id')
      .eq('user_id', userId)
      .eq('entitlement_id', 'trainer')
      .eq('status', 'active')
      .gt('current_period_ends_at', new Date().toISOString())
      .maybeSingle();
    if (error) throw new InternalServerErrorException('Failed to check your subscription');
    if (!data) throw new ForbiddenException('A Trainer subscription is required to add clients');
  }

  /**
   * Takes every exercise with no set finished on it off the group's open workouts --
   * soft-deleted, as removing one does. Each workout is its owner's alone, so this only ever
   * touches the workout of the person who didn't do it.
   */
  private async dropUndoneExercises(groupId: string, now: string): Promise<void> {
    const client = this.supabaseService.getClient();
    const { data: workouts, error: workoutsError } = await client
      .from('workouts')
      .select('id')
      .eq('group_id', groupId)
      .is('completed_at', null)
      .is('deleted_at', null);
    if (workoutsError) throw new InternalServerErrorException('Failed to load the group workouts');
    const workoutIds = ((workouts ?? []) as { id: string }[]).map((workout) => workout.id);
    if (workoutIds.length === 0) return;

    const { data: exercises, error: exercisesError } = await client
      .from('workout_exercises')
      .select('id, sets(completed_at, deleted_at)')
      .in('workout_id', workoutIds)
      .is('deleted_at', null);
    if (exercisesError) {
      throw new InternalServerErrorException('Failed to load the group workouts');
    }
    const undone = ((exercises ?? []) as ExerciseSetsRow[])
      .filter(
        (exercise) =>
          !(exercise.sets ?? []).some(
            (set) => set.completed_at !== null && set.deleted_at === null,
          ),
      )
      .map((exercise) => exercise.id);
    if (undone.length === 0) return;

    const { error } = await client
      .from('workout_exercises')
      .update({ deleted_at: now })
      .in('id', undone);
    if (error) throw new InternalServerErrorException('Failed to tidy the group workouts');
  }

  private async requireLive(groupId: string): Promise<void> {
    const { data, error } = await this.supabaseService
      .getClient()
      .from('workout_groups')
      .select('status')
      .eq('id', groupId)
      .maybeSingle();
    if (error) throw new InternalServerErrorException('Failed to load the group');
    if (!data) throw new NotFoundException('Group not found');
    if ((data as { status: string }).status !== 'live') {
      throw new BadRequestException('This group has already finished');
    }
  }

  /** The caller's joined membership, or 403. Non-members learn nothing about the group. */
  private async requireJoined(userId: string, groupId: string): Promise<MemberRow> {
    const member = await this.findMember(groupId, userId);
    if (!member || member.status !== 'joined') {
      throw new ForbiddenException('You are not in this group');
    }
    return member;
  }

  /** "Sam wants to start a live workout with you." -- to the invitee, opening their invites. */
  private async pushInvite(fromId: string, toId: string, groupId: string): Promise<void> {
    if (!this.socialPush) return;
    try {
      const [name, group] = await Promise.all([
        this.socialPush.nameOf(fromId),
        this.loadGroupName(groupId),
      ]);
      await this.socialPush.notify(toId, 'groupInvites', {
        title: 'Live workout invite',
        body: `${name} wants to start a live workout with you: ${group}.`,
        path: 'groups',
      });
    } catch (err) {
      this.logger.warn(`Invite push failed: ${err instanceof Error ? err.message : String(err)}`);
    }
  }

  /** The answer, to whoever sent the invite, opening the group. */
  private async pushAnswer(
    fromId: string,
    toId: string | null,
    groupId: string,
    answer: 'accepted' | 'declined',
  ): Promise<void> {
    if (!this.socialPush || !toId || toId === fromId) return;
    try {
      const [name, group] = await Promise.all([
        this.socialPush.nameOf(fromId),
        this.loadGroupName(groupId),
      ]);
      await this.socialPush.notify(
        toId,
        'groupInvites',
        answer === 'accepted'
          ? {
              title: 'Invite accepted',
              body: `${name} is joining your live workout: ${group}.`,
              path: `groups/${groupId}`,
            }
          : {
              title: 'Invite declined',
              body: `${name} can't join your live workout: ${group}.`,
              path: `groups/${groupId}`,
            },
      );
    } catch (err) {
      this.logger.warn(`Answer push failed: ${err instanceof Error ? err.message : String(err)}`);
    }
  }

  private async findMember(groupId: string, userId: string): Promise<MemberRow | null> {
    const { data, error } = await this.supabaseService
      .getClient()
      .from('workout_group_members')
      .select(MEMBER_COLUMNS)
      .eq('group_id', groupId)
      .eq('user_id', userId)
      .maybeSingle();
    if (error) throw new InternalServerErrorException('Failed to check membership');
    return (data as MemberRow | null) ?? null;
  }

  private async createMemberWorkout(
    userId: string,
    groupId: string,
    name: string,
    splitDayId?: string,
  ): Promise<void> {
    const { error } = await this.supabaseService
      .getClient()
      .from('workouts')
      .insert({
        user_id: userId,
        name,
        performed_at: new Date().toISOString(),
        group_id: groupId,
        workout_split_day_id: splitDayId ?? null,
      });
    if (error) {
      if (/duplicate key|unique/i.test(error.message)) {
        throw new ConflictException('You already have a live workout. Finish or cancel it first.');
      }
      throw new InternalServerErrorException('Failed to create the workout');
    }
  }

  private async loadGroupName(groupId: string): Promise<string> {
    const { data, error } = await this.supabaseService
      .getClient()
      .from('workout_groups')
      .select('name')
      .eq('id', groupId)
      .maybeSingle();
    if (error || !data) throw new InternalServerErrorException('Failed to load the group');
    return (data as { name: string }).name;
  }

  private async loadDisplayNames(userIds: string[]): Promise<Map<string, string | null>> {
    const map = new Map<string, string | null>();
    if (userIds.length === 0) return map;
    const { data, error } = await this.supabaseService
      .getClient()
      .from('users')
      .select('id, display_name')
      .in('id', userIds);
    if (error) throw new InternalServerErrorException('Failed to load names');
    for (const row of (data ?? []) as { id: string; display_name: string | null }[]) {
      map.set(row.id, row.display_name);
    }
    return map;
  }

  /**
   * Friends (an accepted follow, either way) and clients (an active trainer link,
   * either way). Only these can be invited, so a group is never open to strangers.
   */
  private async areConnected(a: string, b: string): Promise<boolean> {
    const client = this.supabaseService.getClient();
    const [followOut, followIn, linkOut, linkIn] = await Promise.all([
      client
        .from('follows')
        .select('id')
        .eq('follower_id', a)
        .eq('followee_id', b)
        .eq('status', 'accepted')
        .maybeSingle(),
      client
        .from('follows')
        .select('id')
        .eq('follower_id', b)
        .eq('followee_id', a)
        .eq('status', 'accepted')
        .maybeSingle(),
      client
        .from('trainer_clients')
        .select('id')
        .eq('trainer_id', a)
        .eq('client_id', b)
        .eq('status', 'active')
        .maybeSingle(),
      client
        .from('trainer_clients')
        .select('id')
        .eq('trainer_id', b)
        .eq('client_id', a)
        .eq('status', 'active')
        .maybeSingle(),
    ]);
    const results = [followOut, followIn, linkOut, linkIn];
    if (results.some((r) => r.error))
      throw new InternalServerErrorException('Failed to check your connections');
    return results.some((r) => r.data !== null);
  }
}
