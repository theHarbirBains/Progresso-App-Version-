// Feedback & Suggestions' categories and statuses (the API's feedback.constants.ts), as the app
// words them.

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

/** Short, for the category picker. */
export const CATEGORY_SHORT_LABELS: Record<FeedbackCategory, string> = {
  bug: 'Bug',
  feature: 'Feature',
  usability: 'Usability',
  general: 'General',
};

export const CATEGORY_LABELS: Record<FeedbackCategory, string> = {
  bug: 'Bug Report',
  feature: 'Feature Request',
  usability: 'Usability Issue',
  general: 'General Feedback',
};

export const STATUS_LABELS: Record<FeedbackStatus, string> = {
  new: 'New',
  reviewing: 'Reviewing',
  planned: 'Planned',
  in_progress: 'In Progress',
  completed: 'Completed',
  declined: 'Declined',
};

/** A status being worked on is shown in the accent; new, completed and declined are quiet. */
export function isActiveStatus(status: FeedbackStatus): boolean {
  return status === 'reviewing' || status === 'planned' || status === 'in_progress';
}
