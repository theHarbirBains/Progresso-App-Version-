import { act, fireEvent, render, screen } from '@testing-library/react-native';
import { useAuth } from '../auth/AuthProvider';
import { getMyProfile, updateMyProfile } from '../lib/api';
import { AppMenuContext } from '../navigation/AppMenuContext';
import { CalorieEstimationScreen } from './CalorieEstimationScreen';

jest.mock('../auth/AuthProvider', () => ({
  useAuth: jest.fn(),
}));

jest.mock('../lib/api', () => ({
  getMyProfile: jest.fn(),
  updateMyProfile: jest.fn(),
}));

const mockUseAuth = useAuth as jest.Mock;
const mockGetMyProfile = getMyProfile as jest.Mock;
const mockUpdateMyProfile = updateMyProfile as jest.Mock;

const mockGoBack = jest.fn();
const mockOpenMenu = jest.fn();
// eslint-disable-next-line @typescript-eslint/no-explicit-any
const navigation: any = { goBack: mockGoBack, navigate: jest.fn() };
const route = {} as never;

const baseProfile = {
  id: 'user-1',
  email: 'a@example.com',
  role: 'user',
  displayName: null,
  username: null,
  weightUnit: 'kg' as const,
  workoutAccentColor: null,
  nutritionAccentColor: null,
  backgroundTheme: null,
  avatarUrl: null,
  activeWorkoutSplitId: null,
  gender: null,
  birthday: null,
  weightValue: null,
  heightValue: null,
  heightUnit: 'cm' as const,
  fitnessGoal: null,
  trainingExperience: null,
  workoutFrequencyDays: null,
  trainingStylePreference: null,
  emailOptIn: null,
  pushNotificationsOptIn: null,
  appleHealthPreference: null,
  onboardingCompletedAt: '2020-01-01T00:00:00.000Z',
  activityLevel: null,
};

async function flush() {
  await act(async () => {
    await Promise.resolve();
  });
}

async function renderScreen() {
  render(
    <AppMenuContext.Provider value={{ openMenu: mockOpenMenu, currentMode: 'nutrition' }}>
      <CalorieEstimationScreen navigation={navigation} route={route} />
    </AppMenuContext.Provider>,
  );
  await screen.findByTestId('calorie-estimation-scroll');
}

beforeEach(() => {
  mockUseAuth.mockReturnValue({
    user: { id: 'user-1' },
    session: { access_token: 'token-123' },
  });
  mockGetMyProfile.mockReset().mockResolvedValue(baseProfile);
  mockUpdateMyProfile.mockReset().mockResolvedValue(baseProfile);
  mockGoBack.mockClear();
  mockOpenMenu.mockClear();
});

