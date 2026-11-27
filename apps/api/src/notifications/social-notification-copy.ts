/**
 * What each social notification says and opens -- the push and the in-app Notifications screen
 * both use these words, so the two always read the same (Harbir's push notification brief,
 * 2026-11-27). Nothing private about a workout is ever in them: a like or comment says "your
 * workout", never its name.
 */

export const SOCIAL_NOTIFICATION_TYPES = [
  'follow_request',
  'follow_accepted',
  'new_follower',
  'workout_invite',
  'invite_answer',
  'workout_like',
  'workout_comment',
] as const;

export type SocialNotificationType = (typeof SOCIAL_NOTIFICATION_TYPES)[number];

/** The longest a name runs in a notification before it's cut. */
const NAME_MAX = 40;
/** The longest a comment's preview runs. */
export const COMMENT_PREVIEW_MAX = 80;

/** A name fit for a notification: its own words, single-spaced and not too long -- "Someone" without one. */
export function notificationName(name: string | null | undefined): string {
  const clean = (name ?? '').replace(/\s+/g, ' ').trim();
  if (!clean) return 'Someone';
  return clean.length > NAME_MAX ? `${clean.slice(0, NAME_MAX - 1).trimEnd()}…` : clean;
}

/** A comment's opening words, on one line: "Great session!", or the start of a long one "…". */
export function commentPreview(text: string | null | undefined): string {
  const clean = (text ?? '').replace(/\s+/g, ' ').trim();
  if (clean.length <= COMMENT_PREVIEW_MAX) return clean;
  return `${clean.slice(0, COMMENT_PREVIEW_MAX - 1).trimEnd()}…`;
}

export interface NotificationCopyInput {
  type: SocialNotificationType;
  /** The latest person behind it, as named (notificationName). */
  actorName: string;
  /** How many people are behind it (a grouped like). */
  actorCount: number;
  /** A comment's preview, or an invitation's answer. */
  preview?: string | null;
  /** The group's name, for an invitation's answer. */
  groupName?: string | null;
}

/** "Sam", "Sam and 1 other", "Sam and 3 others". */
function withOthers(name: string, count: number): string {
  const others = count - 1;
  if (others <= 0) return name;
  return `${name} and ${others} ${others === 1 ? 'other' : 'others'}`;
}

/** A notification's title and body. */
export function notificationCopy(input: NotificationCopyInput): { title: string; body: string } {
  const name = input.actorName;
  switch (input.type) {
    case 'follow_request':
      return {
        title: 'New follow request',
        body: `${name} wants to follow you. Check out their profile!`,
      };
    case 'follow_accepted':
      return {
        title: 'Follow request accepted',
        body: `${name} accepted your follow request. You're now connected!`,
      };
    case 'new_follower':
      return { title: 'New follower', body: `${name} started following you.` };
    case 'workout_invite':
      return {
        title: 'Workout invitation',
        body: `${name} wants to train with you! Join their workout?`,
      };
    case 'invite_answer': {
      const group = input.groupName ? `: ${input.groupName}` : '';
      return input.preview === 'declined'
        ? { title: 'Invite declined', body: `${name} can't join your live workout${group}.` }
        : { title: 'Invite accepted', body: `${name} is joining your live workout${group}.` };
    }
    case 'workout_like':
      return {
        title: 'New workout like',
        body: `${withOthers(name, input.actorCount)} liked your workout. Keep up the great work!`,
      };
    case 'workout_comment':
      return {
        title: 'New workout comment',
        body: input.preview
          ? `${name} commented on your workout: "${input.preview}"`
          : `${name} commented on your workout.`,
      };
  }
}

/** What a notification is about, by id -- what its tap opens. */
export interface NotificationTarget {
  type: SocialNotificationType;
  actorId: string | null;
  workoutId?: string | null;
  commentId?: string | null;
  groupId?: string | null;
}

/**
 * The screen a notification opens, as the app's links have it (navigation/linking.ts):
 * a follow request the Notifications screen (its Accept and Decline); a request accepted or a
 * new follower their profile; an invitation Groups (to accept or decline); an invitation's answer
 * its group; a like the workout; a comment the workout, at its comments.
 */
export function notificationPath(target: NotificationTarget): string {
  switch (target.type) {
    case 'follow_request':
      return 'notifications';
    case 'follow_accepted':
    case 'new_follower':
      return target.actorId ? `people/${target.actorId}` : 'notifications';
    case 'workout_invite':
      return 'groups';
    case 'invite_answer':
      return target.groupId ? `groups/${target.groupId}` : 'groups';
    case 'workout_like':
      return target.workoutId ? `workouts/${target.workoutId}` : 'notifications';
    case 'workout_comment':
      return target.workoutId ? `workouts/${target.workoutId}?focusComments=true` : 'notifications';
  }
}
