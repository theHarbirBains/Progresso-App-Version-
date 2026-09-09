import { renderHook, waitFor } from '@testing-library/react-native';
import { useAuth } from '../auth/AuthProvider';
import { getMyProfile } from '../lib/api';
import { DEFAULT_WORKOUT_THEME } from '../theme/accentColor';
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
  it('resolves to the workout accent theme from the profile', async () => {
    mockGetMyProfile.mockResolvedValue({
      workoutAccentColor: '#EF4444',
      weightUnit: 'lb',
      activeWorkoutSplitId: 'split-1',
    });

    const { result } = renderHook(() => useProgressTheme());

    await waitFor(() => expect(result.current.themeLoading).toBe(false));
    expect(result.current.theme.accent).toBe('#EF4444');
    expect(result.current.weightUnit).toBe('lb');
    expect(result.current.activeWorkoutSplitId).toBe('split-1');
  });

  it('falls back to the default theme, without throwing, when the profile request fails', async () => {
    mockGetMyProfile.mockRejectedValue(new Error('User profile not found'));

    const { result } = renderHook(() => useProgressTheme());

    await waitFor(() => expect(result.current.themeLoading).toBe(false));
    expect(result.current.theme).toBe(DEFAULT_WORKOUT_THEME);
    expect(result.current.weightUnit).toBe('kg');
    expect(result.current.activeWorkoutSplitId).toBeNull();
  });
});
