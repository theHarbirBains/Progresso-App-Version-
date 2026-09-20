import type { ProfileResponse } from '../lib/api';
import { computeStartStepIndex, isStepAnswered, STEP_ORDER } from './onboardingSteps';

function baseProfile(overrides: Partial<ProfileResponse> = {}): ProfileResponse {
  return {
    id: 'user-1',
    email: 'a@example.com',
    role: 'user',
    displayName: null,
    username: null,
    weightUnit: 'kg',
    workoutAccentColor: null,
    nutritionAccentColor: null,
    backgroundTheme: null,
    avatarUrl: null,
    activeWorkoutSplitId: null,
    gender: null,
    birthday: null,
    weightValue: null,
    heightValue: null,
    heightUnit: 'cm',
    fitnessGoal: null,
    trainingExperience: null,
    workoutFrequencyDays: null,
    trainingStylePreference: null,
    emailOptIn: null,
    pushNotificationsOptIn: null,
    appleHealthPreference: null,
    onboardingCompletedAt: null,
    activityLevel: null,
    ...overrides,
  };
}

describe('isStepAnswered', () => {
  it('is false for every step on a completely blank profile', () => {
    const profile = baseProfile();
    for (const step of STEP_ORDER) {
      if (step === 'completion') continue;
      expect(isStepAnswered(step, profile)).toBe(false);
    }
  });

  it('is true once the corresponding field is set', () => {
    expect(isStepAnswered('gender', baseProfile({ gender: 'other' }))).toBe(true);
    expect(isStepAnswered('birthday', baseProfile({ birthday: '2001-09-14' }))).toBe(true);
    expect(isStepAnswered('weight', baseProfile({ weightValue: 79.2 }))).toBe(true);
    expect(isStepAnswered('height', baseProfile({ heightValue: 174 }))).toBe(true);
    expect(isStepAnswered('workoutSplit', baseProfile({ activeWorkoutSplitId: 'split-1' }))).toBe(
      true,
    );
  });

  it('treats an explicit false boolean as answered, not unanswered', () => {
    expect(isStepAnswered('emailPreference', baseProfile({ emailOptIn: false }))).toBe(true);
    expect(
      isStepAnswered('pushNotifications', baseProfile({ pushNotificationsOptIn: false })),
    ).toBe(true);
  });

  it('the completion step is never considered answered', () => {
    const fullyAnswered = baseProfile({
      gender: 'other',
      birthday: '2001-09-14',
      weightValue: 79.2,
      heightValue: 174,
      fitnessGoal: 'build_muscle',
      trainingExperience: 'intermediate',
      workoutFrequencyDays: 4,
      trainingStylePreference: 'build_your_own',
      activeWorkoutSplitId: 'split-1',
      emailOptIn: true,
      pushNotificationsOptIn: true,
      appleHealthPreference: 'connected',
    });
    expect(isStepAnswered('completion', fullyAnswered)).toBe(false);
  });
});

describe('computeStartStepIndex', () => {
  it('starts at the first step on a blank profile', () => {
    expect(computeStartStepIndex(baseProfile())).toBe(0);
    expect(STEP_ORDER[computeStartStepIndex(baseProfile())]).toBe('appleHealth');
  });

  it('resumes at the first unanswered step after a partial onboarding', () => {
    const profile = baseProfile({
      appleHealthPreference: 'not_now',
      gender: 'male',
      birthday: '1998-01-01',
    });
    expect(STEP_ORDER[computeStartStepIndex(profile)]).toBe('weight');
  });

  it('lands on the completion step once every other step is answered', () => {
    const profile = baseProfile({
      appleHealthPreference: 'not_now',
      gender: 'male',
      birthday: '1998-01-01',
      weightValue: 80,
      heightValue: 180,
      fitnessGoal: 'get_stronger',
      trainingExperience: 'advanced',
      workoutFrequencyDays: 5,
      trainingStylePreference: 'guided',
      activeWorkoutSplitId: 'split-1',
      emailOptIn: false,
      pushNotificationsOptIn: false,
    });
    expect(STEP_ORDER[computeStartStepIndex(profile)]).toBe('completion');
  });
});
