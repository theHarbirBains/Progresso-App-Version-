import { fireEvent, render, screen, waitFor } from '@testing-library/react-native';
import { useAuth } from '../auth/AuthProvider';
import { getMyProfile, updateMyProfile, type ProfileResponse } from '../lib/api';
import { materializeWorkoutSplitPreset } from '../workouts/workoutSplitQueries';
import { OnboardingScreen } from './OnboardingScreen';

jest.mock('../auth/AuthProvider', () => ({
  useAuth: jest.fn(),
}));

jest.mock('../lib/api', () => ({
  getMyProfile: jest.fn(),
  updateMyProfile: jest.fn(),
}));

jest.mock('../workouts/workoutSplitQueries', () => ({
  materializeWorkoutSplitPreset: jest.fn(),
}));

const mockUseAuth = useAuth as jest.Mock;
const mockGetMyProfile = getMyProfile as jest.Mock;
const mockUpdateMyProfile = updateMyProfile as jest.Mock;
const mockMaterializeWorkoutSplitPreset = materializeWorkoutSplitPreset as jest.Mock;

const mockNavigate = jest.fn();
const mockReset = jest.fn();
// eslint-disable-next-line @typescript-eslint/no-explicit-any
const navigation: any = {
  navigate: mockNavigate,
  reset: mockReset,
  addListener: jest.fn((event: string, cb: () => void) => {
    if (event === 'focus') cb();
    return jest.fn();
  }),
};
const route = {} as never;

