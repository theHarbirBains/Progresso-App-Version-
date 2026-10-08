import { request } from './apiClient';

// Group workouts (see apps/api/src/groups). Friends, clients and guests can be in a group;
// every joined member can read and edit every group workout's exercises and sets.
export interface GroupSummary {
  id: string;
  name: string;
  hostId: string;
  startedAt: string;
  myRole: 'host' | 'member';
}

export interface GroupMember {
  userId: string;
  displayName: string | null;
  role: 'host' | 'member';
  status: 'invited' | 'joined';
  isGuest: boolean;
  /** This member's workout in the group, or null while they are only invited. */
  workoutId: string | null;
  /** The day of their split this group workout is, or null. */
  workoutSplitDayId: string | null;
  workoutName: string | null;
}

export interface GroupDetail {
  id: string;
  name: string;
  status: 'live' | 'finished';
  hostId: string;
  startedAt: string;
  finishedAt: string | null;
  members: GroupMember[];
}

export interface GroupInvite {
  groupId: string;
  name: string;
  hostDisplayName: string | null;
  invitedAt: string;
}

/**
 * Starts a group and adds the people working out today. Nobody can be added once it has
 * started. `skipped` names anyone the server could not add (not a friend or client, or a
 * guest it could not create); the group starts regardless.
 */
export function createGroup(
  accessToken: string,
  input: {
    name: string;
    workoutId?: string;
    splitDayId?: string;
    workoutName?: string;
    friendUsernames?: string[];
    clientIds?: string[];
    guestNames?: string[];
  },
): Promise<{ groupId: string; skipped: string[] }> {
  return request<{ groupId: string; skipped: string[] }>('/api/v1/groups', accessToken, {
    method: 'POST',
    body: JSON.stringify(input),
  });
}

export function listGroups(accessToken: string): Promise<GroupSummary[]> {
  return request<GroupSummary[]>('/api/v1/groups', accessToken);
}

export function listGroupInvites(accessToken: string): Promise<GroupInvite[]> {
  return request<GroupInvite[]>('/api/v1/groups/invites', accessToken);
}

export function getGroup(accessToken: string, groupId: string): Promise<GroupDetail> {
  return request<GroupDetail>(`/api/v1/groups/${encodeURIComponent(groupId)}`, accessToken);
}

/** Discards the caller's workout in the group, so it never counts in history. A member leaves; the host ends the group for everyone. */
export function cancelGroupWorkout(accessToken: string, groupId: string): Promise<{ ok: true }> {
  return request(`/api/v1/groups/${encodeURIComponent(groupId)}/cancel`, accessToken, {
    method: 'POST',
  });
}

export function respondToGroupInvite(
  accessToken: string,
  groupId: string,
  action: 'accept' | 'decline',
): Promise<{ ok: true }> {
  return request<{ ok: true }>(
    `/api/v1/groups/${encodeURIComponent(groupId)}/invite`,
    accessToken,
    {
      method: 'PATCH',
      body: JSON.stringify({ action }),
    },
  );
}

export function finishGroup(accessToken: string, groupId: string): Promise<{ ok: true }> {
  return request<{ ok: true }>(
    `/api/v1/groups/${encodeURIComponent(groupId)}/finish`,
    accessToken,
    {
      method: 'POST',
    },
  );
}

export function leaveGroup(accessToken: string, groupId: string): Promise<{ ok: true }> {
  return request<{ ok: true }>(`/api/v1/groups/${encodeURIComponent(groupId)}/leave`, accessToken, {
    method: 'POST',
  });
}

/** Which day of your split your group workout is. null clears it. */
export function setMyGroupWorkoutDay(
  accessToken: string,
  groupId: string,
  splitDayId: string | null,
): Promise<{ ok: true }> {
  return request<{ ok: true }>(
    `/api/v1/groups/${encodeURIComponent(groupId)}/my-workout`,
    accessToken,
    {
      method: 'PATCH',
      body: JSON.stringify({ splitDayId }),
    },
  );
}
