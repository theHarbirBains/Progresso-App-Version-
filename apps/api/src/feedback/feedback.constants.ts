// Feedback & Suggestions (20261026100000_feedback_board.sql): what can be sent, and where it
// goes from there. The same lists as the table's own checks.

export const FEEDBACK_CATEGORIES = ['bug', 'feature', 'usability', 'general'] as const;
export type FeedbackCategory = (typeof FEEDBACK_CATEGORIES)[number];

export const FEEDBACK_STATUSES = [
  'new',
  'reviewing',
  'planned',
  'in_progress',
  'completed',
  'declined',
] as const;
export type FeedbackStatus = (typeof FEEDBACK_STATUSES)[number];

export const FEEDBACK_PLATFORMS = ['ios', 'android'] as const;

/** The private bucket screenshots are kept in, each in its sender's own folder. */
export const FEEDBACK_SCREENSHOT_BUCKET = 'feedback-screenshots';

/** "<user id>/<name>.jpg" -- the app's own naming, nothing else. */
export const SCREENSHOT_PATH = /^[0-9a-f-]{36}\/[A-Za-z0-9_-]{1,64}\.(?:jpg|jpeg|png)$/;