function blankProfile(overrides: Partial<ProfileResponse> = {}): ProfileResponse {
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

// Both OnboardingScreen's own load() AND useProgressTheme()'s internal fetch
// call the shared getMyProfile mock independently, in an order the test
// can't assume -- a mutable variable read fresh inside a persistent
// mockImplementation avoids the call-order race that mockResolvedValueOnce
// chaining would hit here (see prior session precedent).
let currentProfile: ProfileResponse = blankProfile();

beforeEach(() => {
  currentProfile = blankProfile();
  mockUseAuth.mockReturnValue({
    user: { id: 'user-1' },
    session: { access_token: 'token-123' },
  });
  mockGetMyProfile.mockReset().mockImplementation(async () => currentProfile);
  mockUpdateMyProfile.mockReset().mockImplementation(async (_token: string, updates: object) => {
    currentProfile = { ...currentProfile, ...updates } as ProfileResponse;
    return currentProfile;
  });
  mockMaterializeWorkoutSplitPreset
    .mockReset()
    .mockResolvedValue({ id: 'split-new', name: 'Push / Pull / Legs' });
  mockNavigate.mockClear();
  mockReset.mockClear();
});

describe('OnboardingScreen', () => {
  it('starts at the Apple Health step for a brand-new profile', async () => {
    render(<OnboardingScreen navigation={navigation} route={route} />);

    expect(await screen.findByTestId('onboarding-step-apple-health')).toBeTruthy();
    expect(screen.queryByTestId('onboarding-back')).toBeNull();
  });

  it('resumes at the first unanswered step for a partially-completed profile', async () => {
    currentProfile = blankProfile({
      appleHealthPreference: 'not_now',
      gender: 'male',
      birthday: '1998-01-01',
    });

    render(<OnboardingScreen navigation={navigation} route={route} />);

    expect(await screen.findByTestId('onboarding-step-weight')).toBeTruthy();
  });

  it('walks through the entire onboarding flow end-to-end', async () => {
    render(<OnboardingScreen navigation={navigation} route={route} />);

    // Apple Health -- preference-only, no separate Continue button.
    await screen.findByTestId('onboarding-step-apple-health');
    fireEvent.press(screen.getByTestId('onboarding-step-apple-health-skip'));
    await waitFor(() =>
      expect(mockUpdateMyProfile).toHaveBeenCalledWith('token-123', {
        appleHealthPreference: 'not_now',
      }),
    );

    // Gender
    await screen.findByTestId('onboarding-step-gender');
    expect(screen.getByTestId('onboarding-continue').props.accessibilityState.disabled).toBe(true);
    fireEvent.press(screen.getByTestId('onboarding-gender-other'));
    fireEvent.press(screen.getByTestId('onboarding-continue'));
    await waitFor(() =>
      expect(mockUpdateMyProfile).toHaveBeenCalledWith('token-123', { gender: 'other' }),
    );

    // Birthday
    await screen.findByTestId('onboarding-step-birthday');
    fireEvent.press(screen.getByTestId('onboarding-continue'));
    await waitFor(() =>
      expect(mockUpdateMyProfile).toHaveBeenCalledWith('token-123', {
        birthday: expect.any(String),
      }),
    );

    // Weight
    await screen.findByTestId('onboarding-step-weight');
    fireEvent.press(screen.getByTestId('onboarding-continue'));
    await waitFor(() =>
      expect(mockUpdateMyProfile).toHaveBeenCalledWith('token-123', {
        weightValue: expect.any(Number),
        weightUnit: 'kg',
      }),
    );

    // Height
    await screen.findByTestId('onboarding-step-height');
    fireEvent.press(screen.getByTestId('onboarding-continue'));
    await waitFor(() =>
      expect(mockUpdateMyProfile).toHaveBeenCalledWith('token-123', {
        heightValue: expect.any(Number),
        heightUnit: 'cm',
      }),
    );

    // Fitness goal
    await screen.findByTestId('onboarding-step-fitness-goal');
    fireEvent.press(screen.getByTestId('onboarding-step-fitness-goal-build_muscle'));
    fireEvent.press(screen.getByTestId('onboarding-continue'));
    await waitFor(() =>
      expect(mockUpdateMyProfile).toHaveBeenCalledWith('token-123', {
        fitnessGoal: 'build_muscle',
      }),
    );

    // Training experience
    await screen.findByTestId('onboarding-step-training-experience');
    fireEvent.press(screen.getByTestId('onboarding-experience-intermediate'));
    fireEvent.press(screen.getByTestId('onboarding-continue'));
    await waitFor(() =>
      expect(mockUpdateMyProfile).toHaveBeenCalledWith('token-123', {
        trainingExperience: 'intermediate',
      }),
    );

    // Workout frequency
    await screen.findByTestId('onboarding-step-workout-frequency');
    fireEvent.press(screen.getByTestId('onboarding-frequency-4'));
    fireEvent.press(screen.getByTestId('onboarding-continue'));
    await waitFor(() =>
      expect(mockUpdateMyProfile).toHaveBeenCalledWith('token-123', {
        workoutFrequencyDays: 4,
      }),
    );

    // Training style
    await screen.findByTestId('onboarding-step-training-style');
    fireEvent.press(screen.getByTestId('onboarding-step-training-style-build_your_own'));
    fireEvent.press(screen.getByTestId('onboarding-continue'));
    await waitFor(() =>
      expect(mockUpdateMyProfile).toHaveBeenCalledWith('token-123', {
        trainingStylePreference: 'build_your_own',
      }),
    );

    // Workout split -- pressing a preset both materializes and activates it
    // directly (no separate footer Continue), matching ChooseWorkoutSplitScreen.
    await screen.findByTestId('onboarding-step-workout-split');
    expect(screen.queryByTestId('onboarding-continue')).toBeNull();
    fireEvent.press(screen.getByTestId('onboarding-step-workout-split-preset-ppl'));
    await waitFor(() =>
      expect(mockUpdateMyProfile).toHaveBeenCalledWith('token-123', {
        activeWorkoutSplitId: 'split-new',
      }),
    );

    // Email preference
    await screen.findByTestId('onboarding-step-email-preference');
    fireEvent.press(screen.getByTestId('onboarding-email-yes'));
    fireEvent.press(screen.getByTestId('onboarding-continue'));
    await waitFor(() =>
      expect(mockUpdateMyProfile).toHaveBeenCalledWith('token-123', { emailOptIn: true }),
    );

    // Push notifications
    await screen.findByTestId('onboarding-step-push-notifications');
    fireEvent.press(screen.getByTestId('onboarding-step-push-notifications-connect'));
    await waitFor(() =>
      expect(mockUpdateMyProfile).toHaveBeenCalledWith('token-123', {
        pushNotificationsOptIn: true,
      }),
    );

    // Completion
    await screen.findByTestId('onboarding-step-completion');
    expect(screen.getByText("You're all set.")).toBeTruthy();
    fireEvent.press(screen.getByTestId('onboarding-start-training'));
    await waitFor(() =>
      expect(mockUpdateMyProfile).toHaveBeenCalledWith('token-123', { onboardingCompleted: true }),
    );
    expect(mockReset).toHaveBeenCalledWith({ index: 0, routes: [{ name: 'Dashboard' }] });
  });

  it('does not nest the wheel picker inside the outer ScrollView (avoids the VirtualizedList nesting warning)', async () => {
    currentProfile = blankProfile({ appleHealthPreference: 'not_now', gender: 'male' });
    render(<OnboardingScreen navigation={navigation} route={route} />);

    expect(await screen.findByTestId('onboarding-step-birthday')).toBeTruthy();
    expect(screen.queryByTestId('onboarding-scroll')).toBeNull();

    fireEvent.press(screen.getByTestId('onboarding-continue'));
    expect(await screen.findByTestId('onboarding-step-weight')).toBeTruthy();
    expect(screen.queryByTestId('onboarding-scroll')).toBeNull();

    fireEvent.press(screen.getByTestId('onboarding-continue'));
    expect(await screen.findByTestId('onboarding-step-height')).toBeTruthy();
    expect(screen.queryByTestId('onboarding-scroll')).toBeNull();
  });

  it('keeps the outer ScrollView for a plain option-list step', async () => {
    currentProfile = blankProfile({ appleHealthPreference: 'not_now' });
    render(<OnboardingScreen navigation={navigation} route={route} />);

    expect(await screen.findByTestId('onboarding-step-gender')).toBeTruthy();
    expect(screen.getByTestId('onboarding-scroll')).toBeTruthy();
  });

  it('Back moves to the previous step without persisting anything', async () => {
    currentProfile = blankProfile({ appleHealthPreference: 'not_now' });
    render(<OnboardingScreen navigation={navigation} route={route} />);

    await screen.findByTestId('onboarding-step-gender');
    mockUpdateMyProfile.mockClear();
    fireEvent.press(screen.getByTestId('onboarding-back'));

    expect(await screen.findByTestId('onboarding-step-apple-health')).toBeTruthy();
    expect(mockUpdateMyProfile).not.toHaveBeenCalled();
  });

  it('navigates to WorkoutSplitForm with activateOnCreate when Create Your Own is pressed', async () => {
    currentProfile = blankProfile({
      appleHealthPreference: 'not_now',
      gender: 'male',
      birthday: '1998-01-01',
      weightValue: 80,
      heightValue: 180,
      fitnessGoal: 'get_stronger',
      trainingExperience: 'advanced',
      workoutFrequencyDays: 5,
      trainingStylePreference: 'guided',
    });
    render(<OnboardingScreen navigation={navigation} route={route} />);

    await screen.findByTestId('onboarding-step-workout-split');
    fireEvent.press(screen.getByTestId('onboarding-step-workout-split-create-own'));

    expect(mockNavigate).toHaveBeenCalledWith('WorkoutSplitForm', { activateOnCreate: true });
  });

  it('advances past the split step on refocus once a split was created via Create Your Own', async () => {
    currentProfile = blankProfile({
      appleHealthPreference: 'not_now',
      gender: 'male',
      birthday: '1998-01-01',
      weightValue: 80,
      heightValue: 180,
      fitnessGoal: 'get_stronger',
      trainingExperience: 'advanced',
      workoutFrequencyDays: 5,
      trainingStylePreference: 'guided',
    });
    let focusCallback: (() => void) | undefined;
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const navWithCapturedFocus: any = {
      ...navigation,
      addListener: jest.fn((event: string, cb: () => void) => {
        if (event === 'focus') focusCallback = cb;
        return jest.fn();
      }),
    };

    render(<OnboardingScreen navigation={navWithCapturedFocus} route={route} />);
    await screen.findByTestId('onboarding-step-workout-split');

    fireEvent.press(screen.getByTestId('onboarding-step-workout-split-create-own'));
    expect(mockNavigate).toHaveBeenCalledWith('WorkoutSplitForm', { activateOnCreate: true });

    // Simulates WorkoutSplitFormScreen having created+activated a split,
    // then the user pressing Back to return here.
    currentProfile = { ...currentProfile, activeWorkoutSplitId: 'split-from-form' };
    focusCallback?.();

    expect(await screen.findByTestId('onboarding-step-email-preference')).toBeTruthy();
  });
});