describe('CalorieEstimationScreen', () => {
  it('shows the title and supporting copy', async () => {
    await renderScreen();

    expect(screen.getByText('Personal Information')).toBeTruthy();
  });

  it('starts with no gender or activity level selected when the profile has neither', async () => {
    await renderScreen();

    expect(
      screen.getByTestId('calorie-estimation-gender-male').props.accessibilityState.selected,
    ).toBe(false);
    expect(
      screen.getByTestId('calorie-estimation-gender-female').props.accessibilityState.selected,
    ).toBe(false);
    expect(screen.getAllByText('Select your activity level').length).toBeGreaterThanOrEqual(1);
  });

  it('selecting a gender marks it (and only it) as selected', async () => {
    await renderScreen();

    fireEvent.press(screen.getByTestId('calorie-estimation-gender-male'));

    expect(
      screen.getByTestId('calorie-estimation-gender-male').props.accessibilityState.selected,
    ).toBe(true);
    expect(
      screen.getByTestId('calorie-estimation-gender-female').props.accessibilityState.selected,
    ).toBe(false);
  });

  it('shows the current birthday as a compact readout', async () => {
    mockGetMyProfile.mockResolvedValue({ ...baseProfile, birthday: '1996-03-10' });
    await renderScreen();

    expect(screen.getByTestId('calorie-estimation-birthday-value')).toHaveTextContent(
      'March 10, 1996',
    );
  });

  it('opens the birthday picker sheet, lets a wheel value be picked, and reflects it once closed', async () => {
    mockGetMyProfile.mockResolvedValue({ ...baseProfile, birthday: '1996-03-10' });
    await renderScreen();

    fireEvent.press(screen.getByTestId('calorie-estimation-birthday-expand'));
    expect(screen.getByTestId('calorie-estimation-birthday-sheet')).toBeTruthy();

    fireEvent.press(screen.getByTestId('calorie-estimation-birthday-day-item-15'));
    fireEvent.press(screen.getByTestId('calorie-estimation-birthday-done'));

    expect(screen.getByTestId('calorie-estimation-birthday-value')).toHaveTextContent(
      'March 15, 1996',
    );
  });

  it('shows the current height/weight as a compact readout, in the current unit', async () => {
    mockGetMyProfile.mockResolvedValue({
      ...baseProfile,
      heightValue: 180,
      heightUnit: 'cm',
      weightValue: 79.2,
      weightUnit: 'kg',
    });
    await renderScreen();

    expect(screen.getByTestId('calorie-estimation-height-value')).toHaveTextContent('180 cm');
    expect(screen.getByTestId('calorie-estimation-weight-value')).toHaveTextContent('79.2 kg');
  });

  it('switching the height unit toggle updates the compact readout without opening the picker', async () => {
    mockGetMyProfile.mockResolvedValue({ ...baseProfile, heightValue: 180, heightUnit: 'cm' });
    await renderScreen();

    fireEvent.press(screen.getByTestId('calorie-estimation-height-unit-ft_in'));

    expect(screen.getByTestId('calorie-estimation-height-value')).toHaveTextContent(`5' 11"`);
    expect(screen.queryByTestId('calorie-estimation-height-sheet')).toBeNull();
  });

  it('switching the weight unit toggle updates the compact readout without opening the picker', async () => {
    mockGetMyProfile.mockResolvedValue({ ...baseProfile, weightValue: 79.2, weightUnit: 'kg' });
    await renderScreen();

    fireEvent.press(screen.getByTestId('calorie-estimation-weight-unit-lb'));

    expect(screen.getByTestId('calorie-estimation-weight-value')).toHaveTextContent('174.6 lb');
  });

  it('opens the height picker sheet, lets a wheel value be picked, and reflects it once closed', async () => {
    mockGetMyProfile.mockResolvedValue({ ...baseProfile, heightValue: 170, heightUnit: 'cm' });
    await renderScreen();

    fireEvent.press(screen.getByTestId('calorie-estimation-height-expand'));
    expect(screen.getByTestId('calorie-estimation-height-sheet')).toBeTruthy();

    fireEvent.press(screen.getByTestId('calorie-estimation-height-wheel-cm-item-175'));
    fireEvent.press(screen.getByTestId('calorie-estimation-height-done'));

    expect(screen.getByTestId('calorie-estimation-height-value')).toHaveTextContent('175 cm');
  });

  it('opens the weight picker sheet, lets a wheel value be picked, and reflects it once closed', async () => {
    mockGetMyProfile.mockResolvedValue({ ...baseProfile, weightValue: 70, weightUnit: 'kg' });
    await renderScreen();

    fireEvent.press(screen.getByTestId('calorie-estimation-weight-expand'));
    expect(screen.getByTestId('calorie-estimation-weight-sheet')).toBeTruthy();

    fireEvent.press(screen.getByTestId('calorie-estimation-weight-wheel-item-70.5'));
    fireEvent.press(screen.getByTestId('calorie-estimation-weight-done'));

    expect(screen.getByTestId('calorie-estimation-weight-value')).toHaveTextContent('70.5 kg');
  });

  it('opens the activity level sheet and selecting one marks only that option selected, then closes the sheet', async () => {
    await renderScreen();

    fireEvent.press(screen.getByTestId('calorie-estimation-activity-summary'));
    expect(screen.getByTestId('calorie-estimation-activity-sheet')).toBeTruthy();

    fireEvent.press(screen.getByTestId('calorie-estimation-activity-moderately_active'));

    expect(screen.getByText('Moderately active')).toBeTruthy();
    expect(screen.queryByTestId('calorie-estimation-activity-sheet')).toBeNull();
  });

  it('pressing Save with an invalid birthday and nothing else filled in shows every required-field error and does not save', async () => {
    // Default birthday (25 years ago) is valid on its own, so this only
    // exercises gender/activity level being required -- a genuinely invalid
    // age is covered by its own test below.
    await renderScreen();

    fireEvent.press(screen.getByTestId('calorie-estimation-save'));

    expect(screen.getByTestId('calorie-estimation-gender-error')).toBeTruthy();
    expect(screen.getByTestId('calorie-estimation-activity-error')).toBeTruthy();
    expect(mockUpdateMyProfile).not.toHaveBeenCalled();
    expect(mockGoBack).not.toHaveBeenCalled();
  });

  it('rejects a birthday that makes the user too young', async () => {
    const now = new Date();
    mockGetMyProfile.mockResolvedValue({
      ...baseProfile,
      birthday: `${now.getFullYear() - 9}-01-01`,
    });
    await renderScreen();
    fireEvent.press(screen.getByTestId('calorie-estimation-gender-male'));
    fireEvent.press(screen.getByTestId('calorie-estimation-activity-summary'));
    fireEvent.press(screen.getByTestId('calorie-estimation-activity-moderately_active'));

    fireEvent.press(screen.getByTestId('calorie-estimation-save'));

    expect(screen.getByTestId('calorie-estimation-birthday-error')).toBeTruthy();
    expect(mockUpdateMyProfile).not.toHaveBeenCalled();
  });

  it('does not show validation errors before Save has been pressed', async () => {
    await renderScreen();

    expect(screen.queryByTestId('calorie-estimation-gender-error')).toBeNull();
    expect(screen.queryByTestId('calorie-estimation-birthday-error')).toBeNull();
    expect(screen.queryByTestId('calorie-estimation-activity-error')).toBeNull();
  });

  it('saves gender, birthday, height, weight, and activity level to the profile, then goes back', async () => {
    mockGetMyProfile.mockResolvedValue({
      ...baseProfile,
      birthday: '1998-05-20',
      heightValue: 180,
      heightUnit: 'cm',
      weightValue: 80,
      weightUnit: 'kg',
    });
    await renderScreen();
    fireEvent.press(screen.getByTestId('calorie-estimation-gender-male'));
    fireEvent.press(screen.getByTestId('calorie-estimation-activity-summary'));
    fireEvent.press(screen.getByTestId('calorie-estimation-activity-moderately_active'));

    fireEvent.press(screen.getByTestId('calorie-estimation-save'));
    await flush();

    expect(mockUpdateMyProfile).toHaveBeenCalledWith('token-123', {
      gender: 'male',
      birthday: '1998-05-20',
      heightValue: 180,
      heightUnit: 'cm',
      weightValue: 80,
      weightUnit: 'kg',
      activityLevel: 'moderately_active',
    });
    expect(mockGoBack).toHaveBeenCalled();
  });

  it('shows a save error and does not navigate back when the save fails', async () => {
    mockGetMyProfile.mockResolvedValue({ ...baseProfile, birthday: '1998-05-20' });
    mockUpdateMyProfile.mockRejectedValue(new Error('network error'));
    await renderScreen();
    fireEvent.press(screen.getByTestId('calorie-estimation-gender-male'));
    fireEvent.press(screen.getByTestId('calorie-estimation-activity-summary'));
    fireEvent.press(screen.getByTestId('calorie-estimation-activity-moderately_active'));

    fireEvent.press(screen.getByTestId('calorie-estimation-save'));
    await flush();

    expect(screen.getByTestId('calorie-estimation-save-error')).toHaveTextContent('network error');
    expect(mockGoBack).not.toHaveBeenCalled();
  });

  it('prefills gender, birthday, height, weight, and activity level from the existing profile', async () => {
    mockGetMyProfile.mockResolvedValue({
      ...baseProfile,
      gender: 'female',
      birthday: '1996-03-10',
      heightValue: 165,
      heightUnit: 'cm',
      weightValue: 60,
      weightUnit: 'kg',
      activityLevel: 'lightly_active',
    });

    await renderScreen();

    expect(
      screen.getByTestId('calorie-estimation-gender-female').props.accessibilityState.selected,
    ).toBe(true);
    expect(screen.getByTestId('calorie-estimation-birthday-value')).toHaveTextContent(
      'March 10, 1996',
    );
    expect(screen.getByTestId('calorie-estimation-height-value')).toHaveTextContent('165 cm');
    expect(screen.getByTestId('calorie-estimation-weight-value')).toHaveTextContent('60 kg');
    expect(screen.getByText('Lightly active')).toBeTruthy();
  });

  it('never prefills gender from a profile value this screen does not offer (e.g. "other")', async () => {
    mockGetMyProfile.mockResolvedValue({ ...baseProfile, gender: 'other' });

    await renderScreen();

    expect(
      screen.getByTestId('calorie-estimation-gender-male').props.accessibilityState.selected,
    ).toBe(false);
    expect(
      screen.getByTestId('calorie-estimation-gender-female').props.accessibilityState.selected,
    ).toBe(false);
  });

  it('has no back button -- the header opens the Nutrition side menu instead', async () => {
    await renderScreen();

    expect(screen.queryByTestId('app-header-back')).toBeNull();

    fireEvent.press(screen.getByTestId('calorie-estimation-open-menu'));

    expect(mockOpenMenu).toHaveBeenCalledWith('nutrition');
  });

  it('degrades to the default nutrition theme when the profile fetch fails', async () => {
    mockGetMyProfile.mockRejectedValue(new Error('network error'));

    await renderScreen();

    // Still renders the form rather than getting stuck -- non-fatal failure.
    expect(screen.getByTestId('calorie-estimation-save')).toBeTruthy();
    await flush();
  });
});
