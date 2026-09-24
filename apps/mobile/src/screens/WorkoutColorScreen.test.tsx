import { fireEvent, render, screen } from '@testing-library/react-native';
import { useAuth } from '../auth/AuthProvider';
import { getMyProfile, updateMyProfile } from '../lib/api';
import { ProfileProvider } from '../profile/ProfileProvider';
import { DEFAULT_WORKOUT_COLOR } from '../theme/accentColor';
import { WorkoutColorScreen } from './WorkoutColorScreen';

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
// eslint-disable-next-line @typescript-eslint/no-explicit-any
const navigation: any = { goBack: mockGoBack };
const route = {} as never;

beforeEach(() => {
  mockUseAuth.mockReturnValue({ session: { access_token: 'token-123' } });
  mockGetMyProfile.mockReset().mockResolvedValue({
    id: 'user-1',
    email: 'a@test.local',
    role: 'user',
    displayName: null,
    username: null,
    weightUnit: 'kg',
    workoutAccentColor: null,
    nutritionAccentColor: null,
  });
  mockUpdateMyProfile.mockReset();
  mockGoBack.mockClear();
});

describe('WorkoutColorScreen', () => {
  it('falls back to the default Workout color when the profile has none saved', async () => {
    render(<WorkoutColorScreen navigation={navigation} route={route} />, {
      wrapper: ProfileProvider,
    });

    expect(await screen.findByTestId(`preset-swatch-${DEFAULT_WORKOUT_COLOR}`)).toBeTruthy();
    expect(
      screen.getByTestId(`preset-swatch-${DEFAULT_WORKOUT_COLOR}`).props.accessibilityState
        .selected,
    ).toBe(true);
  });

  it("loads the user's previously saved workout color", async () => {
    mockGetMyProfile.mockResolvedValue({
      id: 'user-1',
      email: 'a@test.local',
      role: 'user',
      displayName: null,
      username: null,
      weightUnit: 'kg',
      workoutAccentColor: '#EF4444',
      nutritionAccentColor: null,
    });

    render(<WorkoutColorScreen navigation={navigation} route={route} />, {
      wrapper: ProfileProvider,
    });

    expect(await screen.findByTestId('preset-swatch-#EF4444')).toBeTruthy();
    expect(screen.getByTestId('preset-swatch-#EF4444').props.accessibilityState.selected).toBe(
      true,
    );
  });

  it('saves only workoutAccentColor and goes back on success', async () => {
    mockUpdateMyProfile.mockResolvedValue({});

    render(<WorkoutColorScreen navigation={navigation} route={route} />, {
      wrapper: ProfileProvider,
    });
    await screen.findByTestId('accent-color-save');

    fireEvent.press(screen.getByTestId('preset-swatch-#EF4444'));
    fireEvent.press(screen.getByTestId('accent-color-save'));

    await screen.findByTestId('accent-color-save');
    expect(mockUpdateMyProfile).toHaveBeenCalledWith('token-123', {
      workoutAccentColor: '#EF4444',
    });
    expect(mockGoBack).toHaveBeenCalled();
  });

  it('shows a save error and does not navigate back on failure', async () => {
    mockUpdateMyProfile.mockRejectedValue(new Error('Network down'));

    render(<WorkoutColorScreen navigation={navigation} route={route} />, {
      wrapper: ProfileProvider,
    });
    await screen.findByTestId('accent-color-save');

    fireEvent.press(screen.getByTestId('accent-color-save'));

    expect(await screen.findByTestId('accent-color-save-error')).toHaveTextContent('Network down');
    expect(mockGoBack).not.toHaveBeenCalled();
  });

  it('goes back without saving when the back button is pressed', async () => {
    render(<WorkoutColorScreen navigation={navigation} route={route} />, {
      wrapper: ProfileProvider,
    });
    await screen.findByTestId('accent-color-picker-back');

    fireEvent.press(screen.getByTestId('accent-color-picker-back'));

    expect(mockGoBack).toHaveBeenCalled();
    expect(mockUpdateMyProfile).not.toHaveBeenCalled();
  });
});
