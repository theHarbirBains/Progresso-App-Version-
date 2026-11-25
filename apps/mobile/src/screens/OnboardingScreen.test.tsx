import AsyncStorage from '@react-native-async-storage/async-storage';
import { FlatList, KeyboardAvoidingView, Platform } from 'react-native';
import { act, fireEvent, render, screen, waitFor } from '@testing-library/react-native';
import { useAuth } from '../auth/AuthProvider';
import { socialSignInEnabled } from '../auth/socialSignIn';
import { updateMyProfile } from '../lib/api';
import { requestNotificationPermission } from '../lib/pushNotifications';
import { askForSteps, stepsAccess } from '../health/steps';
import { openLegalPage } from '../lib/legalLinks';
import { saveNutritionGoals } from '../nutrition/nutritionGoalQueries';
import {
  EMPTY_DRAFT,
  STEP_ORDER,
  type OnboardingDraft,
  type OnboardingStep,
} from '../onboarding/onboardingDraft';
import { getWelcomeStage, setWelcomeStage } from '../onboarding/welcomeStage';
import { countryFromLocation, locationAvailable } from '../onboarding/countryFromLocation';
import { materializeWorkoutSplitPreset } from '../workouts/workoutSplitQueries';
import { OnboardingScreen } from './OnboardingScreen';

// The theme provider reads the profile's country (for the seasons); before sign-in there's none.
jest.mock('../profile/ProfileProvider', () => ({ useProfile: () => ({ profile: null }) }));

jest.mock('../auth/AuthProvider', () => ({
  useAuth: jest.fn(),
}));

// Google is off for now (auth/socialSignIn.ts); its tests here turn it on.
jest.mock('../auth/socialSignIn', () => ({ socialSignInEnabled: jest.fn() }));

jest.mock('../lib/api', () => ({
  updateMyProfile: jest.fn(),
}));

jest.mock('../lib/pushNotifications', () => ({
  requestNotificationPermission: jest.fn(),
  requestPushToken: jest.fn(),
}));

// Apple Health isn't here unless a test says so (its own tests, below).
jest.mock('../health/steps', () => ({
  stepsAccess: jest.fn(),
  askForSteps: jest.fn(),
}));
jest.mock('../nutrition/nutritionGoalQueries', () => ({
  saveNutritionGoals: jest.fn(),
}));
jest.mock('../lib/legalLinks', () => ({ openLegalPage: jest.fn() }));

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

// "Let's get you started!" opens straight onto the first question here (its own tests are in
// onboarding/GetStartedIntro.test.tsx).
jest.mock('../onboarding/GetStartedIntro', () => {
  const { useEffect } = jest.requireActual('react');
  return {
    GetStartedIntro: ({ onReveal, onFinish }: { onReveal: () => void; onFinish: () => void }) => {
      useEffect(() => {
        onReveal();
        onFinish();
        // Once, as it opens -- like the real one.
        // eslint-disable-next-line react-hooks/exhaustive-deps
      }, []);
      return null;
    },
  };
});

// Location isn't here unless a test says so (Find your country's own tests, below).
jest.mock('../onboarding/countryFromLocation', () => ({
  locationAvailable: jest.fn(() => false),
  countryFromLocation: jest.fn(),
}));

const mockUseAuth = useAuth as jest.Mock;
const mockSignUpWithPassword = jest.fn();
const mockSignInWithProvider = jest.fn();
const mockUpdateMyProfile = updateMyProfile as jest.Mock;
const mockRequestNotificationPermission = requestNotificationPermission as jest.Mock;
const mockMaterialize = materializeWorkoutSplitPreset as jest.Mock;
const mockSwitchToSignIn = jest.fn();

beforeEach(async () => {
  await AsyncStorage.clear();
  jest.mocked(socialSignInEnabled).mockReset().mockReturnValue(true);
  mockUseAuth.mockReturnValue({
    signUpWithPassword: mockSignUpWithPassword,
    signInWithProvider: mockSignInWithProvider,
  });
  mockSignUpWithPassword.mockReset().mockResolvedValue({
    error: null,
    requiresEmailConfirmation: false,
    accessToken: 'token-123',
    userId: 'user-1',
  });
  mockSignInWithProvider.mockReset().mockResolvedValue(null);
  mockUpdateMyProfile.mockReset().mockResolvedValue({ id: 'user-1' });
  mockRequestNotificationPermission.mockReset().mockResolvedValue(true);
  mockMaterialize.mockReset().mockResolvedValue({ id: 'split-new', name: 'Push / Pull / Legs' });
  jest.mocked(stepsAccess).mockReset().mockResolvedValue('unavailable');
  jest.mocked(locationAvailable).mockReset().mockReturnValue(false);
  jest.mocked(countryFromLocation).mockReset();
  jest.mocked(askForSteps).mockReset().mockResolvedValue(undefined);
  jest.mocked(saveNutritionGoals).mockReset().mockResolvedValue({
    calories: 2000,
    proteinG: 140,
    carbsG: 200,
    fatG: 52,
  });
  setWelcomeStage('none');
  mockSwitchToSignIn.mockClear();
});

function renderScreen() {
  return render(<OnboardingScreen onSwitchToSignIn={mockSwitchToSignIn} />);
}

async function settle() {
  await act(async () => {
    await new Promise((resolve) => setTimeout(resolve, 0));
  });
}

