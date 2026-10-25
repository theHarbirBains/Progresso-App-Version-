import type { FeedbackSender } from '../lib/feedbackApi';

/** Who sent it: their name, else their @username, else "A deleted account". */
export function senderName(sender: FeedbackSender): string {
  if (sender.displayName) return sender.displayName;
  if (sender.username) return `@${sender.username}`;
  return 'A deleted account';
}
