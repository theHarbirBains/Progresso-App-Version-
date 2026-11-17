import { request } from './apiClient';

// Social v1: a one-directional, accept-gated follow graph -- see
// apps/api/src/follows for why every call here goes through the backend
// (reading another user's username/display name/workouts/food logs is
// exactly the cross-user-trusted read direct-to-Supabase RLS doesn't allow).
export type FollowStatus = 'none' | 'pending' | 'accepted';

export interface FollowUser {
  id: string;
  username: string | null;
  displayName: string | null;
  avatarUrl: string | null;
}

export interface FollowRequest {
  followId: string;
  user: FollowUser;
  createdAt: string;
}

export interface FollowSearchResult {
  user: FollowUser;
  status: FollowStatus;
}

export function searchUsers(accessToken: string, query: string): Promise<FollowSearchResult[]> {
  const params = new URLSearchParams({ query });
  return request<FollowSearchResult[]>(`/api/v1/follows/search?${params.toString()}`, accessToken);
}

export function listFollowRequests(accessToken: string): Promise<FollowRequest[]> {
  return request<FollowRequest[]>('/api/v1/follows/requests', accessToken);
}

export function listFollowing(accessToken: string): Promise<FollowUser[]> {
  return request<FollowUser[]>('/api/v1/follows/following', accessToken);
}

// The notifications bell's Activity section: pending requests, the ones you
// accepted recently (new followers, with whether you follow them back), and
// follows you sent that were accepted recently, merged and sorted server-side
// (see FollowsService.listNotifications) -- distinct from listFollowRequests,
// which stays the full management list for Find People's Requests tab.
export type FollowNotification =
  | { kind: 'request'; followId: string; user: FollowUser; at: string; followingBack: FollowStatus }
  | {
      kind: 'follower';
      followId: string;
      user: FollowUser;
      at: string;
      followingBack: FollowStatus;
    }
  | { kind: 'accepted'; followId: string; user: FollowUser; at: string }
  | {
      kind: 'like';
      id: string;
      user: FollowUser;
      workoutId: string;
      workoutName: string;
      at: string;
    }
  | {
      kind: 'comment';
      id: string;
      user: FollowUser;
      workoutId: string;
      workoutName: string;
      body: string;
      at: string;
    };

export function listFollowNotifications(accessToken: string): Promise<FollowNotification[]> {
  // `followers=1`: this app shows the requests you accepted, as new followers.
  return request<FollowNotification[]>('/api/v1/follows/notifications?followers=1', accessToken);
}

export function sendFollowRequest(
  accessToken: string,
  targetUserId: string,
): Promise<{ status: FollowStatus }> {
  return request<{ status: FollowStatus }>(
    `/api/v1/follows/${encodeURIComponent(targetUserId)}`,
    accessToken,
    { method: 'POST' },
  );
}

export function respondToFollowRequest(
  accessToken: string,
  followId: string,
  action: 'accept' | 'reject',
): Promise<{ success: true }> {
  return request<{ success: true }>(
    `/api/v1/follows/requests/${encodeURIComponent(followId)}`,
    accessToken,
    { method: 'PATCH', body: JSON.stringify({ action }) },
  );
}

export function unfollowUser(
  accessToken: string,
  targetUserId: string,
): Promise<{ success: true }> {
  return request<{ success: true }>(
    `/api/v1/follows/${encodeURIComponent(targetUserId)}`,
    accessToken,
    { method: 'DELETE' },
  );
}
