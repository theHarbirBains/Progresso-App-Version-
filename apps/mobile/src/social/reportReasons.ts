// Why someone is being reported -- mirrors user_reports.reason
// (20261020100000_blocks_and_reports.sql) and the API's CreateReportDto.
export const REPORT_REASONS = [
  'spam',
  'harassment',
  'inappropriate',
  'impersonation',
  'other',
] as const;
export type ReportReason = (typeof REPORT_REASONS)[number];

export const REPORT_REASON_LABELS: Record<ReportReason, string> = {
  spam: 'Spam',
  harassment: 'Harassment or bullying',
  inappropriate: 'Inappropriate content',
  impersonation: 'Pretending to be someone else',
  other: 'Something else',
};
