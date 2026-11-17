import { Alert } from 'react-native';
import { claimTrainerHistory, registerPushToken, updateMyProfile } from '../lib/api';
import { requestPushToken } from '../lib/pushNotifications';
import { materializeWorkoutSplitPreset } from '../workouts/workoutSplitQueries';
import { saveNutritionGoals } from '../nutrition/nutritionGoalQueries';
import {
  computeStartStepIndex,
  EMPTY_DRAFT,
  isOldEnough,
  isStepAnswered,
  nextStepIndex,
  stepApplies,
  STEP_ORDER,
  STEP_SECTIONS,
  stepPlace,
  stepsAsked,
  submitOnboardingDraft,
  type OnboardingDraft,
} from './onboardingDraft';
import { takeCustomSplitBuilder } from './customSplitAfterSignUp';

jest.mock('../lib/api', () => ({
  updateMyProfile: jest.fn(),
  registerPushToken: jest.fn(),
  claimTrainerHistory: jest.fn(),
}));

jest.mock('../lib/pushNotifications', () => ({
  requestPushToken: jest.fn(),
}));

jest.mock('../nutrition/nutritionGoalQueries', () => ({
  saveNutritionGoals: jest.fn().mockResolvedValue({}),
}));
jest.mock('../workouts/workoutSplitQueries', () => ({
  materializeWorkoutSplitPreset: jest.fn(),
}));

const mockUpdateMyProfile = updateMyProfile as jest.Mock;
const mockRegisterPushToken = registerPushToken as jest.Mock;
const mockRequestPushToken = requestPushToken as jest.Mock;
const mockMaterialize = materializeWorkoutSplitPreset as jest.Mock;

beforeEach(() => {
  mockUpdateMyProfile.mockReset().mockResolvedValue({ id: 'user-1' });
  mockRegisterPushToken.mockReset().mockResolvedValue({ registered: true });
  mockRequestPushToken.mockReset().mockResolvedValue('ExponentPushToken[test]');
  mockMaterialize.mockReset().mockResolvedValue({ id: 'split-new', name: 'Push / Pull / Legs' });
  jest.mocked(saveNutritionGoals).mockClear();
});

const FULL_DRAFT: OnboardingDraft = {
  ...EMPTY_DRAFT,
  referralSource: 'tiktok',
  country: 'CA',
  gender: 'male',
  birthday: '2000-06-15',
  weightValue: 80,
  heightValue: 180,
  fitnessGoals: ['build_muscle'],
  membershipTier: 'everything',
  activityLevel: 'moderately_active',
  nutritionTargets: { calories: 2400, proteinG: 141, carbsG: 290, fatG: 52 },
  ranksSeen: true,
  trainingComfort: 'knows_basics',
  workoutFrequencyDays: 4,
  averageWorkoutLength: '45_60',
  selectedSplitPresetId: 'ppl',
  emailOptIn: true,
  pushNotificationsOptIn: false,
  hasTrainerCode: false,
  pendingUsername: 'harbirb',
  pendingDisplayName: 'Harbir Bains',
};

describe('isStepAnswered / computeStartStepIndex', () => {
  // height/birthday are wheel pickers -- they always show *some* value, so
  // EMPTY_DRAFT pre-fills them with that same default rather than null (see
  // EMPTY_DRAFT's own comment); every other step, the typed weight included,
  // genuinely starts unanswered.
  const PREFILLED_STEPS = new Set(['height', 'birthday']);

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
    expect(isStepAnswered('weight', draft)).toBe(false);
    expect(computeStartStepIndex(draft)).toBe(STEP_ORDER.indexOf('weight'));
  });

  it('treats workoutSplit as answered when the user chose to create their own instead of a preset', () => {
    const draft: OnboardingDraft = {
      ...EMPTY_DRAFT,
      selectedSplitPresetId: null,
      wantsCustomSplit: true,
    };

    expect(isStepAnswered('workoutSplit', draft)).toBe(true);
  });

  it('treats workoutSplit as answered when the user skipped it for now', () => {
    expect(isStepAnswered('workoutSplit', { ...EMPTY_DRAFT, skippedSplit: true })).toBe(true);
    expect(isStepAnswered('workoutSplit', EMPTY_DRAFT)).toBe(false);
  });

  it('asks for daily targets only with Nutrition in the membership, and about Apple Health only where it is', () => {
    const none = { healthAvailable: false };
    expect(stepApplies('activityLevel', { ...FULL_DRAFT, membershipTier: 'workouts' }, none)).toBe(
      false,
    );
    expect(stepApplies('nutritionTargets', FULL_DRAFT, none)).toBe(true);
    expect(stepApplies('appleHealth', FULL_DRAFT, none)).toBe(false);
    expect(stepApplies('appleHealth', FULL_DRAFT, { healthAvailable: true })).toBe(true);
    // From membership with Workouts alone: past both Nutrition steps, to the split.
    expect(
      nextStepIndex(
        STEP_ORDER.indexOf('membership'),
        1,
        { ...FULL_DRAFT, membershipTier: 'workouts' },
        none,
      ),
    ).toBe(STEP_ORDER.indexOf('workoutSplit'));
    // And back again.
    expect(
      nextStepIndex(
        STEP_ORDER.indexOf('workoutSplit'),
        -1,
        { ...FULL_DRAFT, membershipTier: 'workouts' },
        none,
      ),
    ).toBe(STEP_ORDER.indexOf('membership'));
  });

  it('only takes a birthday 13 years ago or more', () => {
    const now = new Date(2026, 10, 15);
    expect(isOldEnough('2013-11-15', now)).toBe(true);
    expect(isOldEnough('2013-11-16', now)).toBe(false);
    expect(isStepAnswered('birthday', { ...EMPTY_DRAFT, birthday: '2020-01-01' })).toBe(false);
  });

  it('createAccount is never "answered" -- it is always the resume target once every question is done', () => {
    expect(isStepAnswered('createAccount', FULL_DRAFT)).toBe(false);
    expect(computeStartStepIndex(FULL_DRAFT)).toBe(STEP_ORDER.indexOf('createAccount'));
    expect(STEP_ORDER[STEP_ORDER.length - 1]).toBe('createAccount');
  });
});

