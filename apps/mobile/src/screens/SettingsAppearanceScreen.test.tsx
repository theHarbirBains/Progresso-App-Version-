import { fireEvent, render, screen } from '@testing-library/react-native';
import { Alert } from 'react-native';
import { expectNoBareText } from '../testUtils/expectNoBareText';
import { useAuth } from '../auth/AuthProvider';
import { updateMyProfile } from '../lib/api';
import { ProfileProvider } from '../profile/ProfileProvider';
import { DEFAULT_NUTRITION_COLOR, DEFAULT_WORKOUT_COLOR } from '../theme/accentColor';
import { SettingsAppearanceScreen } from './SettingsAppearanceScreen';
import { fetchMyProfile } from '../profile/profileQueries';

jest.mock('../auth/AuthProvider', () => ({
  useAuth: jest.fn(),
}));

jest.mock('../lib/api', () => ({
  updateMyProfile: jest.fn(),
}));

jest.mock('../profile/profileQueries', () => ({
  fetchMyProfile: jest.fn(),
}));

const mockUseAuth = useAuth as jest.Mock;
const mockFetchMyProfile = fetchMyProfile as jest.Mock;
const mockUpdateMyProfile = updateMyProfile as jest.Mock;

const baseProfile = {
  id: 'user-1',
  email: 'athlete@example.com',
  role: 'user',
  workoutAccentColor: null as string | null,
  nutritionAccentColor: null as string | null,
};

const mockNavigate = jest.fn();
const mockGoBack = jest.fn();
// eslint-disable-next-line @typescript-eslint/no-explicit-any
const navigation: any = { navigate: mockNavigate, goBack: mockGoBack };

beforeEach(() => {
  mockUseAuth.mockReturnValue({ session: { access_token: 'token-123' }, user: { id: 'user-1' } });
  mockFetchMyProfile.mockReset().mockResolvedValue(baseProfile);
  mockUpdateMyProfile.mockReset();
  mockNavigate.mockClear();
  mockGoBack.mockClear();
});

function renderScreen() {
  return render(
    <ProfileProvider>
      <SettingsAppearanceScreen navigation={navigation} route={{} as never} />
    </ProfileProvider>,
  );
}

describe('SettingsAppearanceScreen', () => {
  it('goes back when the header back button is pressed', async () => {
    renderScreen();
    await screen.findByTestId('open-workout-color-settings');

    fireEvent.press(screen.getByTestId('app-header-back'));

    expect(mockGoBack).toHaveBeenCalled();
  });

  it('shows the default colors and preset names when the user has not customized either mode', async () => {
    renderScreen();

    expect(await screen.findByTestId('open-workout-color-settings')).toHaveTextContent(
      /Warm Amber/,
    );
    expect(screen.getByTestId('open-nutrition-color-settings')).toHaveTextContent(/Warm Amber/);
  });

  it("shows 'Custom' when the saved color doesn't match any preset", async () => {
    mockFetchMyProfile.mockResolvedValue({
      ...baseProfile,
      workoutAccentColor: '#123456',
      nutritionAccentColor: '#654321',
    });
    renderScreen();

    expect(await screen.findByTestId('open-workout-color-settings')).toHaveTextContent(/Custom/);
    expect(screen.getByTestId('open-nutrition-color-settings')).toHaveTextContent(/Custom/);
  });

  it('navigates to WorkoutColorSettings when the Workout Mode row is pressed', async () => {
    renderScreen();
    await screen.findByTestId('open-workout-color-settings');

    fireEvent.press(screen.getByTestId('open-workout-color-settings'));

    expect(mockNavigate).toHaveBeenCalledWith('WorkoutColorSettings');
  });

  it('navigates to NutritionColorSettings when the Nutrition Mode row is pressed', async () => {
    renderScreen();
    await screen.findByTestId('open-workout-color-settings');

    fireEvent.press(screen.getByTestId('open-nutrition-color-settings'));

    expect(mockNavigate).toHaveBeenCalledWith('NutritionColorSettings');
  });

  it('navigates to BackgroundThemeSettings when the Background Theme row is pressed', async () => {
    renderScreen();
    await screen.findByTestId('open-workout-color-settings');

    fireEvent.press(screen.getByTestId('open-background-theme-settings'));

    expect(mockNavigate).toHaveBeenCalledWith('BackgroundThemeSettings');
  });

  it('asks for confirmation before resetting, and does nothing if cancelled', async () => {
    const alertSpy = jest.spyOn(Alert, 'alert').mockImplementation(() => {});
    mockFetchMyProfile.mockResolvedValue({
      ...baseProfile,
      workoutAccentColor: '#EF4444',
      nutritionAccentColor: '#8B5CF6',
    });
    renderScreen();
    await screen.findByTestId('open-workout-color-settings');

    fireEvent.press(screen.getByTestId('reset-theme-colors'));

    expect(alertSpy).toHaveBeenCalledWith(
      'Reset Theme Colors',
      expect.any(String),
      expect.any(Array),
    );
    expect(mockUpdateMyProfile).not.toHaveBeenCalled();
    alertSpy.mockRestore();
  });

  it('resets both colors to the defaults when the confirmation is accepted', async () => {
    mockFetchMyProfile.mockResolvedValue({
      ...baseProfile,
      workoutAccentColor: '#EF4444',
      nutritionAccentColor: '#8B5CF6',
    });
    mockUpdateMyProfile.mockResolvedValue({
      ...baseProfile,
      workoutAccentColor: DEFAULT_WORKOUT_COLOR,
      nutritionAccentColor: DEFAULT_NUTRITION_COLOR,
    });
    const alertSpy = jest.spyOn(Alert, 'alert').mockImplementation((_title, _message, buttons) => {
      const resetButton = buttons?.find((b) => b.text === 'Reset');
      resetButton?.onPress?.();
    });
    renderScreen();
    await screen.findByTestId('open-workout-color-settings');

    fireEvent.press(screen.getByTestId('reset-theme-colors'));

    expect(mockUpdateMyProfile).toHaveBeenCalledWith('token-123', {
      workoutAccentColor: DEFAULT_WORKOUT_COLOR,
      nutritionAccentColor: DEFAULT_NUTRITION_COLOR,
    });
    expect(await screen.findByTestId('open-workout-color-settings')).toHaveTextContent(
      /Warm Amber/,
    );
    alertSpy.mockRestore();
  });

  it('renders no bare text outside <Text>', async () => {
    renderScreen();
    await screen.findByTestId('open-workout-color-settings');
    expectNoBareText();
  });
});