describe('OnboardingScreen', () => {
  it('starts at the referral-source step for a brand-new draft', async () => {
    renderScreen();

    expect(await screen.findByTestId('onboarding-step-referral-source')).toBeTruthy();
    expect(screen.queryByTestId('onboarding-back')).toBeNull();
  });

  it('offers a Sign In link only on the first step', async () => {
    renderScreen();
    await screen.findByTestId('onboarding-step-referral-source');

    fireEvent.press(screen.getByTestId('onboarding-switch-to-sign-in'));
    expect(mockSwitchToSignIn).toHaveBeenCalled();

    fireEvent.press(screen.getByTestId('onboarding-referral-source-tiktok'));

    expect(await screen.findByTestId('onboarding-step-country')).toBeTruthy();
    expect(screen.queryByTestId('onboarding-switch-to-sign-in')).toBeNull();
  });

  it('resumes at the first unanswered step for a partially-completed draft', async () => {
    await AsyncStorage.setItem(
      '@progresso/onboardingDraft',
      JSON.stringify({
        stepIndex: 2,
        draft: { referralSource: 'tiktok', country: 'CA', gender: null },
      }),
    );

    renderScreen();

    expect(await screen.findByTestId('onboarding-step-gender')).toBeTruthy();
  });

  it('does not nest the country list or a wheel picker inside the outer ScrollView', async () => {
    renderScreen();
    await screen.findByTestId('onboarding-step-referral-source');

    fireEvent.press(screen.getByTestId('onboarding-referral-source-tiktok'));
    expect(await screen.findByTestId('onboarding-step-country')).toBeTruthy();
    expect(screen.queryByTestId('onboarding-scroll')).toBeNull();
  });

  it('keeps the outer ScrollView for a plain option-list step', async () => {
    renderScreen();
    expect(await screen.findByTestId('onboarding-scroll')).toBeTruthy();
  });

  // Regression guard: with no KeyboardAvoidingView, the keyboard covered
  // the lower half of a text-heavy step (create account) with no way to
  // scroll the covered content -- e.g. never reaching "Create Account"
  // itself once the keyboard was up.
  it('wraps the scrolling body in a KeyboardAvoidingView with a platform-appropriate behavior', async () => {
    renderScreen();
    await screen.findByTestId('onboarding-scroll');

    const avoider = screen.UNSAFE_getByType(KeyboardAvoidingView);
    expect(avoider.props.behavior).toBe(Platform.OS === 'ios' ? 'padding' : undefined);
  });

  it('Back moves to the previous step', async () => {
    renderScreen();
    await screen.findByTestId('onboarding-step-referral-source');
    fireEvent.press(screen.getByTestId('onboarding-referral-source-tiktok'));
    await screen.findByTestId('onboarding-step-country');

    fireEvent.press(screen.getByTestId('onboarding-back'));

    expect(await screen.findByTestId('onboarding-step-referral-source')).toBeTruthy();
  });

  it('moves on by itself once an answer is tapped, showing it as chosen first', async () => {
    renderScreen();
    await screen.findByTestId('onboarding-step-referral-source');

    fireEvent.press(screen.getByTestId('onboarding-referral-source-tiktok'));

    // Still here a moment, the answer ticked...
    expect(screen.getByTestId('onboarding-step-referral-source')).toBeTruthy();
    expect(
      screen.getByTestId('onboarding-referral-source-tiktok').props.accessibilityState,
    ).toMatchObject({ selected: true });
    expect(screen.queryByTestId('onboarding-continue')).toBeNull();
    // ...then the next question.
    expect(await screen.findByTestId('onboarding-step-country')).toBeTruthy();
  });

  it('stays back when Back is pressed straight after an answer is tapped', async () => {
    await AsyncStorage.setItem(
      '@progresso/onboardingDraft',
      JSON.stringify({ stepIndex: 1, draft: { referralSource: 'tiktok' } }),
    );
    renderScreen();
    await screen.findByTestId('onboarding-step-country');

    fireEvent.changeText(screen.getByTestId('onboarding-step-country-search'), 'Canada');
    fireEvent.press(await screen.findByTestId('onboarding-step-country-option-CA'));
    fireEvent.press(screen.getByTestId('onboarding-back'));

    expect(await screen.findByTestId('onboarding-step-referral-source')).toBeTruthy();
    await act(async () => {
      await new Promise((resolve) => setTimeout(resolve, 400));
    });
    expect(screen.getByTestId('onboarding-step-referral-source')).toBeTruthy();
  });

  it('takes a typed weight, waiting for one in range before Continue', async () => {
    await AsyncStorage.setItem(
      '@progresso/onboardingDraft',
      JSON.stringify({
        stepIndex: STEP_ORDER.indexOf('weight'),
        draft: { referralSource: 'tiktok', country: 'CA', gender: 'male', weightUnit: 'lb' },
      }),
    );
    renderScreen();
    await screen.findByTestId('onboarding-step-weight');
    const continueButton = () => screen.getByTestId('onboarding-continue');
    const field = () => screen.getByTestId('onboarding-step-weight-input');

    // Empty to begin with.
    expect(field().props.value).toBe('');
    expect(continueButton().props.accessibilityState).toMatchObject({ disabled: true });

    fireEvent.changeText(field(), '20');
    expect(continueButton().props.accessibilityState).toMatchObject({ disabled: true });

    fireEvent.changeText(field(), '165');
    expect(continueButton().props.accessibilityState).toMatchObject({ disabled: false });

    // In kg it's shown converted, and the weight is unchanged.
    fireEvent.press(screen.getByTestId('onboarding-step-weight-unit-kg'));
    expect(field().props.value).toBe('74.8');
    expect(continueButton().props.accessibilityState).toMatchObject({ disabled: false });

    fireEvent.press(continueButton());
    expect(await screen.findByTestId('onboarding-step-height')).toBeTruthy();
  });

  it('offers the three memberships, moving on once one is tapped', async () => {
    await AsyncStorage.setItem(
      '@progresso/onboardingDraft',
      JSON.stringify({
        stepIndex: STEP_ORDER.indexOf('membership'),
        draft: {
          referralSource: 'tiktok',
          country: 'CA',
          gender: 'male',
          weightValue: 80,
          fitnessGoals: ['build_muscle'],
          trainingComfort: 'knows_basics',
          workoutFrequencyDays: 4,
          averageWorkoutLength: '45_60',
          trainingPriorities: ['glutes'],
          equipmentAccess: 'full_gym',
          trainingExclusions: [],
        },
      }),
    );
    renderScreen();
    await screen.findByTestId('onboarding-step-membership');

    // All three at once, each in a few short lines.
    expect(screen.getByTestId('onboarding-step-membership-card-workouts')).toHaveTextContent(
      /Workouts.*Free.*Workout plans and live tracking/,
    );
    expect(
      screen.getByTestId('onboarding-step-membership-card-workouts_nutrition'),
    ).toHaveTextContent(/Everything in Workouts.*Food logging and barcode scans/);
    expect(screen.getByTestId('onboarding-step-membership-card-everything')).toHaveTextContent(
      /Everything in Workouts \+ Nutrition.*A workspace for your clients/,
    );
    fireEvent.press(screen.getByTestId('onboarding-step-membership-workouts'));

    // No Nutrition in it, so no daily targets: on to the split, with no theme to pick.
    expect(await screen.findByTestId('onboarding-step-workout-split')).toBeTruthy();
    expect(screen.queryByText('Pick your look')).toBeNull();
    await waitFor(async () => {
      const stored = JSON.parse((await AsyncStorage.getItem('@progresso/onboardingDraft'))!);
      expect(stored.draft.membershipTier).toBe('workouts');
    });
  });

  it("takes a trainer's code, with Continue once it looks like one", async () => {
    await AsyncStorage.setItem(
      '@progresso/onboardingDraft',
      JSON.stringify({
        stepIndex: STEP_ORDER.indexOf('trainerCode'),
        draft: {
          referralSource: 'tiktok',
          country: 'CA',
          gender: 'male',
          weightValue: 80,
          fitnessGoals: ['build_muscle'],
          membershipTier: 'everything',
          ranksSeen: true,
          summarySeen: true,
          activityLevel: 'moderately_active',
          skippedNutritionTargets: true,
          trainingComfort: 'knows_basics',
          workoutFrequencyDays: 4,
          averageWorkoutLength: '45_60',
          trainingPriorities: ['glutes'],
          equipmentAccess: 'full_gym',
          trainingExclusions: [],
          selectedSplitPresetId: 'ppl',
          emailOptIn: true,
          pushNotificationsOptIn: false,
        },
      }),
    );
    renderScreen();
    await screen.findByTestId('onboarding-step-trainer-code');
    const continueButton = () => screen.getByTestId('onboarding-continue');

    expect(continueButton().props.accessibilityState).toMatchObject({ disabled: true });
    fireEvent.changeText(screen.getByTestId('onboarding-trainer-code-input'), 'ABC');
    expect(continueButton().props.accessibilityState).toMatchObject({ disabled: true });
    fireEvent.changeText(screen.getByTestId('onboarding-trainer-code-input'), 'ABCD-2345');
    expect(continueButton().props.accessibilityState).toMatchObject({ disabled: false });

    fireEvent.press(continueButton());
    // Then everything chosen, at a glance, before the account is made.
    expect(await screen.findByTestId('onboarding-step-summary')).toBeTruthy();
  });

  it('lets the workout split be skipped for now, setting up no split', async () => {
    await AsyncStorage.setItem(
      '@progresso/onboardingDraft',
      JSON.stringify({
        stepIndex: STEP_ORDER.indexOf('workoutSplit'),
        draft: {
          referralSource: 'tiktok',
          country: 'CA',
          gender: 'male',
          weightValue: 80,
          fitnessGoals: ['build_muscle'],
          membershipTier: 'everything',
          ranksSeen: true,
          summarySeen: true,
          activityLevel: 'moderately_active',
          skippedNutritionTargets: true,
          hasTrainerCode: false,
          trainingComfort: 'knows_basics',
          workoutFrequencyDays: 4,
          averageWorkoutLength: '45_60',
          trainingPriorities: ['glutes'],
          equipmentAccess: 'full_gym',
          trainingExclusions: [],
        },
      }),
    );
    renderScreen();
    await screen.findByTestId('onboarding-step-workout-split');

    fireEvent.press(screen.getByTestId('onboarding-skip-workout-split'));

    expect(await screen.findByTestId('onboarding-step-ranks')).toBeTruthy();
    await waitFor(async () => {
      const stored = JSON.parse((await AsyncStorage.getItem('@progresso/onboardingDraft'))!);
      expect(stored.draft).toMatchObject({
        skippedSplit: true,
        selectedSplitPresetId: null,
        wantsCustomSplit: false,
      });
    });
    expect(mockMaterialize).not.toHaveBeenCalled();
  });

  it('walks through the entire onboarding flow end-to-end, creating the account only at the very end', async () => {
    renderScreen();

    await screen.findByTestId('onboarding-step-referral-source');
    fireEvent.press(screen.getByTestId('onboarding-referral-source-tiktok'));

    await screen.findByTestId('onboarding-step-country');
    fireEvent.changeText(screen.getByTestId('onboarding-step-country-search'), 'Canada');
    fireEvent.press(await screen.findByTestId('onboarding-step-country-option-CA'));

    await screen.findByTestId('onboarding-step-gender');
    // Two answers, for the calorie estimate's formula.
    expect(screen.getByText('What is your sex?')).toBeTruthy();
    expect(screen.getByTestId('onboarding-gender-male')).toHaveTextContent(/Man/);
    expect(screen.getByTestId('onboarding-gender-female')).toHaveTextContent(/Woman/);
    expect(screen.queryByTestId('onboarding-gender-other')).toBeNull();
    fireEvent.press(screen.getByTestId('onboarding-gender-male'));

    await screen.findByTestId('onboarding-step-birthday');
    // The date and the age it makes sit together above the wheels, said once.
    expect(screen.getByTestId('onboarding-birthday-date')).toHaveTextContent(/^January 1, \d{4}$/);
    expect(screen.getByTestId('onboarding-birthday-age')).toHaveTextContent(/\d+ years old/);
    expect(screen.getAllByText(/^January 1, \d{4}$/)).toHaveLength(1);
    fireEvent.press(screen.getByTestId('onboarding-continue'));

    await screen.findByTestId('onboarding-step-weight');
    fireEvent.changeText(screen.getByTestId('onboarding-step-weight-input'), '176');
    fireEvent.press(screen.getByTestId('onboarding-continue'));

    await screen.findByTestId('onboarding-step-height');
    fireEvent.press(screen.getByTestId('onboarding-continue'));

    await screen.findByTestId('onboarding-step-fitness-goal');
    // Several goals can be picked, so this one takes Continue.
    fireEvent.press(screen.getByTestId('onboarding-step-fitness-goal-build_muscle'));
    fireEvent.press(screen.getByTestId('onboarding-step-fitness-goal-get_stronger'));
    fireEvent.press(screen.getByTestId('onboarding-continue'));

    // Up to three priorities, each on the figure; Balanced Development is an answer on its own.
    await screen.findByTestId('onboarding-step-training-priorities');
    expect(screen.getByText('What would you like to prioritize in the gym?')).toBeTruthy();
    expect(screen.getByText(/you'll still train everything/)).toBeTruthy();
    fireEvent.press(screen.getByTestId('onboarding-priority-glutes'));
    fireEvent.press(screen.getByTestId('onboarding-priority-back'));
    fireEvent.press(screen.getByTestId('onboarding-priority-arms'));
    expect(screen.getByTestId('onboarding-priority-core')).toBeDisabled();
    fireEvent.press(screen.getByTestId('onboarding-priority-arms'));
    expect(screen.getByTestId('onboarding-priority-core')).not.toBeDisabled();
    expect(screen.getByTestId('onboarding-skip-training-priorities')).toBeTruthy();
    fireEvent.press(screen.getByTestId('onboarding-continue'));

    await screen.findByTestId('onboarding-step-training-comfort');
    expect(
      screen.getByText('How confident are you in planning and progressing your workouts?'),
    ).toBeTruthy();
    expect(screen.getByText('Choose the option that best describes your experience.')).toBeTruthy();
    fireEvent.press(screen.getByTestId('onboarding-step-training-comfort-knows_basics'));

    await screen.findByTestId('onboarding-step-workout-frequency');
    fireEvent.press(screen.getByTestId('onboarding-frequency-4'));

    await screen.findByTestId('onboarding-step-average-workout-length');
    fireEvent.press(screen.getByTestId('onboarding-workout-length-45_60'));

    await screen.findByTestId('onboarding-step-equipment-access');
    expect(screen.getByText('Where do you train?')).toBeTruthy();
    fireEvent.press(screen.getByTestId('onboarding-equipment-full_gym'));

    // Glutes is a priority, so it can't be left out; Train Everything answers and moves on.
    await screen.findByTestId('onboarding-step-training-exclusions');
    expect(screen.getByTestId('onboarding-exclusion-glutes')).toBeDisabled();
    fireEvent.press(screen.getByTestId('onboarding-exclusion-none'));

    await screen.findByTestId('onboarding-step-membership');
    fireEvent.press(screen.getByTestId('onboarding-step-membership-workouts_nutrition'));

    // With Nutrition: how active, then the daily targets worked out from it.
    await screen.findByTestId('onboarding-step-activity-level');
    // Each level with about how many steps a day, and what a day like it looks like.
    expect(screen.getByTestId('onboarding-activity-moderately_active')).toHaveTextContent(
      /7,500-10,000 steps a day.*working out 3-5 days a week/,
    );
    fireEvent.press(screen.getByTestId('onboarding-activity-moderately_active'));
    await screen.findByTestId('onboarding-step-nutrition-targets');
    // 176 lb: 140 g protein, 52 g fat.
    expect(screen.getByTestId('onboarding-step-nutrition-targets-protein')).toHaveProp(
      'value',
      '140',
    );
    expect(screen.getByTestId('onboarding-step-nutrition-targets-fat')).toHaveProp('value', '52');
    fireEvent.press(screen.getByTestId('onboarding-step-nutrition-targets-use'));

    await screen.findByTestId('onboarding-step-workout-split');
    fireEvent.press(screen.getByTestId('onboarding-step-workout-split-preset-ppl'));

    // How ranks work, read and moved on from.
    await screen.findByTestId('onboarding-step-ranks');
    fireEvent.press(screen.getByTestId('onboarding-continue'));

    await screen.findByTestId('onboarding-step-email-preference');
    fireEvent.press(screen.getByTestId('onboarding-email-yes'));

    await screen.findByTestId('onboarding-step-push-notifications');
    fireEvent.press(screen.getByTestId('onboarding-step-push-notifications-skip'));

    await screen.findByTestId('onboarding-step-trainer-code');
    fireEvent.press(screen.getByTestId('onboarding-no-trainer-code'));

    // Everything chosen, at a glance.
    const summary = await screen.findByTestId('onboarding-step-summary');
    expect(summary).toHaveTextContent(/Build Muscle, Get Stronger/);
    expect(summary).toHaveTextContent(/4 days a week/);
    expect(summary).toHaveTextContent(/Push \/ Pull \/ Legs/);
    expect(summary).toHaveTextContent(/Workouts \+ Nutrition/);
    expect(summary).toHaveTextContent(/140 g protein/);
    fireEvent.press(screen.getByTestId('onboarding-continue'));

    await screen.findByTestId('onboarding-step-create-account');
    fireEvent.changeText(screen.getByTestId('onboarding-create-account-display-name'), 'Harbir');
    fireEvent.changeText(screen.getByTestId('onboarding-create-account-last-name'), 'Bains');
    fireEvent.changeText(screen.getByTestId('onboarding-create-account-username'), 'harbirb');
    fireEvent.changeText(
      screen.getByTestId('onboarding-create-account-email'),
      'harbir@example.com',
    );
    fireEvent.changeText(screen.getByTestId('onboarding-create-account-phone'), '604 555 1234');
    fireEvent.changeText(screen.getByTestId('onboarding-create-account-password'), 'password123');
    fireEvent.changeText(
      screen.getByTestId('onboarding-create-account-confirm-password'),
      'password123',
    );

    await act(async () => {
      fireEvent.press(screen.getByTestId('onboarding-create-account-submit'));
    });

    expect(mockSignUpWithPassword).toHaveBeenCalledWith('harbir@example.com', 'password123');
    expect(mockMaterialize).toHaveBeenCalledWith('user-1', expect.objectContaining({ id: 'ppl' }));
    await waitFor(() =>
      expect(mockUpdateMyProfile).toHaveBeenCalledWith(
        'token-123',
        expect.objectContaining({
          referralSource: 'tiktok',
          country: 'CA',
          gender: 'male',
          fitnessGoals: ['build_muscle', 'get_stronger'],
          membershipTier: 'workouts_nutrition',
          trainingComfort: 'knows_basics',
          repRangeMin: 8,
          repRangeMax: 12,
          workoutFrequencyDays: 4,
          averageWorkoutLength: '45_60',
          trainingPriorities: ['glutes', 'back'],
          equipmentAccess: 'full_gym',
          // 176 lb, typed.
          weightValue: expect.closeTo(79.83, 2),
          weightUnit: 'lb',
          activeWorkoutSplitId: 'split-new',
          emailOptIn: true,
          pushNotificationsOptIn: false,
          username: 'harbirb',
          displayName: 'Harbir',
          lastName: 'Bains',
          // Typed without its code, read as a Canadian number.
          phoneNumber: '+16045551234',
          onboardingCompleted: true,
        }),
      ),
    );
    // The daily targets, as their nutrition goals; how active they are, on their profile.
    expect(saveNutritionGoals).toHaveBeenCalledWith(
      'user-1',
      expect.objectContaining({ proteinG: 140, fatG: 52, calories: expect.any(Number) }),
    );
    expect(mockUpdateMyProfile).toHaveBeenCalledWith(
      'token-123',
      expect.objectContaining({ activityLevel: 'moderately_active' }),
    );
    expect(await AsyncStorage.getItem('@progresso/onboardingDraft')).toBeNull();
    // The app welcomes them once it's all saved.
    expect(getWelcomeStage()).toBe('welcome');
    await settle();
  });

  it('asks for a First Name and a Last Name, and needs both', async () => {
    await AsyncStorage.setItem(
      '@progresso/onboardingDraft',
      JSON.stringify({
        stepIndex: STEP_ORDER.indexOf('createAccount'),
        draft: {
          referralSource: 'tiktok',
          country: 'CA',
          gender: 'male',
          birthday: '2000-06-15',
          weightValue: 80,
          weightUnit: 'kg',
          heightValue: 180,
          heightUnit: 'cm',
          fitnessGoals: ['build_muscle'],
          membershipTier: 'everything',
          ranksSeen: true,
          summarySeen: true,
          activityLevel: 'moderately_active',
          skippedNutritionTargets: true,
          hasTrainerCode: false,
          trainingComfort: 'knows_basics',
          repRangeMin: 8,
          repRangeMax: 12,
          workoutFrequencyDays: 4,
          averageWorkoutLength: '45_60',
          trainingPriorities: ['glutes'],
          equipmentAccess: 'full_gym',
          trainingExclusions: [],
          selectedSplitPresetId: 'ppl',
          emailOptIn: true,
          pushNotificationsOptIn: false,
        },
      }),
    );

    renderScreen();
    await screen.findByTestId('onboarding-step-create-account');

    expect(
      screen.getByTestId('onboarding-create-account-display-name').props.accessibilityLabel,
    ).toBe('First Name');
    expect(screen.getByTestId('onboarding-create-account-last-name').props.accessibilityLabel).toBe(
      'Last Name',
    );
    expect(screen.queryByText('Display Name')).toBeNull();

    // Both are needed to create the account.
    fireEvent.changeText(screen.getByTestId('onboarding-create-account-display-name'), 'Harbir');
    fireEvent.changeText(screen.getByTestId('onboarding-create-account-username'), 'harbirb');
    fireEvent.changeText(
      screen.getByTestId('onboarding-create-account-email'),
      'harbir@example.com',
    );
    fireEvent.changeText(screen.getByTestId('onboarding-create-account-phone'), '604 555 1234');
    fireEvent.changeText(screen.getByTestId('onboarding-create-account-password'), 'password123');
    fireEvent.changeText(
      screen.getByTestId('onboarding-create-account-confirm-password'),
      'password123',
    );
    expect(screen.getByTestId('onboarding-create-account-submit')).toBeDisabled();

    fireEvent.changeText(screen.getByTestId('onboarding-create-account-last-name'), '   ');
    expect(screen.getByTestId('onboarding-create-account-submit')).toBeDisabled();

    fireEvent.changeText(screen.getByTestId('onboarding-create-account-last-name'), 'Bains');
    expect(screen.getByTestId('onboarding-create-account-submit')).toBeEnabled();

    // And a real phone number -- said once they leave the field.
    expect(screen.getByTestId('onboarding-create-account-phone').props.accessibilityLabel).toBe(
      'Phone Number',
    );
    fireEvent.changeText(screen.getByTestId('onboarding-create-account-phone'), '555 12');
    expect(screen.getByTestId('onboarding-create-account-submit')).toBeDisabled();
    expect(screen.queryByTestId('onboarding-create-account-phone-error')).toBeNull();
    fireEvent(screen.getByTestId('onboarding-create-account-phone'), 'blur');
    expect(screen.getByTestId('onboarding-create-account-phone-error')).toHaveTextContent(
      'Enter a valid phone number',
    );
    await settle();
  });

  it('keeps the draft on disk and shows a confirmation message when email confirmation is required', async () => {
    mockSignUpWithPassword.mockResolvedValue({
      error: null,
      requiresEmailConfirmation: true,
      accessToken: null,
      userId: 'user-1',
    });
    // Seed a fully-answered draft so this test starts right at
    // createAccount instead of re-walking every question -- it's only
    // exercising the confirmation branch, already covered end-to-end above.
    await AsyncStorage.setItem(
      '@progresso/onboardingDraft',
      JSON.stringify({
        stepIndex: STEP_ORDER.indexOf('createAccount'),
        draft: {
          referralSource: 'tiktok',
          country: 'CA',
          gender: 'male',
          birthday: '2000-06-15',
          weightValue: 80,
          weightUnit: 'kg',
          heightValue: 180,
          heightUnit: 'cm',
          fitnessGoals: ['build_muscle'],
          membershipTier: 'everything',
          ranksSeen: true,
          summarySeen: true,
          activityLevel: 'moderately_active',
          skippedNutritionTargets: true,
          hasTrainerCode: false,
          trainingComfort: 'knows_basics',
          repRangeMin: 8,
          repRangeMax: 12,
          workoutFrequencyDays: 4,
          averageWorkoutLength: '45_60',
          trainingPriorities: ['glutes'],
          equipmentAccess: 'full_gym',
          trainingExclusions: [],
          selectedSplitPresetId: 'ppl',
          emailOptIn: true,
          pushNotificationsOptIn: false,
        },
      }),
    );

    renderScreen();
    await screen.findByTestId('onboarding-step-create-account');
    fireEvent.changeText(screen.getByTestId('onboarding-create-account-display-name'), 'Harbir');
    fireEvent.changeText(screen.getByTestId('onboarding-create-account-last-name'), 'Bains');
    fireEvent.changeText(screen.getByTestId('onboarding-create-account-username'), 'harbirb');
    fireEvent.changeText(
      screen.getByTestId('onboarding-create-account-email'),
      'harbir@example.com',
    );
    fireEvent.changeText(screen.getByTestId('onboarding-create-account-phone'), '604 555 1234');
    fireEvent.changeText(screen.getByTestId('onboarding-create-account-password'), 'password123');
    fireEvent.changeText(
      screen.getByTestId('onboarding-create-account-confirm-password'),
      'password123',
    );

    await act(async () => {
      fireEvent.press(screen.getByTestId('onboarding-create-account-submit'));
    });

    expect(
      await screen.findByTestId('onboarding-step-create-account-confirmation'),
    ).toHaveTextContent(/harbir@example\.com/);
    expect(mockUpdateMyProfile).not.toHaveBeenCalled();
    expect(mockMaterialize).not.toHaveBeenCalled();
    // The draft (now including pendingUsername/pendingDisplayName) stays on
    // disk -- App.tsx's Root finishes this once a real session appears.
    const stored = await AsyncStorage.getItem('@progresso/onboardingDraft');
    expect(stored).not.toBeNull();
    expect(JSON.parse(stored as string).draft.pendingUsername).toBe('harbirb');

    fireEvent.press(screen.getByTestId('onboarding-create-account-back-to-sign-in'));
    expect(mockSwitchToSignIn).toHaveBeenCalled();
    await settle();
  });

  it('lets the user choose "Create Your Own" instead of a preset, and skips materializing a split', async () => {
    await AsyncStorage.setItem(
      '@progresso/onboardingDraft',
      JSON.stringify({
        stepIndex: STEP_ORDER.indexOf('workoutSplit'),
        draft: {
          referralSource: 'tiktok',
          country: 'CA',
          gender: 'male',
          birthday: '2000-06-15',
          weightValue: 80,
          weightUnit: 'kg',
          heightValue: 180,
          heightUnit: 'cm',
          fitnessGoals: ['build_muscle'],
          membershipTier: 'everything',
          ranksSeen: true,
          summarySeen: true,
          activityLevel: 'moderately_active',
          skippedNutritionTargets: true,
          hasTrainerCode: false,
          trainingComfort: 'knows_basics',
          repRangeMin: 8,
          repRangeMax: 12,
          workoutFrequencyDays: 4,
          averageWorkoutLength: '45_60',
          trainingPriorities: ['glutes'],
          equipmentAccess: 'full_gym',
          trainingExclusions: [],
        },
      }),
    );

    renderScreen();
    await screen.findByTestId('onboarding-step-workout-split');

    fireEvent.press(screen.getByTestId('onboarding-step-workout-split-create-own'));

    fireEvent.press(await screen.findByTestId('onboarding-continue'));
    expect(await screen.findByTestId('onboarding-step-email-preference')).toBeTruthy();
    const stored = await AsyncStorage.getItem('@progresso/onboardingDraft');
    const draft = JSON.parse(stored as string).draft;
    expect(draft.wantsCustomSplit).toBe(true);
    expect(draft.selectedSplitPresetId).toBeNull();

    fireEvent.press(screen.getByTestId('onboarding-email-yes'));
    await screen.findByTestId('onboarding-step-push-notifications');
    fireEvent.press(screen.getByTestId('onboarding-step-push-notifications-skip'));

    await screen.findByTestId('onboarding-step-trainer-code');
    fireEvent.press(screen.getByTestId('onboarding-no-trainer-code'));

    await screen.findByTestId('onboarding-step-summary');
    fireEvent.press(screen.getByTestId('onboarding-continue'));

    await screen.findByTestId('onboarding-step-create-account');
    fireEvent.changeText(screen.getByTestId('onboarding-create-account-display-name'), 'Harbir');
    fireEvent.changeText(screen.getByTestId('onboarding-create-account-last-name'), 'Bains');
    fireEvent.changeText(screen.getByTestId('onboarding-create-account-username'), 'harbirb');
    fireEvent.changeText(
      screen.getByTestId('onboarding-create-account-email'),
      'harbir@example.com',
    );
    fireEvent.changeText(screen.getByTestId('onboarding-create-account-phone'), '604 555 1234');
    fireEvent.changeText(screen.getByTestId('onboarding-create-account-password'), 'password123');
    fireEvent.changeText(
      screen.getByTestId('onboarding-create-account-confirm-password'),
      'password123',
    );

    await act(async () => {
      fireEvent.press(screen.getByTestId('onboarding-create-account-submit'));
    });

    expect(mockMaterialize).not.toHaveBeenCalled();
    await waitFor(() =>
      expect(mockUpdateMyProfile).toHaveBeenCalledWith(
        'token-123',
        expect.not.objectContaining({ activeWorkoutSplitId: expect.anything() }),
      ),
    );
    await settle();
  });

  // Regression coverage for the real bug this fixes: Google sign-up used to
  // only exist on the separate Sign In screen, so a brand-new user
  // authenticating via Google there got a session with none of onboarding's
  // profile data ever collected. Google now lives here instead, on the
  // account-creation step itself.
  it('persists the draft with pendingUsername/pendingDisplayName and starts Google OAuth, with no separate signUp call', async () => {
    await AsyncStorage.setItem(
      '@progresso/onboardingDraft',
      JSON.stringify({
        stepIndex: STEP_ORDER.indexOf('createAccount'),
        draft: {
          referralSource: 'tiktok',
          country: 'CA',
          gender: 'male',
          birthday: '2000-06-15',
          weightValue: 80,
          weightUnit: 'kg',
          heightValue: 180,
          heightUnit: 'cm',
          fitnessGoals: ['build_muscle'],
          membershipTier: 'everything',
          ranksSeen: true,
          summarySeen: true,
          activityLevel: 'moderately_active',
          skippedNutritionTargets: true,
          hasTrainerCode: false,
          trainingComfort: 'knows_basics',
          repRangeMin: 8,
          repRangeMax: 12,
          workoutFrequencyDays: 4,
          averageWorkoutLength: '45_60',
          trainingPriorities: ['glutes'],
          equipmentAccess: 'full_gym',
          trainingExclusions: [],
          selectedSplitPresetId: 'ppl',
          emailOptIn: true,
          pushNotificationsOptIn: false,
        },
      }),
    );

    renderScreen();
    await screen.findByTestId('onboarding-step-create-account');
    fireEvent.changeText(screen.getByTestId('onboarding-create-account-display-name'), 'Harbir');
    fireEvent.changeText(screen.getByTestId('onboarding-create-account-last-name'), 'Bains');
    fireEvent.changeText(screen.getByTestId('onboarding-create-account-username'), 'harbirb');
    fireEvent.changeText(screen.getByTestId('onboarding-create-account-phone'), '604 555 1234');

    await act(async () => {
      fireEvent.press(screen.getByTestId('onboarding-create-account-google'));
    });

    expect(mockSignInWithProvider).toHaveBeenCalledWith('google');
    expect(mockSignUpWithPassword).not.toHaveBeenCalled();

    const stored = await AsyncStorage.getItem('@progresso/onboardingDraft');
    expect(stored).not.toBeNull();
    const parsed = JSON.parse(stored as string).draft;
    expect(parsed.pendingUsername).toBe('harbirb');
    expect(parsed.pendingDisplayName).toBe('Harbir');
    expect(parsed.pendingLastName).toBe('Bains');
    expect(parsed.pendingPhoneNumber).toBe('+16045551234');
    // App.tsx's Root -- not this screen -- submits the profile once the
    // OAuth session actually appears, so nothing here calls updateMyProfile.
    expect(mockUpdateMyProfile).not.toHaveBeenCalled();
    await settle();
  });

  const fullyAnsweredDraft = {
    referralSource: 'tiktok',
    country: 'CA',
    gender: 'male',
    birthday: '2000-06-15',
    weightValue: 80,
    weightUnit: 'kg',
    heightValue: 180,
    heightUnit: 'cm',
    fitnessGoals: ['build_muscle'],
    membershipTier: 'everything',
    ranksSeen: true,
    summarySeen: true,
    activityLevel: 'moderately_active',
    skippedNutritionTargets: true,
    hasTrainerCode: false,
    trainingComfort: 'knows_basics',
    workoutFrequencyDays: 4,
    averageWorkoutLength: '45_60',
    trainingPriorities: ['glutes'],
    equipmentAccess: 'full_gym',
    trainingExclusions: [],
    selectedSplitPresetId: 'ppl',
    emailOptIn: true,
    pushNotificationsOptIn: false,
  };

  it('offers email sign-up only while Google is off', async () => {
    jest.mocked(socialSignInEnabled).mockReturnValue(false);
    await AsyncStorage.setItem(
      '@progresso/onboardingDraft',
      JSON.stringify({ stepIndex: STEP_ORDER.indexOf('createAccount'), draft: fullyAnsweredDraft }),
    );
    renderScreen();
    await screen.findByTestId('onboarding-step-create-account');

    expect(screen.getByTestId('onboarding-create-account-submit')).toBeTruthy();
    expect(screen.queryByTestId('onboarding-create-account-google')).toBeNull();
    expect(screen.queryByText('or')).toBeNull();
  });

  it('requires Display Name and Username before Google sign-up, same as the email path', async () => {
    await AsyncStorage.setItem(
      '@progresso/onboardingDraft',
      JSON.stringify({ stepIndex: STEP_ORDER.indexOf('createAccount'), draft: fullyAnsweredDraft }),
    );
    renderScreen();
    await screen.findByTestId('onboarding-step-create-account');

    expect(screen.getByTestId('onboarding-create-account-google').props.accessibilityState).toEqual(
      expect.objectContaining({ disabled: true }),
    );
    expect(mockSignInWithProvider).not.toHaveBeenCalled();
  });

  it('shows an error and does not clear the draft when Google sign-in fails', async () => {
    mockSignInWithProvider.mockResolvedValue('Google sign-in failed');
    await AsyncStorage.setItem(
      '@progresso/onboardingDraft',
      JSON.stringify({ stepIndex: STEP_ORDER.indexOf('createAccount'), draft: fullyAnsweredDraft }),
    );
    renderScreen();
    await screen.findByTestId('onboarding-step-create-account');
    fireEvent.changeText(screen.getByTestId('onboarding-create-account-display-name'), 'Harbir');
    fireEvent.changeText(screen.getByTestId('onboarding-create-account-last-name'), 'Bains');
    fireEvent.changeText(screen.getByTestId('onboarding-create-account-username'), 'harbirb');
    fireEvent.changeText(screen.getByTestId('onboarding-create-account-phone'), '604 555 1234');

    await act(async () => {
      fireEvent.press(screen.getByTestId('onboarding-create-account-google'));
    });

    expect(await screen.findByTestId('onboarding-create-account-error')).toHaveTextContent(
      'Google sign-in failed',
    );
    const stored = await AsyncStorage.getItem('@progresso/onboardingDraft');
    expect(stored).not.toBeNull();
  });
});

describe('OnboardingScreen -- notifications step', () => {
  const ANSWERED_UNTIL_NOTIFICATIONS: OnboardingDraft = {
    ...EMPTY_DRAFT,
    referralSource: 'tiktok',
    country: 'CA',
    gender: 'male',
    weightValue: 80,
    fitnessGoals: ['build_muscle'],
    membershipTier: 'everything',
    ranksSeen: true,
    summarySeen: true,
    activityLevel: 'moderately_active',
    skippedNutritionTargets: true,
    hasTrainerCode: false,
    trainingComfort: 'knows_basics',
    workoutFrequencyDays: 4,
    averageWorkoutLength: '45_60',
    trainingPriorities: ['glutes'],
    equipmentAccess: 'full_gym',
    trainingExclusions: [],
    selectedSplitPresetId: 'ppl',
    emailOptIn: true,
  };

  async function startAtNotificationsStep() {
    await AsyncStorage.setItem(
      '@progresso/onboardingDraft',
      JSON.stringify({
        stepIndex: STEP_ORDER.indexOf('pushNotifications'),
        draft: ANSWERED_UNTIL_NOTIFICATIONS,
      }),
    );
    renderScreen();
    await screen.findByTestId('onboarding-step-push-notifications');
  }

  async function savedChoice(): Promise<boolean | null> {
    await settle();
    const stored = JSON.parse((await AsyncStorage.getItem('@progresso/onboardingDraft')) ?? '{}');
    return stored.draft?.pushNotificationsOptIn ?? null;
  }

  it('Allow shows the iOS prompt and saves notifications as on when it is granted', async () => {
    await startAtNotificationsStep();

    fireEvent.press(screen.getByTestId('onboarding-step-push-notifications-connect'));

    expect(await screen.findByTestId('onboarding-step-trainer-code')).toBeTruthy();
    expect(mockRequestNotificationPermission).toHaveBeenCalledTimes(1);
    expect(await savedChoice()).toBe(true);
  });

  it('saves notifications as off when the user declines the iOS prompt', async () => {
    mockRequestNotificationPermission.mockResolvedValue(false);
    await startAtNotificationsStep();

    fireEvent.press(screen.getByTestId('onboarding-step-push-notifications-connect'));

    expect(await screen.findByTestId('onboarding-step-trainer-code')).toBeTruthy();
    expect(await savedChoice()).toBe(false);
  });

  it('treats a failed permission request as declined, and still moves on', async () => {
    mockRequestNotificationPermission.mockRejectedValue(new Error('unavailable'));
    await startAtNotificationsStep();

    fireEvent.press(screen.getByTestId('onboarding-step-push-notifications-connect'));

    expect(await screen.findByTestId('onboarding-step-trainer-code')).toBeTruthy();
    expect(await savedChoice()).toBe(false);
  });

  it('Not Now saves notifications as off without ever showing the iOS prompt', async () => {
    await startAtNotificationsStep();

    fireEvent.press(screen.getByTestId('onboarding-step-push-notifications-skip'));

    expect(await screen.findByTestId('onboarding-step-trainer-code')).toBeTruthy();
    expect(mockRequestNotificationPermission).not.toHaveBeenCalled();
    expect(await savedChoice()).toBe(false);
  });

  it('shows Allow as busy and stays on the step while the iOS prompt is open', async () => {
    mockRequestNotificationPermission.mockReturnValue(new Promise(() => {}));
    await startAtNotificationsStep();

    fireEvent.press(screen.getByTestId('onboarding-step-push-notifications-connect'));
    await settle();

    expect(screen.getByTestId('onboarding-step-push-notifications-connect')).toHaveProp(
      'accessibilityState',
      expect.objectContaining({ busy: true }),
    );
    fireEvent.press(screen.getByTestId('onboarding-step-push-notifications-skip'));
    expect(screen.getByTestId('onboarding-step-push-notifications')).toBeTruthy();
    expect(mockRequestNotificationPermission).toHaveBeenCalledTimes(1);
  });
});

describe('OnboardingScreen -- the steps added for sign-up', () => {
  const ANSWERED: OnboardingDraft = {
    ...EMPTY_DRAFT,
    referralSource: 'tiktok',
    country: 'CA',
    gender: 'male',
    birthday: '2000-06-15',
    weightValue: 80,
    heightValue: 180,
    fitnessGoals: ['lose_fat'],
    trainingComfort: 'knows_basics',
    workoutFrequencyDays: 4,
    averageWorkoutLength: '45_60',
    trainingPriorities: ['glutes'],
    equipmentAccess: 'full_gym',
    trainingExclusions: [],
    membershipTier: 'workouts_nutrition',
    activityLevel: 'moderately_active',
    skippedNutritionTargets: true,
    selectedSplitPresetId: 'ppl',
    ranksSeen: true,
    summarySeen: true,
    emailOptIn: true,
    pushNotificationsOptIn: false,
    hasTrainerCode: false,
  };

  async function startAt(step: OnboardingStep, draft: Partial<OnboardingDraft> = {}) {
    await AsyncStorage.setItem(
      '@progresso/onboardingDraft',
      JSON.stringify({ stepIndex: STEP_ORDER.indexOf(step), draft: { ...ANSWERED, ...draft } }),
    );
    renderScreen();
  }

  it('chooses a workout program in a sheet of its own, made their split with the account', async () => {
    await startAt('workoutSplit', { selectedSplitPresetId: null, skippedSplit: false });
    expect(await screen.findByTestId('onboarding-programs-open')).toHaveTextContent(
      /Split Library.*133 splits in 9 categories/,
    );

    fireEvent.press(screen.getByTestId('onboarding-programs-open'));
    // The sheet opens on the Split Library, with what's recommended for them first.
    fireEvent.press(await screen.findByTestId('workout-programs-browser-recommended-test-split'));
    await act(async () => {
      fireEvent.press(await screen.findByTestId('program-detail-use'));
    });
    expect(await screen.findByTestId('program-added')).toHaveTextContent(/Program Chosen!/);
    fireEvent.press(screen.getByTestId('program-added-continue'));

    // On to the next question, with the program remembered in place of a preset.
    expect(await screen.findByTestId('onboarding-step-ranks')).toBeTruthy();
    await waitFor(async () => {
      const stored = JSON.parse((await AsyncStorage.getItem('@progresso/onboardingDraft'))!);
      expect(stored.draft).toMatchObject({
        selectedProgram: { programId: 'test-split', variationId: 'three-balanced' },
        selectedSplitPresetId: null,
      });
    });
  });

  it('recommends programs from their answers on the split question, each opening its page', async () => {
    await startAt('workoutSplit', { selectedSplitPresetId: null, skippedSplit: false });
    // Four days a week: the 3-day version, one fewer, is the one that fits.
    expect(await screen.findByTestId('onboarding-recommended-test-split')).toHaveTextContent(
      /Test Split.*3 days a week/,
    );
    expect(screen.getByTestId('onboarding-recommended')).toHaveTextContent(/Recommended for You/);
    // Skip for now is still there.
    expect(screen.getByTestId('onboarding-skip-workout-split')).toBeTruthy();

    fireEvent.press(screen.getByTestId('onboarding-recommended-test-split'));
    expect(await screen.findByTestId('program-detail')).toBeTruthy();
    expect(screen.getByTestId('program-detail-hero')).toHaveTextContent(/3-Day/);
  });

  it('recommends nothing on the split question when no program fits', async () => {
    // Bodyweight only: the made-up program needs a gym.
    await startAt('workoutSplit', {
      selectedSplitPresetId: null,
      skippedSplit: false,
      equipmentAccess: 'bodyweight',
    });
    await screen.findByTestId('onboarding-programs-open');
    expect(screen.queryByTestId('onboarding-recommended')).toBeNull();
  });

  it('lets each of the new questions be skipped, saving nothing for it', async () => {
    await startAt('trainingPriorities', { trainingPriorities: [] });
    fireEvent.press(await screen.findByTestId('onboarding-skip-training-priorities'));
    await screen.findByTestId('onboarding-step-training-comfort');

    await startAt('equipmentAccess', { equipmentAccess: null });
    fireEvent.press(await screen.findByTestId('onboarding-skip-equipment-access'));
    await screen.findByTestId('onboarding-step-training-exclusions');
    fireEvent.press(screen.getByTestId('onboarding-skip-training-exclusions'));
    await screen.findByTestId('onboarding-step-membership');
    await waitFor(async () => {
      const stored = JSON.parse((await AsyncStorage.getItem('@progresso/onboardingDraft'))!);
      expect(stored.draft).toMatchObject({
        equipmentAccess: null,
        equipmentSkipped: true,
        trainingExclusions: null,
        exclusionsSkipped: true,
      });
    });
  });

  it('keeps Balanced Development on its own, and never leaves out a priority', async () => {
    await startAt('trainingPriorities', { trainingPriorities: [], trainingExclusions: ['glutes'] });
    await screen.findByTestId('onboarding-step-training-priorities');
    fireEvent.press(screen.getByTestId('onboarding-priority-chest'));
    fireEvent.press(screen.getByTestId('onboarding-priority-balanced'));
    expect(
      screen.getByTestId('onboarding-priority-balanced').props.accessibilityState,
    ).toMatchObject({ selected: true });
    expect(screen.getByTestId('onboarding-priority-chest').props.accessibilityState).toMatchObject({
      selected: false,
    });
    fireEvent.press(screen.getByTestId('onboarding-priority-glutes'));
    await waitFor(async () => {
      const stored = JSON.parse((await AsyncStorage.getItem('@progresso/onboardingDraft'))!);
      expect(stored.draft).toMatchObject({
        trainingPriorities: ['glutes'],
        trainingExclusions: [],
      });
    });
  });

  it('finds the country the phone is in and lists it first, once allowed', async () => {
    jest.mocked(locationAvailable).mockReturnValue(true);
    jest.mocked(countryFromLocation).mockResolvedValue({ status: 'found', country: 'CA' });
    renderScreen();
    fireEvent.press(await screen.findByTestId('onboarding-referral-source-tiktok'));

    const step = await screen.findByTestId('onboarding-step-location');
    expect(step).toHaveTextContent(/Find your country.*Never sent to Progresso or kept/);
    await act(async () => {
      fireEvent.press(screen.getByTestId('onboarding-step-location-connect'));
    });

    await screen.findByTestId('onboarding-step-country');
    expect(screen.getByTestId('onboarding-step-country-located')).toBeTruthy();
    expect(screen.getByTestId('onboarding-step-country-option-CA')).toHaveTextContent(
      /Canada.*Your location/,
    );
    await waitFor(async () => {
      const stored = JSON.parse((await AsyncStorage.getItem('@progresso/onboardingDraft'))!);
      expect(stored.draft).toMatchObject({
        locationAsked: true,
        locatedCountry: 'CA',
        country: null,
      });
    });
  });

  it('goes on to the plain list without asking when Not Now is tapped', async () => {
    jest.mocked(locationAvailable).mockReturnValue(true);
    renderScreen();
    fireEvent.press(await screen.findByTestId('onboarding-referral-source-tiktok'));

    fireEvent.press(await screen.findByTestId('onboarding-step-location-skip'));

    await screen.findByTestId('onboarding-step-country');
    expect(countryFromLocation).not.toHaveBeenCalled();
    expect(screen.queryByTestId('onboarding-step-country-located')).toBeNull();
  });

  it('changes an answer from Your plan is ready, coming straight back to it', async () => {
    await startAt('summary', { summarySeen: false });
    const summary = await screen.findByTestId('onboarding-step-summary');
    expect(summary).toHaveTextContent(/Lose Fat/);
    expect(screen.getByTestId('onboarding-continue')).toHaveTextContent('Looks Good');

    fireEvent.press(screen.getByTestId('onboarding-step-summary-fitnessGoal'));
    await screen.findByTestId('onboarding-step-fitness-goal');
    fireEvent.press(screen.getByTestId('onboarding-step-fitness-goal-get_stronger'));
    fireEvent.press(screen.getByTestId('onboarding-continue'));

    expect(await screen.findByTestId('onboarding-step-summary')).toHaveTextContent(
      /Lose Fat, Get Stronger/,
    );
    fireEvent.press(screen.getByTestId('onboarding-continue'));
    expect(await screen.findByTestId('onboarding-step-create-account')).toBeTruthy();
  });

  it('lets no one pick a birthday under 13: the year wheel ends 13 years ago', async () => {
    const now = new Date();
    await startAt('gender', { gender: null });
    fireEvent.press(await screen.findByTestId('onboarding-gender-male'));
    await screen.findByTestId('onboarding-step-birthday');

    // The year wheel's whole list starts 13 years ago.
    const years = screen
      .UNSAFE_getAllByType(FlatList)
      .map((list) => list.props.data as string[])
      .find((data) => /^\d{4}$/.test(data[0] ?? ''))!;
    expect(years[0]).toBe(String(now.getFullYear() - 13));
  });

  it('brings a birthday saved too late back to the latest the wheels go to', async () => {
    const now = new Date();
    await startAt('gender', { gender: null, birthday: `${now.getFullYear() - 12}-01-01` });
    fireEvent.press(await screen.findByTestId('onboarding-gender-male'));
    await screen.findByTestId('onboarding-step-birthday');

    expect(screen.getByTestId('onboarding-continue')).toBeEnabled();
    await waitFor(async () => {
      const stored = JSON.parse((await AsyncStorage.getItem('@progresso/onboardingDraft'))!);
      expect(stored.draft.birthday.startsWith(String(now.getFullYear() - 13))).toBe(true);
    });
  });

  it('works out daily targets from their answers -- to lose, from their goal -- and lets them be changed', async () => {
    await startAt('nutritionTargets', { skippedNutritionTargets: false });
    await screen.findByTestId('onboarding-step-nutrition-targets');

    // 180 cm, 80 kg, 26ish, moderately active: about 2,700 to maintain; losing is 300 under.
    expect(screen.getByTestId('onboarding-step-nutrition-targets-plan-lose')).toHaveProp(
      'accessibilityState',
      expect.objectContaining({ selected: true }),
    );
    const calories = () =>
      Number(screen.getByTestId('onboarding-step-nutrition-targets-calories').props.value);
    const lose = calories();
    fireEvent.press(screen.getByTestId('onboarding-step-nutrition-targets-plan-maintain'));
    expect(calories()).toBe(lose + 300);

    fireEvent.changeText(screen.getByTestId('onboarding-step-nutrition-targets-calories'), '2500');
    fireEvent.press(screen.getByTestId('onboarding-step-nutrition-targets-use'));

    await screen.findByTestId('onboarding-step-workout-split');
    await waitFor(async () => {
      const stored = JSON.parse((await AsyncStorage.getItem('@progresso/onboardingDraft'))!);
      expect(stored.draft.nutritionTargets).toMatchObject({ calories: 2500, proteinG: 140 });
    });
  });

  it('lets the daily targets be skipped, saving none', async () => {
    await startAt('nutritionTargets', { skippedNutritionTargets: false });
    fireEvent.press(await screen.findByTestId('onboarding-step-nutrition-targets-skip'));

    await screen.findByTestId('onboarding-step-workout-split');
    await waitFor(async () => {
      const stored = JSON.parse((await AsyncStorage.getItem('@progresso/onboardingDraft'))!);
      expect(stored.draft).toMatchObject({
        nutritionTargets: null,
        skippedNutritionTargets: true,
      });
    });
  });

  it('says what ranks are, opens the full explanation as a page, then moves on', async () => {
    await startAt('ranks', { ranksSeen: false });
    const ranks = await screen.findByTestId('onboarding-step-ranks');

    // A line on the step; the detail is a page of its own.
    expect(ranks).toHaveTextContent(/a rank that's yours for life, from Bronze to Legacy/);
    expect(screen.queryByText('Earn Achievement Points')).toBeNull();
    fireEvent.press(screen.getByTestId('onboarding-ranks-open'));
    const page = screen.getByTestId('rank-explainer-page');
    expect(page).toHaveTextContent(/Earn Achievement Points/);
    expect(page).toHaveTextContent(/Bronze.*Legacy/);
    expect(page).toHaveTextContent(/Earned from what you log/);
    fireEvent.press(screen.getByTestId('rank-explainer-page-close'));
    expect(screen.queryByTestId('rank-explainer-page')).toBeNull();

    fireEvent.press(screen.getByTestId('onboarding-continue'));

    expect(await screen.findByTestId('onboarding-step-email-preference')).toBeTruthy();
  });

  it('asks about Apple Health steps where it can, after notifications', async () => {
    jest.mocked(stepsAccess).mockResolvedValue('notAsked');
    await startAt('pushNotifications', { pushNotificationsOptIn: null });
    await screen.findByTestId('onboarding-step-push-notifications');
    await settle();

    fireEvent.press(screen.getByTestId('onboarding-step-push-notifications-skip'));
    await screen.findByTestId('onboarding-step-apple-health');
    fireEvent.press(screen.getByTestId('onboarding-step-apple-health-connect'));

    expect(await screen.findByTestId('onboarding-step-trainer-code')).toBeTruthy();
    expect(askForSteps).toHaveBeenCalledTimes(1);
  });

  it('never asks about Apple Health where it is not there', async () => {
    await startAt('pushNotifications', { pushNotificationsOptIn: null });
    await screen.findByTestId('onboarding-step-push-notifications');
    await settle();

    fireEvent.press(screen.getByTestId('onboarding-step-push-notifications-skip'));

    expect(await screen.findByTestId('onboarding-step-trainer-code')).toBeTruthy();
    expect(screen.queryByTestId('onboarding-step-apple-health')).toBeNull();
  });

  it("lets the trainer's code wait, with one way past it, saying where to enter it later", async () => {
    await startAt('trainerCode', { hasTrainerCode: null });
    await screen.findByTestId('onboarding-step-trainer-code');

    expect(screen.getByText('You can enter it any time in Settings > Trainer Code.')).toBeTruthy();
    // "No" and "Do this later" did the same thing: there's one way past it now.
    expect(screen.queryByTestId('onboarding-trainer-code-later')).toBeNull();
    expect(screen.getByTestId('onboarding-no-trainer-code')).toHaveTextContent(
      "Skip: I Don't Have One",
    );
    fireEvent.press(screen.getByTestId('onboarding-no-trainer-code'));

    expect(await screen.findByTestId('onboarding-step-summary')).toBeTruthy();
  });

  it('says what creating an account agrees to, each page a tap away', async () => {
    await startAt('createAccount');
    await screen.findByTestId('onboarding-step-create-account');

    expect(screen.getByTestId('onboarding-create-account-terms')).toHaveTextContent(
      /By creating an account, you agree to Progresso's Terms of Service and Privacy Policy/,
    );
    fireEvent.press(screen.getByTestId('onboarding-create-account-terms-link'));
    fireEvent.press(screen.getByTestId('onboarding-create-account-privacy-link'));
    expect(jest.mocked(openLegalPage).mock.calls).toEqual([['terms'], ['privacy']]);
  });

  it('keeps spaces out of a username as it is typed', async () => {
    await startAt('createAccount');
    await screen.findByTestId('onboarding-step-create-account');

    fireEvent.changeText(screen.getByTestId('onboarding-create-account-username'), 'Harbir B ains');

    expect(screen.getByTestId('onboarding-create-account-username')).toHaveProp(
      'value',
      'harbirbains',
    );
  });
});

describe('OnboardingScreen -- finding your way', () => {
  const ANSWERED: OnboardingDraft = {
    ...EMPTY_DRAFT,
    referralSource: 'tiktok',
    country: 'CA',
    gender: 'male',
    birthday: '2000-06-15',
    weightValue: 80,
    heightValue: 180,
    fitnessGoals: ['lose_fat'],
    trainingComfort: 'knows_basics',
    workoutFrequencyDays: 4,
    averageWorkoutLength: '45_60',
    trainingPriorities: ['glutes'],
    equipmentAccess: 'full_gym',
    trainingExclusions: [],
    membershipTier: 'workouts',
  };

  async function startAt(step: OnboardingStep, draft: Partial<OnboardingDraft> = {}) {
    await AsyncStorage.setItem(
      '@progresso/onboardingDraft',
      JSON.stringify({ stepIndex: STEP_ORDER.indexOf(step), draft: { ...ANSWERED, ...draft } }),
    );
    renderScreen();
  }

  it('says which part each question is in, and how far through it, from the first', async () => {
    renderScreen();
    await screen.findByTestId('onboarding-step-referral-source');

    expect(screen.getByTestId('onboarding-section')).toHaveTextContent('About You · 1 of 6');
    expect(screen.getByTestId('onboarding-intro')).toHaveTextContent(
      /A few quick questions to set up Progresso/,
    );
    // A bar per part, not a dash per question.
    expect(
      screen.getAllByTestId(/^onboarding-progress-section-\d+$/, { includeHiddenElements: true }),
    ).toHaveLength(5);
  });

  it('takes an answered question forward with Continue after going back to it', async () => {
    await startAt('trainingComfort', { trainingComfort: null });
    await screen.findByTestId('onboarding-step-training-comfort');
    expect(screen.getByTestId('onboarding-section')).toHaveTextContent('Your Training · 3 of 7');

    fireEvent.press(screen.getByTestId('onboarding-back'));
    await screen.findByTestId('onboarding-step-training-priorities');
    fireEvent.press(screen.getByTestId('onboarding-back'));
    await screen.findByTestId('onboarding-step-fitness-goal');
    fireEvent.press(screen.getByTestId('onboarding-back'));
    await screen.findByTestId('onboarding-step-height');
    fireEvent.press(screen.getByTestId('onboarding-back'));
    // A pick-one question, already answered: Continue, rather than answering again.
    await screen.findByTestId('onboarding-step-weight');
    fireEvent.press(screen.getByTestId('onboarding-back'));
    await screen.findByTestId('onboarding-step-birthday');
    fireEvent.press(screen.getByTestId('onboarding-back'));
    await screen.findByTestId('onboarding-step-gender');
    expect(screen.getByTestId('onboarding-gender-male').props.accessibilityState).toMatchObject({
      selected: true,
    });

    fireEvent.press(screen.getByTestId('onboarding-continue'));
    expect(await screen.findByTestId('onboarding-step-birthday')).toBeTruthy();
  });

  it('tells a preset apart from building your own, and shows the one chosen on coming back', async () => {
    // Picked up at How ranks work, then back to the split chosen before.
    await startAt('ranks', { wantsCustomSplit: true });
    await screen.findByTestId('onboarding-step-ranks');
    fireEvent.press(screen.getByTestId('onboarding-back'));
    await screen.findByTestId('onboarding-step-workout-split');

    expect(screen.getByTestId('onboarding-step-workout-split-presets-heading')).toHaveTextContent(
      'Start From a Preset',
    );
    expect(
      screen.getByTestId('onboarding-step-workout-split-create-own-heading'),
    ).toHaveTextContent('Or Build Your Own');
    expect(
      screen.getByTestId('onboarding-step-workout-split-create-own-description'),
    ).toHaveTextContent(
      'Name your own days and choose every exercise. It opens as soon as your account is made.',
    );
    expect(screen.getByTestId('onboarding-step-workout-split-create-own-selected')).toBeTruthy();
    // On to How ranks work: the nine ranks as a ladder, with the full explanation a tap away.
    fireEvent.press(screen.getByTestId('onboarding-continue'));
    await screen.findByTestId('onboarding-step-ranks');
    expect(screen.getByTestId('onboarding-rank-ladder')).toBeTruthy();
    expect(screen.getByTestId('onboarding-ranks-open')).toBeTruthy();
    fireEvent.press(screen.getByTestId('onboarding-back'));
    await screen.findByTestId('onboarding-step-workout-split');
    // Already answered when reached: Continue goes on without choosing again.
    fireEvent.press(screen.getByTestId('onboarding-continue'));
    expect(await screen.findByTestId('onboarding-step-ranks')).toBeTruthy();
  });
});
