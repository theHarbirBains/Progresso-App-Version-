import type { FeedbackCategory, FeedbackStatus } from '../feedback/feedbackLabels';
import { request } from './apiClient';

// Feedback & Suggestions -- see apps/api/src/feedback. Sending goes through the API (it checks,
// limits and writes); a person reads their own straight from Supabase (feedback/feedbackQueries).
// The inbox is the API's alone, for support and full admins.

export interface SendFeedbackInput {
  category: FeedbackCategory;
  title: string;
  description: string;
  /** Uploaded first, into the sender's own folder (feedback/screenshotUpload). */
  screenshotPath?: string;
  appVersion?: string;
  buildNumber?: string;
  platform?: 'ios' | 'android';
  osVersion?: string;
}

export interface FeedbackSubmission {
  id: string;
  userId: string;
  category: FeedbackCategory;
  title: string;
  description: string;
  screenshotPath: string | null;
  appVersion: string | null;
  buildNumber: string | null;
  platform: string | null;
  osVersion: string | null;
  status: FeedbackStatus;
  statusChangedAt: string;
  createdAt: string;
}

export interface FeedbackSender {
  id: string;
  displayName: string | null;
  username: string | null;
}

export interface FeedbackInboxItem extends FeedbackSubmission {
  sender: FeedbackSender;
}

export interface FeedbackInbox {
  items: FeedbackInboxItem[];
  counts: Record<FeedbackStatus, number>;
  nextBefore: string | null;
}

export interface FeedbackNote {
  id: string;
  body: string;
  createdAt: string;
  author: { id: string; displayName: string | null } | null;
}

export interface FeedbackReview extends FeedbackInboxItem {
  screenshotUrl: string | null;
  history: { status: FeedbackStatus; at: string }[];
  notes: FeedbackNote[];
}

export interface FeedbackInboxFilters {
  status?: FeedbackStatus;
  category?: FeedbackCategory;
  q?: string;
  before?: string;
}

export function sendFeedback(
  accessToken: string,
  input: SendFeedbackInput,
): Promise<FeedbackSubmission> {
  return request<FeedbackSubmission>('/api/v1/feedback', accessToken, {
    method: 'POST',
    body: JSON.stringify(input),
  });
}

/** The signed-in person's role, from admin_users through the API -- for what the app offers. */
export async function fetchMyRole(accessToken: string): Promise<string> {
  const me = await request<{ role?: string }>('/api/v1/users/me', accessToken);
  return me.role ?? 'user';
}

export function fetchFeedbackInbox(
  accessToken: string,
  filters: FeedbackInboxFilters = {},
): Promise<FeedbackInbox> {
  const params = new URLSearchParams();
  for (const [key, value] of Object.entries(filters)) {
    if (value) params.set(key, value);
  }
  const query = params.toString();
  return request<FeedbackInbox>(`/api/v1/admin/feedback${query ? `?${query}` : ''}`, accessToken);
}

export function fetchFeedbackReview(accessToken: string, id: string): Promise<FeedbackReview> {
  return request<FeedbackReview>(`/api/v1/admin/feedback/${encodeURIComponent(id)}`, accessToken);
}

export function updateFeedbackStatus(
  accessToken: string,
  id: string,
  status: FeedbackStatus,
): Promise<FeedbackReview> {
  return request<FeedbackReview>(
    `/api/v1/admin/feedback/${encodeURIComponent(id)}/status`,
    accessToken,
    { method: 'PATCH', body: JSON.stringify({ status }) },
  );
}

export function addFeedbackNote(
  accessToken: string,
  id: string,
  body: string,
): Promise<FeedbackReview> {
  return request<FeedbackReview>(
    `/api/v1/admin/feedback/${encodeURIComponent(id)}/notes`,
    accessToken,
    { method: 'POST', body: JSON.stringify({ body }) },
  );
}
