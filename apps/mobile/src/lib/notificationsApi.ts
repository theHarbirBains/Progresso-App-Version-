import { request } from './apiClient';

// Real push notification delivery (Expo push service) -- through the
// backend, never direct-to-Supabase: registering a device token and
// actually sending are real server-side orchestration (see
// apps/api/src/notifications/). iOS only for now -- see
// pushNotifications.ts, which never calls these on Android.
export function registerPushToken(
  accessToken: string,
  expoPushToken: string,
  platform: 'ios' | 'android',
): Promise<{ registered: true }> {
  return request<{ registered: true }>('/api/v1/notifications/push-token', accessToken, {
    method: 'POST',
    body: JSON.stringify({ expoPushToken, platform }),
  });
}

export function unregisterPushToken(
  accessToken: string,
  expoPushToken: string,
): Promise<{ removed: true }> {
  return request<{ removed: true }>('/api/v1/notifications/push-token', accessToken, {
    method: 'DELETE',
    body: JSON.stringify({ expoPushToken }),
  });
}

/** The kinds of social notification (the server's `notifications.type`). */
export type SocialNotificationType =
  | 'follow_request'
  | 'follow_accepted'
  | 'new_follower'
  | 'workout_invite'
  | 'invite_answer'
  | 'workout_like'
  | 'workout_comment';

/**
 * One notification in the Notifications screen -- the same words as its push, whether it's been
 * read, who's behind it, and (read fresh) whether what it's about is still there.
 */
export interface AppNotification {
  id: string;
  type: SocialNotificationType;
  title: string;
  body: string;
  at: string;
  read: boolean;
  actor: {
    id: string;
    username: string | null;
    displayName: string | null;
    avatarUrl: string | null;
  } | null;
  actorCount: number;
  /** The app's link for it, as its push carries ("workouts/<id>"). */
  path: string;
  followId: string | null;
  workoutId: string | null;
  commentId: string | null;
  groupId: string | null;
  /** Whether what it's about can still be opened (a workout deleted, an invitation expired). */
  available: boolean;
  followStatus?: 'pending' | 'accepted';
  followingBack?: 'none' | 'pending' | 'accepted';
  inviteStatus?: 'invited' | 'joined' | 'declined' | 'cancelled' | 'left' | 'expired';
}

/** Their notifications, newest first, and how many are unread. */
export function listNotifications(
  accessToken: string,
): Promise<{ notifications: AppNotification[]; unread: number }> {
  return request('/api/v1/notifications', accessToken);
}

/** How many of their notifications are unread: the Feed bell's and the app icon's badge. */
export function fetchUnreadNotificationCount(accessToken: string): Promise<{ unread: number }> {
  return request('/api/v1/notifications/unread-count', accessToken);
}

/** Marks these of their notifications read -- or, with none given, every one. */
export function markNotificationsRead(
  accessToken: string,
  ids?: string[],
): Promise<{ unread: number }> {
  return request('/api/v1/notifications/read', accessToken, {
    method: 'POST',
    body: JSON.stringify(ids ? { ids } : {}),
  });
}
