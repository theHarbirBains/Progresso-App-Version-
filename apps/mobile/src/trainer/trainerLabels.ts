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
    default:
      return activity.action;
  }
}
