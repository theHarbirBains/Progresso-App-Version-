import { request } from './apiClient';
import type { ReportReason } from '../social/reportReasons';
import type { FollowUser } from './followsApi';

// Blocking and reporting -- see apps/api/src/safety. A block ends what connects two people
// (follows, invites, link requests) and keeps them from reaching each other again; a report
// is kept for review.
export interface ReportInput {
  reportedUserId: string;
  /** The Friends-feed workout the report is about, when there is one. */
  workoutId?: string;
  reason: ReportReason;
  details?: string;
}

export function listBlockedUsers(accessToken: string): Promise<FollowUser[]> {
  return request<FollowUser[]>('/api/v1/blocks', accessToken);
}

export function blockUser(accessToken: string, userId: string): Promise<{ success: true }> {
  return request<{ success: true }>(`/api/v1/blocks/${encodeURIComponent(userId)}`, accessToken, {
    method: 'POST',
  });
}

export function unblockUser(accessToken: string, userId: string): Promise<{ success: true }> {
  return request<{ success: true }>(`/api/v1/blocks/${encodeURIComponent(userId)}`, accessToken, {
    method: 'DELETE',
  });
}

export function reportUser(accessToken: string, input: ReportInput): Promise<{ id: string }> {
  return request<{ id: string }>('/api/v1/reports', accessToken, {
    method: 'POST',
    body: JSON.stringify(input),
  });
}
