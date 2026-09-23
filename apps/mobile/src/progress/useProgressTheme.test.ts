import { renderHook, waitFor } from '@testing-library/react-native';
import { useAuth } from '../auth/AuthProvider';
import { getMyProfile } from '../lib/api';
import { DEFAULT_NUTRITION_THEME, DEFAULT_WORKOUT_THEME } from '../theme/accentColor';
import { useProgressTheme } from './useProgressTheme';

jest.mock('../auth/AuthProvider', () => ({
  useAuth: jest.fn(),
}));

jest.mock('../lib/api', () => ({
  getMyProfile: jest.fn(),
}));

const mockUseAuth = useAuth as jest.Mock;
const mockGetMyProfile = getMyProfile as jest.Mock;

beforeEach(() => {
  mockUseAuth.mockReturnValue({ session: { access_token: 'token-123' } });
  mockGetMyProfile.mockReset();
});

describe('useProgressTheme', () => {
  it('resolves other profile fields normally, but always keeps the fixed default theme -- app-wide black-and-white, unconditional even when the profile still has a saved custom accent', async () => {
    mockGetMyProfile.mockResolvedValue({
      workoutAccentColor: '#EF4444',
      nutritionAccentColor: '#EF4444',
      weightUnit: 'lb',
      activeWorkoutSplitId: 'split-1',
      displayName: 'Harbir Bains',
      username: 'harbir',
      avatarUrl: 'https://example.com/avatar.jpg',
    });

    const { result } = renderHook(() => useProgressTheme());

    await waitFor(() => expect(result.current.themeLoading).toBe(false));
    expect(result.current.theme).toBe(DEFAULT_WORKOUT_THEME);
    expect(result.current.nutritionTheme).toBe(DEFAULT_NUTRITION_THEME);
    expect(result.current.weightUnit).toBe('lb');
    expect(result.current.activeWorkoutSplitId).toBe('split-1');
    expect(result.current.displayName).toBe('Harbir Bains');
    expect(result.current.username).toBe('harbir');
    expect(result.current.avatarUrl).toBe('https://example.com/avatar.jpg');
  });

  it('falls back to the default theme, without throwing, when the profile request fails', async () => {
    mockGetMyProfile.mockRejectedValue(new Error('User profile not found'));

    const { result } = renderHook(() => useProgressTheme());

    await waitFor(() => expect(result.current.themeLoading).toBe(false));
    expect(result.current.theme).toBe(DEFAULT_WORKOUT_THEME);
    expect(result.current.weightUnit).toBe('kg');
    expect(result.current.activeWorkoutSplitId).toBeNull();
    expect(result.current.displayName).toBeNull();
    expect(result.current.username).toBeNull();
    expect(result.current.avatarUrl).toBeNull();
  });
});
