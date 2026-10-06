import {
  BadRequestException,
  ForbiddenException,
  Injectable,
  InternalServerErrorException,
  NotFoundException,
} from '@nestjs/common';
import { randomUUID } from 'node:crypto';
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
}

export interface GroupDetail {
  id: string;
  name: string;
  status: 'live' | 'finished';
  hostId: string;
  startedAt: string;
  finishedAt: string | null;
  members: GroupMemberView[];
}

export interface GroupInvite {
  groupId: string;
  name: string;
  hostDisplayName: string | null;
  invitedAt: string;
}

interface MemberRow {
  id: string;
  user_id: string;
  role: 'host' | 'member';
  status: 'invited' | 'joined' | 'left';
  is_guest: boolean;
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
  constructor(private readonly supabaseService: SupabaseService) {}

  async create(userId: string, dto: CreateGroupDto): Promise<{ groupId: string }> {
    const client = this.supabaseService.getClient();

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
      await this.createMemberWorkout(userId, groupId, dto.name);
    }

    return { groupId };
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
      .select('group_id, created_at')
      .eq('user_id', userId)
      .eq('status', 'invited');
    if (error) throw new InternalServerErrorException('Failed to load invites');

    const invites = (rows ?? []) as { group_id: string; created_at: string }[];
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
    const hosts = await this.loadDisplayNames(groupRows.map((g) => g.host_id));
    return invites
      .map((invite) => ({ invite, group: groupRows.find((g) => g.id === invite.group_id) }))
      .filter(
        (
          row,
        ): row is {
          invite: { group_id: string; created_at: string };
          group: { id: string; name: string; host_id: string };
        } => row.group !== undefined,
      )
      .map(({ invite, group }) => ({
        groupId: group.id,
        name: group.name,
        hostDisplayName: hosts.get(group.host_id) ?? null,
        invitedAt: invite.created_at,
      }));
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
      .select('id, user_id, role, status, is_guest')
      .eq('group_id', groupId)
      .in('status', ['invited', 'joined']);
    if (membersError) throw new InternalServerErrorException('Failed to load members');
    const members = (memberRows ?? []) as MemberRow[];

    const { data: workouts, error: workoutsError } = await client
      .from('workouts')
      .select('id, user_id')
      .eq('group_id', groupId)
      .is('deleted_at', null);
    if (workoutsError) throw new InternalServerErrorException('Failed to load workouts');
    const workoutByUser = new Map(
      ((workouts ?? []) as { id: string; user_id: string }[]).map((w) => [w.user_id, w.id]),
    );

    const names = await this.loadDisplayNames(members.map((m) => m.user_id));
    return {
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
        status: m.status === 'left' ? 'invited' : m.status,
        isGuest: m.is_guest,
        workoutId: workoutByUser.get(m.user_id) ?? null,
      })),
    };
  }

  /** Invites a friend or a client. Anyone in the group can invite, and the invitee must accept. */
  async inviteMember(
    userId: string,
    groupId: string,
    username: string,
  ): Promise<{ userId: string; status: 'invited' | 'joined' }> {
    await this.requireLive(groupId);
    await this.requireJoined(userId, groupId);
    const client = this.supabaseService.getClient();

    const { data: target, error } = await client
      .from('users')
      .select('id')
      .eq('username', username.toLowerCase())
      .maybeSingle();
    if (error) throw new InternalServerErrorException('Failed to look up that username');
    const targetId = (target as { id: string } | null)?.id;
    if (!targetId) throw new NotFoundException('No Progresso user has that username');
    if (targetId === userId) throw new BadRequestException('You are already in this group');

    if (!(await this.areConnected(userId, targetId))) {
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
    };
    const { error: writeError } = existing
      ? await client.from('workout_group_members').update(row).eq('id', existing.id)
      : await client
          .from('workout_group_members')
          .insert({ group_id: groupId, user_id: targetId, ...row });
    if (writeError) throw new InternalServerErrorException('Failed to send the invite');
    return { userId: targetId, status: 'invited' };
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

    if (action === 'decline') {
      const { error } = await client
        .from('workout_group_members')
        .update({ status: 'left' })
        .eq('id', member.id);
      if (error) throw new InternalServerErrorException('Failed to decline the invite');
      return;
    }

    const { error } = await client
      .from('workout_group_members')
      .update({ status: 'joined' })
      .eq('id', member.id);
    if (error) throw new InternalServerErrorException('Failed to accept the invite');

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

  /** Finishes the group for everyone: every open group workout is completed. */
  async finish(userId: string, groupId: string): Promise<void> {
    await this.requireJoined(userId, groupId);
    await this.requireLive(groupId);
    const client = this.supabaseService.getClient();
    const now = new Date().toISOString();

    const { error: groupError } = await client
      .from('workout_groups')
      .update({ status: 'finished', finished_at: now })
      .eq('id', groupId);
    if (groupError) throw new InternalServerErrorException('Failed to finish the group');

    const { error } = await client
      .from('workouts')
      .update({ completed_at: now })
      .eq('group_id', groupId)
      .is('completed_at', null);
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

    const { error: workoutError } = await client
      .from('workouts')
      .update({ completed_at: now })
      .eq('group_id', groupId)
      .eq('user_id', userId)
      .is('completed_at', null);
    if (workoutError) throw new InternalServerErrorException('Failed to close your workout');
  }

  // ---- internals -----------------------------------------------------------

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

  private async findMember(groupId: string, userId: string): Promise<MemberRow | null> {
    const { data, error } = await this.supabaseService
      .getClient()
      .from('workout_group_members')
      .select('id, user_id, role, status, is_guest')
      .eq('group_id', groupId)
      .eq('user_id', userId)
      .maybeSingle();
    if (error) throw new InternalServerErrorException('Failed to check membership');
    return (data as MemberRow | null) ?? null;
  }

  private async createMemberWorkout(userId: string, groupId: string, name: string): Promise<void> {
    const { error } = await this.supabaseService
      .getClient()
      .from('workouts')
      .insert({ user_id: userId, name, performed_at: new Date().toISOString(), group_id: groupId });
    if (error) throw new InternalServerErrorException('Failed to create the workout');
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
