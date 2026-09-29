import AsyncStorage from '@react-native-async-storage/async-storage';
import { KeyboardAvoidingView, Platform } from 'react-native';
import { act, fireEvent, render, screen, waitFor } from '@testing-library/react-native';
import { useAuth } from '../auth/AuthProvider';
import { updateMyProfile } from '../lib/api';
import { STEP_ORDER } from '../onboarding/onboardingDraft';
import { materializeWorkoutSplitPreset } from '../workouts/workoutSplitQueries';
import { OnboardingScreen } from './OnboardingScreen';

jest.mock('../auth/AuthProvider', () => ({
  useAuth: jest.fn(),
}));

jest.mock('../lib/api', () => ({
  updateMyProfile: jest.fn(),
}));

jest.mock('../workouts/workoutSplitQueries', () => ({
  materializeWorkoutSplitPreset: jest.fn(),
}));

const mockUseAuth = useAuth as jest.Mock;
const mockSignUpWithPassword = jest.fn();
const mockSignInWithProvider = jest.fn();
const mockUpdateMyProfile = updateMyProfile as jest.Mock;
const mockMaterialize = materializeWorkoutSplitPreset as jest.Mock;
const mockSwitchToSignIn = jest.fn();

beforeEach(async () => {
  await AsyncStorage.clear();
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
    fireEvent.press(screen.getByTestId('onboarding-continue'));

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
    fireEvent.press(screen.getByTestId('onboarding-continue'));
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
    fireEvent.press(screen.getByTestId('onboarding-continue'));
    await screen.findByTestId('onboarding-step-country');

    fireEvent.press(screen.getByTestId('onboarding-back'));

    expect(await screen.findByTestId('onboarding-step-referral-source')).toBeTruthy();
  });

  it('walks through the entire onboarding flow end-to-end, creating the account only at the very end', async () => {
    renderScreen();

    await screen.findByTestId('onboarding-step-referral-source');
    fireEvent.press(screen.getByTestId('onboarding-referral-source-tiktok'));
    fireEvent.press(screen.getByTestId('onboarding-continue'));

    await screen.findByTestId('onboarding-step-country');
    fireEvent.changeText(screen.getByTestId('onboarding-step-country-search'), 'Canada');
    fireEvent.press(await screen.findByTestId('onboarding-step-country-option-CA'));
    fireEvent.press(screen.getByTestId('onboarding-continue'));

    await screen.findByTestId('onboarding-step-gender');
    fireEvent.press(screen.getByTestId('onboarding-gender-male'));
    fireEvent.press(screen.getByTestId('onboarding-continue'));

    await screen.findByTestId('onboarding-step-birthday');
    fireEvent.press(screen.getByTestId('onboarding-continue'));

    await screen.findByTestId('onboarding-step-weight');
    fireEvent.press(screen.getByTestId('onboarding-continue'));

    await screen.findByTestId('onboarding-step-height');
    fireEvent.press(screen.getByTestId('onboarding-continue'));

    await screen.findByTestId('onboarding-step-fitness-goal');
    fireEvent.press(screen.getByTestId('onboarding-step-fitness-goal-build_muscle'));
    fireEvent.press(screen.getByTestId('onboarding-continue'));

    await screen.findByTestId('onboarding-step-training-experience');
    fireEvent.press(screen.getByTestId('onboarding-experience-intermediate'));
    fireEvent.press(screen.getByTestId('onboarding-continue'));

    await screen.findByTestId('onboarding-step-workout-frequency');
    fireEvent.press(screen.getByTestId('onboarding-frequency-4'));
    fireEvent.press(screen.getByTestId('onboarding-continue'));

    await screen.findByTestId('onboarding-step-average-workout-length');
    fireEvent.press(screen.getByTestId('onboarding-workout-length-45_60'));
    fireEvent.press(screen.getByTestId('onboarding-continue'));

    await screen.findByTestId('onboarding-step-training-style');
    fireEvent.press(screen.getByTestId('onboarding-step-training-style-guided'));
    fireEvent.press(screen.getByTestId('onboarding-continue'));

    await screen.findByTestId('onboarding-step-workout-split');
    fireEvent.press(screen.getByTestId('onboarding-step-workout-split-preset-ppl'));

    await screen.findByTestId('onboarding-step-apple-health');
    fireEvent.press(screen.getByTestId('onboarding-step-apple-health-skip'));

    await screen.findByTestId('onboarding-step-email-preference');
    fireEvent.press(screen.getByTestId('onboarding-email-yes'));
    fireEvent.press(screen.getByTestId('onboarding-continue'));

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
      ),
    );
    expect(await AsyncStorage.getItem('@progresso/onboardingDraft')).toBeNull();
    await settle();
  });

  it('labels the name field "First Name", not "Display Name"', async () => {
    await AsyncStorage.setItem(
      '@progresso/onboardingDraft',
      JSON.stringify({
        stepIndex: 15,
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
          trainingExperience: 'intermediate',
          workoutFrequencyDays: 4,
          averageWorkoutLength: '45_60',
          trainingStylePreference: 'guided',
          selectedSplitPresetId: 'ppl',
          appleHealthPreference: 'not_now',
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
        stepIndex: 15,
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
          trainingExperience: 'intermediate',
          workoutFrequencyDays: 4,
          averageWorkoutLength: '45_60',
          trainingStylePreference: 'guided',
          selectedSplitPresetId: 'ppl',
          appleHealthPreference: 'not_now',
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
          trainingExperience: 'intermediate',
          workoutFrequencyDays: 4,
          averageWorkoutLength: '45_60',
          trainingStylePreference: 'guided',
        },
      }),
    );

    renderScreen();
    await screen.findByTestId('onboarding-step-workout-split');

    fireEvent.press(screen.getByTestId('onboarding-step-workout-split-create-own'));

    expect(await screen.findByTestId('onboarding-step-apple-health')).toBeTruthy();
    const stored = await AsyncStorage.getItem('@progresso/onboardingDraft');
    const draft = JSON.parse(stored as string).draft;
    expect(draft.wantsCustomSplit).toBe(true);
    expect(draft.selectedSplitPresetId).toBeNull();

    fireEvent.press(screen.getByTestId('onboarding-step-apple-health-skip'));
    await screen.findByTestId('onboarding-step-email-preference');
    fireEvent.press(screen.getByTestId('onboarding-email-yes'));
    fireEvent.press(screen.getByTestId('onboarding-continue'));
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
        stepIndex: 15,
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
          trainingExperience: 'intermediate',
          workoutFrequencyDays: 4,
          averageWorkoutLength: '45_60',
          trainingStylePreference: 'guided',
          selectedSplitPresetId: 'ppl',
          appleHealthPreference: 'not_now',
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
    trainingExperience: 'intermediate',
    workoutFrequencyDays: 4,
    averageWorkoutLength: '45_60',
    trainingStylePreference: 'guided',
    selectedSplitPresetId: 'ppl',
    appleHealthPreference: 'not_now',
    emailOptIn: true,
    pushNotificationsOptIn: false,
  };

  it('requires Display Name and Username before Google sign-up, same as the email path', async () => {
    await AsyncStorage.setItem(
      '@progresso/onboardingDraft',
      JSON.stringify({ stepIndex: 15, draft: fullyAnsweredDraft }),
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
      JSON.stringify({ stepIndex: 15, draft: fullyAnsweredDraft }),
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
