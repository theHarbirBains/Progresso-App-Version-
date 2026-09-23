import { renderHook } from '@testing-library/react-native';
import { useProfile, type ProfileContextValue } from '../profile/ProfileProvider';
import type { ProfileResponse } from '../lib/api';
import { DEFAULT_NUTRITION_THEME, DEFAULT_WORKOUT_THEME } from '../theme/accentColor';
import { useProgressTheme } from './useProgressTheme';

jest.mock('../profile/ProfileProvider', () => ({
  useProfile: jest.fn(),
}));

const mockUseProfile = useProfile as jest.Mock;

function profileContext(overrides: Partial<ProfileContextValue> = {}): ProfileContextValue {
  return {
    profile: null,
    loading: false,
    error: null,
    refetch: jest.fn(),
    updateProfile: jest.fn(),
    ...overrides,
  };
}

describe('useProgressTheme', () => {
  it("derives its fields from the shared ProfileProvider cache -- no fetch of its own", () => {
    mockUseProfile.mockReturnValue(
      profileContext({
        profile: {
          workoutAccentColor: '#EF4444',
          nutritionAccentColor: '#EF4444',
          weightUnit: 'lb',
          activeWorkoutSplitId: 'split-1',
          displayName: 'Harbir Bains',
          username: 'harbir',
          avatarUrl: 'https://example.com/avatar.jpg',
        } as ProfileResponse,
        loading: false,
      }),
    );

    const { result } = renderHook(() => useProgressTheme());

    expect(result.current.themeLoading).toBe(false);
    expect(result.current.weightUnit).toBe('lb');
    expect(result.current.activeWorkoutSplitId).toBe('split-1');
    expect(result.current.displayName).toBe('Harbir Bains');
    expect(result.current.username).toBe('harbir');
    expect(result.current.avatarUrl).toBe('https://example.com/avatar.jpg');
  });

  it('keeps the fixed default theme -- app-wide black-and-white, unconditional even when the cached profile has a saved custom accent', () => {
    mockUseProfile.mockReturnValue(
      profileContext({
        profile: {
          workoutAccentColor: '#EF4444',
          nutritionAccentColor: '#EF4444',
        } as ProfileResponse,
      }),
    );

    const { result } = renderHook(() => useProgressTheme());

    expect(result.current.theme).toBe(DEFAULT_WORKOUT_THEME);
    expect(result.current.nutritionTheme).toBe(DEFAULT_NUTRITION_THEME);
  });

  it('falls back to safe defaults, without throwing, while the shared cache has no profile yet', () => {
    mockUseProfile.mockReturnValue(profileContext({ profile: null, loading: true }));

    const { result } = renderHook(() => useProgressTheme());

    expect(result.current.themeLoading).toBe(true);
    expect(result.current.theme).toBe(DEFAULT_WORKOUT_THEME);
    expect(result.current.nutritionTheme).toBe(DEFAULT_NUTRITION_THEME);
    expect(result.current.weightUnit).toBe('kg');
    expect(result.current.activeWorkoutSplitId).toBeNull();
    expect(result.current.displayName).toBeNull();
    expect(result.current.username).toBeNull();
    expect(result.current.avatarUrl).toBeNull();
  });

  it('falls back to the same safe defaults if the shared fetch failed rather than throwing', () => {
    mockUseProfile.mockReturnValue(
      profileContext({ profile: null, loading: false, error: 'User profile not found' }),
    );

    const { result } = renderHook(() => useProgressTheme());

    expect(result.current.themeLoading).toBe(false);
    expect(result.current.theme).toBe(DEFAULT_WORKOUT_THEME);
    expect(result.current.weightUnit).toBe('kg');
    expect(result.current.activeWorkoutSplitId).toBeNull();
  });
});
