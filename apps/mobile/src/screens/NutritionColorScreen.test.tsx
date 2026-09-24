import { fireEvent, render, screen } from '@testing-library/react-native';
import { useAuth } from '../auth/AuthProvider';
import { getMyProfile, updateMyProfile } from '../lib/api';
import { ProfileProvider } from '../profile/ProfileProvider';
import { DEFAULT_NUTRITION_COLOR } from '../theme/accentColor';
import { NutritionColorScreen } from './NutritionColorScreen';

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

describe('NutritionColorScreen', () => {
  it('falls back to the default Nutrition color when the profile has none saved', async () => {
    render(<NutritionColorScreen navigation={navigation} route={route} />, {
      wrapper: ProfileProvider,
    });

    expect(await screen.findByTestId(`preset-swatch-${DEFAULT_NUTRITION_COLOR}`)).toBeTruthy();
    expect(
      screen.getByTestId(`preset-swatch-${DEFAULT_NUTRITION_COLOR}`).props.accessibilityState
        .selected,
    ).toBe(true);
  });

  it("loads the user's previously saved nutrition color", async () => {
    mockGetMyProfile.mockResolvedValue({
      id: 'user-1',
      email: 'a@test.local',
      role: 'user',
      displayName: null,
      username: null,
      weightUnit: 'kg',
      workoutAccentColor: null,
      nutritionAccentColor: '#8B5CF6',
    });

    render(<NutritionColorScreen navigation={navigation} route={route} />, {
      wrapper: ProfileProvider,
    });

    expect(await screen.findByTestId('preset-swatch-#8B5CF6')).toBeTruthy();
    expect(screen.getByTestId('preset-swatch-#8B5CF6').props.accessibilityState.selected).toBe(
      true,
    );
  });

  it('saves only nutritionAccentColor and goes back on success, independent of workout color', async () => {
    mockUpdateMyProfile.mockResolvedValue({});

    render(<NutritionColorScreen navigation={navigation} route={route} />, {
      wrapper: ProfileProvider,
    });
    await screen.findByTestId('accent-color-save');

    fireEvent.press(screen.getByTestId('preset-swatch-#8B5CF6'));
    fireEvent.press(screen.getByTestId('accent-color-save'));

    await screen.findByTestId('accent-color-save');
    expect(mockUpdateMyProfile).toHaveBeenCalledWith('token-123', {
      nutritionAccentColor: '#8B5CF6',
    });
    expect(mockUpdateMyProfile.mock.calls[0][1]).not.toHaveProperty('workoutAccentColor');
    expect(mockGoBack).toHaveBeenCalled();
  });

  it('shows a save error and does not navigate back on failure', async () => {
    mockUpdateMyProfile.mockRejectedValue(new Error('Network down'));

    render(<NutritionColorScreen navigation={navigation} route={route} />, {
      wrapper: ProfileProvider,
    });
    await screen.findByTestId('accent-color-save');

    fireEvent.press(screen.getByTestId('accent-color-save'));

    expect(await screen.findByTestId('accent-color-save-error')).toHaveTextContent('Network down');
    expect(mockGoBack).not.toHaveBeenCalled();
  });
});
