import type { TrainerActivity, TrainerClient } from '../lib/api';
import { describeTrainerActivity, trainerClientStatusLabel } from './trainerLabels';

const TRAINER = 'trainer-1';
const CLIENT = 'client-1';

function client(overrides: Partial<TrainerClient>): TrainerClient {
  return {
    clientId: CLIENT,
    status: 'active',
    source: 'managed',
    displayName: 'Sam',
    birthday: null,
    heightValue: null,
    heightUnit: 'cm',
    weightValue: null,
    weightUnit: 'kg',
    ...overrides,
  };
}

function activity(action: string, trainerId = TRAINER): TrainerActivity {
  return {
    id: 'a1',
    trainerId,
    clientId: CLIENT,
    action,
    targetTable: null,
    targetId: null,
    details: {},
    createdAt: '2026-10-01T00:00:00.000Z',
  };
}

describe('trainerClientStatusLabel', () => {
  it('says a pending client has not accepted yet', () => {
    expect(trainerClientStatusLabel(client({ status: 'pending', source: 'linked' }))).toBe(
      'Waiting for them to accept',
    );
  });

  it('distinguishes a managed account from a linked one', () => {
    expect(trainerClientStatusLabel(client({ source: 'managed' }))).toBe('Managed account');
    expect(trainerClientStatusLabel(client({ source: 'linked' }))).toBe('Linked account');
  });
});

describe('describeTrainerActivity', () => {
  it('words a logged workout for the trainer who logged it', () => {
    expect(describeTrainerActivity(activity('workout.logged'), TRAINER)).toBe(
      'Logged a workout for a client',
    );
  });

  it('words the same entry for the client it was done to', () => {
    expect(describeTrainerActivity(activity('workout.logged'), CLIENT)).toBe(
      'A trainer logged a workout for you',
    );
  });

  it('describes link changes from both sides', () => {
    expect(describeTrainerActivity(activity('link.requested'), TRAINER)).toBe(
      'Sent a link request',
    );
    expect(describeTrainerActivity(activity('link.requested'), CLIENT)).toBe(
      'A trainer sent you a link request',
    );
    expect(describeTrainerActivity(activity('link.ended'), CLIENT)).toBe('Link ended');
  });

  it('shows an unknown action by its raw name rather than guessing', () => {
    expect(describeTrainerActivity(activity('workout.exported'), TRAINER)).toBe('workout.exported');
  });
});