describe("submitOnboardingDraft -- a trainer's code", () => {
  it('claims the history the trainer logged once the account exists', async () => {
    jest.mocked(claimTrainerHistory).mockResolvedValue({ workouts: 12 });

    await submitOnboardingDraft('token-123', 'user-1', {
      ...FULL_DRAFT,
      hasTrainerCode: true,
      trainerCode: 'ABCD-2345',
    });

    expect(mockUpdateMyProfile).toHaveBeenCalled();
    expect(claimTrainerHistory).toHaveBeenCalledWith('token-123', 'ABCD-2345');
  });

  it("doesn't fail sign-up when the code doesn't work, and says where to try again", async () => {
    jest.mocked(claimTrainerHistory).mockRejectedValue(new Error('That code has expired.'));
    const alert = jest.spyOn(Alert, 'alert').mockImplementation(() => undefined);

    await expect(
      submitOnboardingDraft('token-123', 'user-1', {
        ...FULL_DRAFT,
        hasTrainerCode: true,
        trainerCode: 'ABCD-2345',
      }),
    ).resolves.toEqual({ id: 'user-1' });

    expect(alert).toHaveBeenCalledWith(
      "Your trainer's code didn't work",
      expect.stringContaining('That code has expired.'),
    );
    expect(alert.mock.calls[0][1]).toContain('Settings > Trainer Code');
    alert.mockRestore();
  });

  it('claims nothing without a code', async () => {
    jest.mocked(claimTrainerHistory).mockClear();
    await submitOnboardingDraft('token-123', 'user-1', FULL_DRAFT);
    expect(claimTrainerHistory).not.toHaveBeenCalled();
  });

  it('only takes a code that looks like one', () => {
    const withCode = (trainerCode: string) =>
      isStepAnswered('trainerCode', { ...EMPTY_DRAFT, hasTrainerCode: true, trainerCode });
    expect(withCode('ABCD-2345')).toBe(true);
    expect(withCode('ABC')).toBe(false);
    expect(isStepAnswered('trainerCode', { ...EMPTY_DRAFT, hasTrainerCode: false })).toBe(true);
    expect(isStepAnswered('trainerCode', EMPTY_DRAFT)).toBe(false);
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
        fitnessGoals: ['build_muscle'],
        membershipTier: 'everything',
        trainingComfort: 'knows_basics',
        repRangeMin: 8,
        repRangeMax: 12,
        workoutFrequencyDays: 4,
        averageWorkoutLength: '45_60',
        activeWorkoutSplitId: 'split-new',
        emailOptIn: true,
        pushNotificationsOptIn: false,
        username: 'harbirb',
        displayName: 'Harbir Bains',
        onboardingCompleted: true,
      }),
    );
    // Onboarding no longer asks about Apple Health; there is no HealthKit integration.
    expect(mockUpdateMyProfile.mock.calls[0][1]).not.toHaveProperty('appleHealthPreference');
    // Nor the two questions the comfort question replaced.
    expect(mockUpdateMyProfile.mock.calls[0][1]).not.toHaveProperty('trainingExperience');
    expect(mockUpdateMyProfile.mock.calls[0][1]).not.toHaveProperty('trainingStylePreference');
  });

  it('saves the daily targets chosen as their nutrition goals, and how active they are', async () => {
    await submitOnboardingDraft('token-123', 'user-1', FULL_DRAFT);

    expect(saveNutritionGoals).toHaveBeenCalledWith('user-1', {
      calories: 2400,
      proteinG: 141,
      carbsG: 290,
      fatG: 52,
    });
    expect(mockUpdateMyProfile).toHaveBeenCalledWith(
      'token-123',
      expect.objectContaining({ activityLevel: 'moderately_active' }),
    );
  });

  it('saves no targets without Nutrition in the membership', async () => {
    await submitOnboardingDraft('token-123', 'user-1', {
      ...FULL_DRAFT,
      membershipTier: 'workouts',
    });

    expect(saveNutritionGoals).not.toHaveBeenCalled();
  });

  it('starts an experienced lifter on a 5-10 rep range', async () => {
    await submitOnboardingDraft('token-123', 'user-1', {
      ...FULL_DRAFT,
      trainingComfort: 'follows_method',
    });

    expect(mockUpdateMyProfile).toHaveBeenCalledWith(
      'token-123',
      expect.objectContaining({
        trainingComfort: 'follows_method',
        repRangeMin: 5,
        repRangeMax: 10,
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

  it('registers this device for push once the account exists, when notifications were allowed', async () => {
    await submitOnboardingDraft('token-123', 'user-1', {
      ...FULL_DRAFT,
      pushNotificationsOptIn: true,
    });

    expect(mockRegisterPushToken).toHaveBeenCalledWith(
      'token-123',
      'ExponentPushToken[test]',
      'ios',
    );
    // The profile is saved first; the device registration needs the new account.
    expect(mockUpdateMyProfile.mock.invocationCallOrder[0]).toBeLessThan(
      mockRegisterPushToken.mock.invocationCallOrder[0],
    );
  });

  it('registers nothing when notifications were declined or skipped', async () => {
    await submitOnboardingDraft('token-123', 'user-1', FULL_DRAFT);
    await submitOnboardingDraft('token-123', 'user-1', {
      ...FULL_DRAFT,
      pushNotificationsOptIn: null,
    });

    expect(mockRequestPushToken).not.toHaveBeenCalled();
    expect(mockRegisterPushToken).not.toHaveBeenCalled();
  });

  it('skips registration when no token is available, such as on Android', async () => {
    mockRequestPushToken.mockResolvedValue(null);

    await submitOnboardingDraft('token-123', 'user-1', {
      ...FULL_DRAFT,
      pushNotificationsOptIn: true,
    });

    expect(mockRegisterPushToken).not.toHaveBeenCalled();
  });

  it('still finishes onboarding when the device registration fails', async () => {
    mockRegisterPushToken.mockRejectedValue(new Error('network down'));

    await expect(
      submitOnboardingDraft('token-123', 'user-1', { ...FULL_DRAFT, pushNotificationsOptIn: true }),
    ).resolves.toEqual({ id: 'user-1' });
    expect(mockUpdateMyProfile).toHaveBeenCalledTimes(1);
  });
});

describe('onboarding in named parts', () => {
  it('puts every step in exactly one part, in the same order as the steps', () => {
    const inParts = STEP_SECTIONS.flatMap((part) => part.steps);
    expect(inParts).toEqual([...STEP_ORDER]);
  });

  it('says where a step sits among the steps asked, by part', () => {
    const asked = stepsAsked(
      { ...EMPTY_DRAFT, membershipTier: 'workouts' },
      { healthAvailable: false },
    );
    // Without Nutrition, Your Plan is the membership, the split and ranks.
    expect(stepPlace('workoutSplit', asked)).toEqual({
      section: 'Your Plan',
      stepInSection: 2,
      stepsInSection: 3,
      progress: [
        { steps: 6, done: 6 },
        { steps: 4, done: 4 },
        { steps: 3, done: 2 },
        { steps: 2, done: 0 },
        { steps: 2, done: 0 },
      ],
    });
    expect(stepPlace('referralSource', asked)).toMatchObject({
      section: 'About You',
      stepInSection: 1,
      stepsInSection: 6,
    });
  });
});

describe('submitOnboardingDraft -- Build My Own Split', () => {
  it('has the split builder open as the app shows, only when building their own was chosen', async () => {
    takeCustomSplitBuilder();
    await submitOnboardingDraft('token-123', 'user-1', {
      ...EMPTY_DRAFT,
      wantsCustomSplit: true,
      selectedSplitPresetId: null,
    });
    expect(takeCustomSplitBuilder()).toBe(true);
    // Once.
    expect(takeCustomSplitBuilder()).toBe(false);

    await submitOnboardingDraft('token-123', 'user-1', { ...EMPTY_DRAFT, skippedSplit: true });
    expect(takeCustomSplitBuilder()).toBe(false);
  });
});
