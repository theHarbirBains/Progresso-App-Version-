import { Alert } from 'react-native';
import { claimTrainerHistory, registerPushToken, updateMyProfile } from '../lib/api';
import { requestPushToken } from '../lib/pushNotifications';
import { materializeWorkoutSplitPreset } from '../workouts/workoutSplitQueries';
import { saveNutritionGoals } from '../nutrition/nutritionGoalQueries';
import {
  computeStartStepIndex,
  draftPreferences,
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
// Using a workout program makes a split through Supabase (its own tests are in
// programs/programActivation.test.ts).
jest.mock('../programs/programActivation', () => ({ activateProgram: jest.fn() }));
// A made-up program in place of the catalogue, which is empty until the programs are written.
jest.mock('../programs/programCatalog', () => ({
  PROGRAM_CATALOG: jest.requireActual('../programs/programCatalog').PROGRAM_CATALOG,
  WORKOUT_PROGRAMS: [jest.requireActual('../programs/__fixtures__/programs').TEST_PROGRAM],
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
  trainingPriorities: ['glutes', 'back'],
  equipmentAccess: 'dumbbells',
  trainingExclusions: ['chest'],
  membershipTier: 'everything',
  activityLevel: 'moderately_active',
  nutritionTargets: { calories: 2400, proteinG: 141, carbsG: 290, fatG: 52 },
  ranksSeen: true,
  summarySeen: true,
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
    const none = { healthAvailable: false, locationAvailable: false };
    expect(stepApplies('activityLevel', { ...FULL_DRAFT, membershipTier: 'workouts' }, none)).toBe(
      false,
    );
    expect(stepApplies('nutritionTargets', FULL_DRAFT, none)).toBe(true);
    expect(stepApplies('appleHealth', FULL_DRAFT, none)).toBe(false);
    expect(
      stepApplies('appleHealth', FULL_DRAFT, { healthAvailable: true, locationAvailable: false }),
    ).toBe(true);
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
        trainingPriorities: ['glutes', 'back'],
        equipmentAccess: 'dumbbells',
        trainingExclusions: ['chest'],
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

describe('the questions programs are recommended from', () => {
  it('is answered by an answer, or by Skip for now -- Train Everything is an answer too', () => {
    expect(isStepAnswered('trainingPriorities', EMPTY_DRAFT)).toBe(false);
    expect(
      isStepAnswered('trainingPriorities', { ...EMPTY_DRAFT, trainingPriorities: ['core'] }),
    ).toBe(true);
    expect(isStepAnswered('trainingPriorities', { ...EMPTY_DRAFT, prioritiesSkipped: true })).toBe(
      true,
    );
    expect(
      isStepAnswered('equipmentAccess', { ...EMPTY_DRAFT, equipmentAccess: 'bodyweight' }),
    ).toBe(true);
    expect(isStepAnswered('equipmentAccess', { ...EMPTY_DRAFT, equipmentSkipped: true })).toBe(
      true,
    );
    expect(isStepAnswered('trainingExclusions', EMPTY_DRAFT)).toBe(false);
    expect(isStepAnswered('trainingExclusions', { ...EMPTY_DRAFT, trainingExclusions: [] })).toBe(
      true,
    );
    expect(isStepAnswered('trainingExclusions', { ...EMPTY_DRAFT, exclusionsSkipped: true })).toBe(
      true,
    );
  });

  it('saves nothing for one skipped, and never leaves out what is put first', async () => {
    mockUpdateMyProfile.mockClear();
    await submitOnboardingDraft('token-123', 'user-1', {
      ...FULL_DRAFT,
      trainingPriorities: [],
      prioritiesSkipped: true,
      equipmentAccess: null,
      equipmentSkipped: true,
      trainingExclusions: [],
    });
    const sent = mockUpdateMyProfile.mock.calls[0][1];
    expect(sent).not.toHaveProperty('trainingPriorities');
    expect(sent).not.toHaveProperty('equipmentAccess');
    expect(sent).not.toHaveProperty('trainingExclusions');

    mockUpdateMyProfile.mockClear();
    await submitOnboardingDraft('token-123', 'user-1', {
      ...FULL_DRAFT,
      trainingPriorities: ['glutes'],
      trainingExclusions: ['chest', 'glutes'],
    });
    expect(mockUpdateMyProfile.mock.calls[0][1].trainingExclusions).toEqual(['chest']);
  });

  it('recommends from the answers so far', () => {
    expect(draftPreferences(FULL_DRAFT)).toEqual({
      daysPerWeek: 4,
      level: 'beginner',
      goals: ['build_muscle'],
      priorities: ['glutes', 'back'],
      equipment: 'dumbbells',
      exclusions: ['chest'],
      sessionMinutes: { min: 45, max: 60 },
    });
    expect(draftPreferences(EMPTY_DRAFT).exclusions).toEqual([]);
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
      { healthAvailable: false, locationAvailable: false },
    );
    // Without Nutrition, Your Plan is the membership, the split and ranks.
    expect(stepPlace('workoutSplit', asked)).toEqual({
      section: 'Your Plan',
      stepInSection: 2,
      stepsInSection: 3,
      progress: [
        { steps: 6, done: 6 },
        // Goals, priorities, experience, days, length, where they train, what to leave out.
        { steps: 7, done: 7 },
        { steps: 3, done: 2 },
        { steps: 2, done: 0 },
        // The trainer's code, Your plan is ready, and Create your account.
        { steps: 3, done: 0 },
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

describe('Find your country and Your plan is ready', () => {
  it('asks where the phone is only where it can, before the country list', () => {
    const can = { healthAvailable: false, locationAvailable: true };
    const cannot = { healthAvailable: false, locationAvailable: false };
    expect(stepApplies('location', EMPTY_DRAFT, can)).toBe(true);
    expect(stepApplies('location', EMPTY_DRAFT, cannot)).toBe(false);
    expect(STEP_ORDER.indexOf('location')).toBe(STEP_ORDER.indexOf('country') - 1);
    expect(isStepAnswered('location', EMPTY_DRAFT)).toBe(false);
    expect(isStepAnswered('location', { ...EMPTY_DRAFT, locationAsked: false })).toBe(true);
  });

  it('asks the sex again when a draft from before saved another answer', () => {
    expect(isStepAnswered('gender', { ...EMPTY_DRAFT, gender: 'female' })).toBe(true);
    expect(isStepAnswered('gender', { ...EMPTY_DRAFT, gender: 'other' })).toBe(false);
  });

  it('shows the plan once, just before the account is made', () => {
    expect(STEP_ORDER.indexOf('summary')).toBe(STEP_ORDER.indexOf('createAccount') - 1);
    expect(computeStartStepIndex({ ...FULL_DRAFT, summarySeen: false })).toBe(
      STEP_ORDER.indexOf('summary'),
    );
  });
});

describe('submitOnboardingDraft -- a workout program', () => {
  it('makes the program chosen their active split, in place of a preset', async () => {
    const { activateProgram } = jest.requireMock('../programs/programActivation') as {
      activateProgram: jest.Mock;
    };
    activateProgram.mockReset().mockResolvedValue({ id: 'split-program', name: 'Test Split' });

    await submitOnboardingDraft('token-123', 'user-1', {
      ...EMPTY_DRAFT,
      selectedProgram: { programId: 'test-split', variationId: 'six' },
    });

    expect(activateProgram).toHaveBeenCalledWith(
      'user-1',
      expect.objectContaining({ id: 'test-split' }),
      expect.objectContaining({ id: 'six' }),
    );
    expect(mockUpdateMyProfile).toHaveBeenCalledWith(
      'token-123',
      expect.objectContaining({ activeWorkoutSplitId: 'split-program', onboardingCompleted: true }),
    );
  });

  it("never fails sign-up when the program can't be set up: it says where to choose it again", async () => {
    const { activateProgram } = jest.requireMock('../programs/programActivation') as {
      activateProgram: jest.Mock;
    };
    activateProgram.mockReset().mockRejectedValue(new Error('offline'));
    const alert = jest.spyOn(Alert, 'alert').mockImplementation(() => undefined);

    await submitOnboardingDraft('token-123', 'user-1', {
      ...EMPTY_DRAFT,
      selectedProgram: { programId: 'test-split', variationId: 'three-balanced' },
    });

    expect(alert).toHaveBeenCalledWith(
      "Your program couldn't be set up",
      expect.stringMatching(/Workout Splits > Workout Programs/),
    );
    expect(mockUpdateMyProfile.mock.calls[0][1]).not.toHaveProperty('activeWorkoutSplitId');
    alert.mockRestore();
  });

  it('counts a program chosen as the split question answered', () => {
    expect(
      isStepAnswered('workoutSplit', {
        ...EMPTY_DRAFT,
        selectedProgram: { programId: 'test-split', variationId: 'six' },
      }),
    ).toBe(true);
  });
});
