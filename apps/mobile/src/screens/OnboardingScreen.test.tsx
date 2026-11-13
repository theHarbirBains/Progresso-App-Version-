import AsyncStorage from '@react-native-async-storage/async-storage';
import { KeyboardAvoidingView, Platform } from 'react-native';
import { act, fireEvent, render, screen, waitFor } from '@testing-library/react-native';
import { useAuth } from '../auth/AuthProvider';
import { socialSignInEnabled } from '../auth/socialSignIn';
import { updateMyProfile } from '../lib/api';
import { requestNotificationPermission } from '../lib/pushNotifications';
import { EMPTY_DRAFT, STEP_ORDER, type OnboardingDraft } from '../onboarding/onboardingDraft';
import { materializeWorkoutSplitPreset } from '../workouts/workoutSplitQueries';
import { OnboardingScreen } from './OnboardingScreen';

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

jest.mock('../workouts/workoutSplitQueries', () => ({
  materializeWorkoutSplitPreset: jest.fn(),
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
          fitnessGoal: 'build_muscle',
          trainingComfort: 'knows_basics',
          workoutFrequencyDays: 4,
          averageWorkoutLength: '45_60',
        },
      }),
    );
    renderScreen();
    await screen.findByTestId('onboarding-step-workout-split');

    fireEvent.press(screen.getByTestId('onboarding-skip-workout-split'));

    expect(await screen.findByTestId('onboarding-step-email-preference')).toBeTruthy();
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
    fireEvent.press(screen.getByTestId('onboarding-gender-male'));

    await screen.findByTestId('onboarding-step-birthday');
    fireEvent.press(screen.getByTestId('onboarding-continue'));

    await screen.findByTestId('onboarding-step-weight');
    fireEvent.changeText(screen.getByTestId('onboarding-step-weight-input'), '176');
    fireEvent.press(screen.getByTestId('onboarding-continue'));

    await screen.findByTestId('onboarding-step-height');
    fireEvent.press(screen.getByTestId('onboarding-continue'));

    await screen.findByTestId('onboarding-step-fitness-goal');
    fireEvent.press(screen.getByTestId('onboarding-step-fitness-goal-build_muscle'));

    await screen.findByTestId('onboarding-step-training-comfort');
    expect(
      screen.getByText('How comfortable are you with planning and progressing your workouts?'),
    ).toBeTruthy();
    fireEvent.press(screen.getByTestId('onboarding-step-training-comfort-knows_basics'));

    await screen.findByTestId('onboarding-step-workout-frequency');
    fireEvent.press(screen.getByTestId('onboarding-frequency-4'));

    await screen.findByTestId('onboarding-step-average-workout-length');
    fireEvent.press(screen.getByTestId('onboarding-workout-length-45_60'));

    await screen.findByTestId('onboarding-step-workout-split');
    fireEvent.press(screen.getByTestId('onboarding-step-workout-split-preset-ppl'));

    await screen.findByTestId('onboarding-step-email-preference');
    fireEvent.press(screen.getByTestId('onboarding-email-yes'));

    await screen.findByTestId('onboarding-step-push-notifications');
    fireEvent.press(screen.getByTestId('onboarding-step-push-notifications-skip'));

    await screen.findByTestId('onboarding-step-create-account');
    fireEvent.changeText(
      screen.getByTestId('onboarding-create-account-display-name'),
      'Harbir Bains',
    );
    fireEvent.changeText(screen.getByTestId('onboarding-create-account-username'), 'harbirb');
    fireEvent.changeText(
      screen.getByTestId('onboarding-create-account-email'),
      'harbir@example.com',
    );
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
          fitnessGoal: 'build_muscle',
          trainingComfort: 'knows_basics',
          repRangeMin: 8,
          repRangeMax: 12,
          workoutFrequencyDays: 4,
          averageWorkoutLength: '45_60',
          // 176 lb, typed.
          weightValue: expect.closeTo(79.83, 2),
          weightUnit: 'lb',
          activeWorkoutSplitId: 'split-new',
          emailOptIn: true,
          pushNotificationsOptIn: false,
          username: 'harbirb',
          displayName: 'Harbir Bains',
          onboardingCompleted: true,
        }),
      ),
    );
    expect(await AsyncStorage.getItem('@progresso/onboardingDraft')).toBeNull();
    await settle();
  });

  it('labels the name field "First Name", not "Display Name"', async () => {
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
          fitnessGoal: 'build_muscle',
          trainingComfort: 'knows_basics',
          repRangeMin: 8,
          repRangeMax: 12,
          workoutFrequencyDays: 4,
          averageWorkoutLength: '45_60',
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
    expect(screen.queryByText('Display Name')).toBeNull();
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
          fitnessGoal: 'build_muscle',
          trainingComfort: 'knows_basics',
          repRangeMin: 8,
          repRangeMax: 12,
          workoutFrequencyDays: 4,
          averageWorkoutLength: '45_60',
          selectedSplitPresetId: 'ppl',
          emailOptIn: true,
          pushNotificationsOptIn: false,
        },
      }),
    );

    renderScreen();
    await screen.findByTestId('onboarding-step-create-account');
    fireEvent.changeText(
      screen.getByTestId('onboarding-create-account-display-name'),
      'Harbir Bains',
    );
    fireEvent.changeText(screen.getByTestId('onboarding-create-account-username'), 'harbirb');
    fireEvent.changeText(
      screen.getByTestId('onboarding-create-account-email'),
      'harbir@example.com',
    );
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
          fitnessGoal: 'build_muscle',
          trainingComfort: 'knows_basics',
          repRangeMin: 8,
          repRangeMax: 12,
          workoutFrequencyDays: 4,
          averageWorkoutLength: '45_60',
        },
      }),
    );

    renderScreen();
    await screen.findByTestId('onboarding-step-workout-split');

    fireEvent.press(screen.getByTestId('onboarding-step-workout-split-create-own'));

    expect(await screen.findByTestId('onboarding-step-email-preference')).toBeTruthy();
    const stored = await AsyncStorage.getItem('@progresso/onboardingDraft');
    const draft = JSON.parse(stored as string).draft;
    expect(draft.wantsCustomSplit).toBe(true);
    expect(draft.selectedSplitPresetId).toBeNull();

    fireEvent.press(screen.getByTestId('onboarding-email-yes'));
    await screen.findByTestId('onboarding-step-push-notifications');
    fireEvent.press(screen.getByTestId('onboarding-step-push-notifications-skip'));

    await screen.findByTestId('onboarding-step-create-account');
    fireEvent.changeText(
      screen.getByTestId('onboarding-create-account-display-name'),
      'Harbir Bains',
    );
    fireEvent.changeText(screen.getByTestId('onboarding-create-account-username'), 'harbirb');
    fireEvent.changeText(
      screen.getByTestId('onboarding-create-account-email'),
      'harbir@example.com',
    );
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
          fitnessGoal: 'build_muscle',
          trainingComfort: 'knows_basics',
          repRangeMin: 8,
          repRangeMax: 12,
          workoutFrequencyDays: 4,
          averageWorkoutLength: '45_60',
          selectedSplitPresetId: 'ppl',
          emailOptIn: true,
          pushNotificationsOptIn: false,
        },
      }),
    );

    renderScreen();
    await screen.findByTestId('onboarding-step-create-account');
    fireEvent.changeText(
      screen.getByTestId('onboarding-create-account-display-name'),
      'Harbir Bains',
    );
    fireEvent.changeText(screen.getByTestId('onboarding-create-account-username'), 'harbirb');

    await act(async () => {
      fireEvent.press(screen.getByTestId('onboarding-create-account-google'));
    });

    expect(mockSignInWithProvider).toHaveBeenCalledWith('google');
    expect(mockSignUpWithPassword).not.toHaveBeenCalled();

    const stored = await AsyncStorage.getItem('@progresso/onboardingDraft');
    expect(stored).not.toBeNull();
    const parsed = JSON.parse(stored as string).draft;
    expect(parsed.pendingUsername).toBe('harbirb');
    expect(parsed.pendingDisplayName).toBe('Harbir Bains');
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
    fitnessGoal: 'build_muscle',
    trainingComfort: 'knows_basics',
    workoutFrequencyDays: 4,
    averageWorkoutLength: '45_60',
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
    fireEvent.changeText(
      screen.getByTestId('onboarding-create-account-display-name'),
      'Harbir Bains',
    );
    fireEvent.changeText(screen.getByTestId('onboarding-create-account-username'), 'harbirb');

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
    fitnessGoal: 'build_muscle',
    trainingComfort: 'knows_basics',
    workoutFrequencyDays: 4,
    averageWorkoutLength: '45_60',
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

    expect(await screen.findByTestId('onboarding-step-create-account')).toBeTruthy();
    expect(mockRequestNotificationPermission).toHaveBeenCalledTimes(1);
    expect(await savedChoice()).toBe(true);
  });

  it('saves notifications as off when the user declines the iOS prompt', async () => {
    mockRequestNotificationPermission.mockResolvedValue(false);
    await startAtNotificationsStep();

    fireEvent.press(screen.getByTestId('onboarding-step-push-notifications-connect'));

    expect(await screen.findByTestId('onboarding-step-create-account')).toBeTruthy();
    expect(await savedChoice()).toBe(false);
  });

  it('treats a failed permission request as declined, and still moves on', async () => {
    mockRequestNotificationPermission.mockRejectedValue(new Error('unavailable'));
    await startAtNotificationsStep();

    fireEvent.press(screen.getByTestId('onboarding-step-push-notifications-connect'));

    expect(await screen.findByTestId('onboarding-step-create-account')).toBeTruthy();
    expect(await savedChoice()).toBe(false);
  });

  it('Not Now saves notifications as off without ever showing the iOS prompt', async () => {
    await startAtNotificationsStep();

    fireEvent.press(screen.getByTestId('onboarding-step-push-notifications-skip'));

    expect(await screen.findByTestId('onboarding-step-create-account')).toBeTruthy();
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
