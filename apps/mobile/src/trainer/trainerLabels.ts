import type { TrainerActivity, TrainerClient } from '../lib/api';

/**
 * The status line under a client's name in the client list. Pending means the
 * client has not accepted yet; managed means the trainer created the account,
 * linked means the client owns it.
 */
export function trainerClientStatusLabel(client: TrainerClient): string {
  if (client.status === 'pending') return 'Waiting for them to accept';
  return client.source === 'managed' ? 'Managed account' : 'Linked account';
}

/**
 * One line describing a logged activity, worded for whoever is reading the
 * activity list: the trainer (who did it) or the client (whom it was done to).
 * An action this app does not know yet shows its raw name, rather than a
 * guessed meaning.
 */
export function describeTrainerActivity(activity: TrainerActivity, userId: string): string {
  const asTrainer = activity.trainerId === userId;
  switch (activity.action) {
    case 'client.created':
      return asTrainer ? 'Added a new client' : 'A trainer added you as a client';
    case 'client.profile_updated':
      return asTrainer ? 'Updated a client’s details' : 'A trainer updated your details';
    case 'workout.logged':
      return asTrainer ? 'Logged a workout for a client' : 'A trainer logged a workout for you';
    case 'link.requested':
      return asTrainer ? 'Sent a link request' : 'A trainer sent you a link request';
    case 'link.accepted':
      return asTrainer ? 'Client accepted the link' : 'You accepted a trainer’s link';
    case 'link.declined':
      return asTrainer ? 'Client declined the link' : 'You declined a trainer’s link';
    case 'link.ended':
      return 'Link ended';
    default:
      return activity.action;
  }
}
