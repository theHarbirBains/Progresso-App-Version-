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
