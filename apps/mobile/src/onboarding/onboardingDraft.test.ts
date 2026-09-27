import { updateMyProfile } from '../lib/api';
import { materializeWorkoutSplitPreset } from '../workouts/workoutSplitQueries';
import {
  computeStartStepIndex,
  EMPTY_DRAFT,
  isStepAnswered,
  STEP_ORDER,
  submitOnboardingDraft,
  type OnboardingDraft,
} from './onboardingDraft';

jest.mock('../lib/api', () => ({
  updateMyProfile: jest.fn(),
}));

jest.mock('../workouts/workoutSplitQueries', () => ({
  materializeWorkoutSplitPreset: jest.fn(),
}));

const mockUpdateMyProfile = updateMyProfile as jest.Mock;
const mockMaterialize = materializeWorkoutSplitPreset as jest.Mock;

beforeEach(() => {
  mockUpdateMyProfile.mockReset().mockResolvedValue({ id: 'user-1' });
  mockMaterialize.mockReset().mockResolvedValue({ id: 'split-new', name: 'Push / Pull / Legs' });
});

const FULL_DRAFT: OnboardingDraft = {
  ...EMPTY_DRAFT,
  referralSource: 'tiktok',
  country: 'CA',
  gender: 'male',
  birthday: '2000-06-15',
  weightValue: 80,
  heightValue: 180,
  fitnessGoal: 'build_muscle',
  trainingExperience: 'intermediate',
  workoutFrequencyDays: 4,
  averageWorkoutLength: '45_60',
  trainingStylePreference: 'guided',
  selectedSplitPresetId: 'ppl',
  appleHealthPreference: 'not_now',
  emailOptIn: true,
  pushNotificationsOptIn: false,
  pendingUsername: 'harbirb',
  pendingDisplayName: 'Harbir Bains',
};

describe('isStepAnswered / computeStartStepIndex', () => {
  // weight/height/birthday are wheel pickers -- they always show *some*
  // value, so EMPTY_DRAFT pre-fills them with that same default rather
  // than null (see EMPTY_DRAFT's own comment); every other step genuinely
  // starts unanswered.
  const PREFILLED_STEPS = new Set(['weight', 'height', 'birthday']);

  it('is unanswered for every step but the pre-filled wheel steps on a brand-new draft', () => {
    for (const step of STEP_ORDER) {
      expect(isStepAnswered(step, EMPTY_DRAFT)).toBe(PREFILLED_STEPS.has(step));
    }
    expect(computeStartStepIndex(EMPTY_DRAFT)).toBe(0);
  });

  it('resumes at the first unanswered step for a partially-completed draft', () => {
    const draft = {
      ...EMPTY_DRAFT,
      referralSource: 'tiktok',
      country: 'CA',
      gender: 'male',
    } as OnboardingDraft;

    expect(isStepAnswered('referralSource', draft)).toBe(true);
    expect(isStepAnswered('country', draft)).toBe(true);
    expect(isStepAnswered('gender', draft)).toBe(true);
    expect(isStepAnswered('fitnessGoal', draft)).toBe(false);
    expect(computeStartStepIndex(draft)).toBe(STEP_ORDER.indexOf('fitnessGoal'));
  });

  it('createAccount is never "answered" -- it is always the resume target once every question is done', () => {
    expect(isStepAnswered('createAccount', FULL_DRAFT)).toBe(false);
    expect(computeStartStepIndex(FULL_DRAFT)).toBe(STEP_ORDER.indexOf('createAccount'));
    expect(STEP_ORDER[STEP_ORDER.length - 1]).toBe('createAccount');
  });
});

describe('submitOnboardingDraft', () => {
  it('materializes the chosen split preset, then patches everything in one call including onboardingCompleted', async () => {
    await submitOnboardingDraft('token-123', 'user-1', FULL_DRAFT);

    expect(mockMaterialize).toHaveBeenCalledWith('user-1', expect.objectContaining({ id: 'ppl' }));
    expect(mockUpdateMyProfile).toHaveBeenCalledWith(
      'token-123',
      expect.objectContaining({
        referralSource: 'tiktok',
        country: 'CA',
        gender: 'male',
        birthday: '2000-06-15',
        weightValue: 80,
        heightValue: 180,
        fitnessGoal: 'build_muscle',
        trainingExperience: 'intermediate',
        workoutFrequencyDays: 4,
        averageWorkoutLength: '45_60',
        trainingStylePreference: 'guided',
        activeWorkoutSplitId: 'split-new',
        appleHealthPreference: 'not_now',
        emailOptIn: true,
        pushNotificationsOptIn: false,
        username: 'harbirb',
        displayName: 'Harbir Bains',
        onboardingCompleted: true,
      }),
    );
  });

  it('skips materializing a split entirely when none was chosen', async () => {
    await submitOnboardingDraft('token-123', 'user-1', {
      ...FULL_DRAFT,
      selectedSplitPresetId: null,
    });

    expect(mockMaterialize).not.toHaveBeenCalled();
    const patch = mockUpdateMyProfile.mock.calls[0][1];
    expect(patch.activeWorkoutSplitId).toBeUndefined();
  });
});
