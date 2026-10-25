import { supabase } from '../lib/supabase';
import type { FeedbackSubmission } from '../lib/feedbackApi';
import { FEEDBACK_SCREENSHOT_BUCKET } from './screenshotUpload';
import type { FeedbackCategory, FeedbackStatus } from './feedbackLabels';

// The signed-in person's own feedback, straight from Supabase: RLS lets them read only their own,
// and its status history, and nothing of the admins' notes.

const COLUMNS =
  'id, user_id, category, title, description, screenshot_path, app_version, build_number, platform, os_version, status, status_changed_at, created_at';

interface Row {
  id: string;
  user_id: string;
  category: FeedbackCategory;
  title: string;
  description: string;
  screenshot_path: string | null;
  app_version: string | null;
  build_number: string | null;
  platform: string | null;
  os_version: string | null;
  status: FeedbackStatus;
  status_changed_at: string;
  created_at: string;
}

function toSubmission(row: Row): FeedbackSubmission {
  return {
    id: row.id,
    userId: row.user_id,
    category: row.category,
    title: row.title,
    description: row.description,
    screenshotPath: row.screenshot_path,
    appVersion: row.app_version,
    buildNumber: row.build_number,
    platform: row.platform,
    osVersion: row.os_version,
    status: row.status,
    statusChangedAt: row.status_changed_at,
    createdAt: row.created_at,
  };
}

/** Everything the person has sent, newest first. */
export async function fetchMyFeedback(userId: string): Promise<FeedbackSubmission[]> {
  const { data, error } = await supabase
    .from('feedback_submissions')
    .select(COLUMNS)
    .eq('user_id', userId)
    .order('created_at', { ascending: false });
  if (error) throw new Error(error.message);
  return ((data ?? []) as Row[]).map(toSubmission);
}

export interface MyFeedbackDetail {
  submission: FeedbackSubmission;
  history: { status: FeedbackStatus; at: string }[];
  /** A link to their own screenshot, or null without one (or when it can't be made). */
  screenshotUrl: string | null;
}

/** One of the person's own, with its status history and their screenshot. */
export async function fetchMyFeedbackDetail(id: string): Promise<MyFeedbackDetail> {
  const [submission, history] = await Promise.all([
    supabase.from('feedback_submissions').select(COLUMNS).eq('id', id).maybeSingle(),
    supabase
      .from('feedback_status_events')
      .select('status, created_at')
      .eq('submission_id', id)
      .order('created_at', { ascending: true }),
  ]);
  if (submission.error) throw new Error(submission.error.message);
  if (history.error) throw new Error(history.error.message);
  if (!submission.data) throw new Error('This feedback could not be found');
  const row = submission.data as Row;
  let screenshotUrl: string | null = null;
  if (row.screenshot_path) {
    const { data } = await supabase.storage
      .from(FEEDBACK_SCREENSHOT_BUCKET)
      .createSignedUrl(row.screenshot_path, 60 * 60);
    screenshotUrl = data?.signedUrl ?? null;
  }
  return {
    submission: toSubmission(row),
    history: ((history.data ?? []) as { status: FeedbackStatus; created_at: string }[]).map(
      (event) => ({ status: event.status, at: event.created_at }),
    ),
    screenshotUrl,
  };
}
