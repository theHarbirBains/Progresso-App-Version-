import type { TrainerActivity, TrainerClient } from '../lib/api';
import { feetAndInchesFromCm } from '../onboarding/weightHeightConversion';

/**
 * The status line under a client's name in the client list. An invite is waiting
 * for its person to sign in; pending means they have not accepted yet; managed
 * means the invite created the account, linked means the client owns it.
 */
export function trainerClientStatusLabel(client: TrainerClient): string {
  if (client.status === 'invited') return 'Invite sent';
  if (client.awaitingClaim) return 'Not on Progresso yet';
  if (client.status === 'pending') return 'Waiting for them to accept';
  return client.source === 'managed' ? 'Managed account' : 'Linked account';
}

/** A client's height in both units, as stored in cm: "180 cm (5 ft 11 in)". */
export function formatTrainerHeight(heightCm: number | null): string {
  if (heightCm === null) return '—';
  const { feet, inches } = feetAndInchesFromCm(heightCm);
  return `${Math.round(heightCm)} cm (${feet} ft ${inches} in)`;
}

/**
 * One line naming who an activity is about, worded for whoever is reading the list.
 * The trainer reads "Logged a workout for Purnima"; the client reads "Sam logged a
 * workout for you". An action this app does not know yet shows its raw name, rather
 * than a guessed meaning.
 */
export function describeTrainerActivity(activity: TrainerActivity, userId: string): string {
  const asTrainer = activity.trainerId === userId;
  const who = activity.clientName ?? 'a client';
  const by = activity.trainerName ?? 'A trainer';
  switch (activity.action) {
    case 'client.created':
      return asTrainer ? `Added ${who} as a client` : `${by} added you as a client`;
    case 'client.profile_updated':
      return asTrainer ? `Updated ${who}’s details` : `${by} updated your details`;
    case 'workout.logged':
      return asTrainer ? `Logged a workout for ${who}` : `${by} logged a workout for you`;
    case 'live.started':
      return asTrainer
        ? `Started a live session for ${who}`
        : `${by} started a live session with you`;
    case 'live.finished':
      return asTrainer
        ? `Finished the live session for ${who}`
        : `${by} finished your live session`;
    case 'live.cancelled':
      return asTrainer
        ? `Cancelled a live session for ${who}`
        : `${by} cancelled a live session with you`;
    case 'link.requested':
      return asTrainer ? `Sent ${who} a link request` : `${by} sent you a link request`;
    case 'link.accepted':
      return asTrainer ? `${who} accepted the link` : `You accepted ${by}’s link`;
    case 'link.declined':
      return asTrainer ? `${who} declined the link` : `You declined ${by}’s link`;
    case 'link.ended':
      return asTrainer ? `Link with ${who} ended` : `Link with ${by} ended`;
    // A trainer's direct edits to a client's workouts (recorded by the database).
    case 'workout.created':
      return asTrainer ? `Started a workout for ${who}` : `${by} started a workout for you`;
    case 'workout.edited':
      return asTrainer ? `Edited ${who}’s workout` : `${by} edited one of your workouts`;
    case 'workout.deleted':
      return asTrainer ? `Deleted ${who}’s workout` : `${by} deleted one of your workouts`;
    case 'workout.restored':
      return asTrainer ? `Restored ${who}’s workout` : `${by} restored one of your workouts`;
    case 'exercise.added':
      return asTrainer
        ? `Added an exercise to ${who}’s workout`
        : `${by} added an exercise to your workout`;
    case 'exercise.edited':
      return asTrainer
        ? `Changed an exercise in ${who}’s workout`
        : `${by} changed an exercise in your workout`;
    case 'exercise.removed':
      return asTrainer
        ? `Removed an exercise from ${who}’s workout`
        : `${by} removed an exercise from your workout`;
    case 'exercise.restored':
      return asTrainer
        ? `Restored an exercise in ${who}’s workout`
        : `${by} restored an exercise in your workout`;
    case 'set.added':
      return asTrainer ? `Added a set for ${who}` : `${by} added a set to your workout`;
    case 'set.edited':
      return asTrainer ? `Edited a set of ${who}’s` : `${by} edited one of your sets`;
    case 'set.removed':
      return asTrainer ? `Removed a set of ${who}’s` : `${by} removed one of your sets`;
    case 'set.restored':
      return asTrainer ? `Restored a set of ${who}’s` : `${by} restored one of your sets`;
    default:
      return activity.action;
  }
}
