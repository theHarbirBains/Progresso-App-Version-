import AsyncStorage from '@react-native-async-storage/async-storage';
import { act, renderHook, waitFor } from '@testing-library/react-native';
import type { PropsWithChildren } from 'react';
import { useProfile } from '../profile/ProfileProvider';
import { useAppTheme } from './appThemeContext';
import { AppThemeProvider } from './AppThemeProvider';

jest.mock('../profile/ProfileProvider', () => ({ useProfile: jest.fn() }));

const mockUseProfile = useProfile as jest.Mock;
const KEY = '@progresso/appearance';

function wrapper({ children }: PropsWithChildren) {
  return <AppThemeProvider>{children}</AppThemeProvider>;
}

beforeEach(async () => {
  await AsyncStorage.clear();
  mockUseProfile.mockReturnValue({ profile: { country: 'CA' } });
});

afterEach(() => {
  jest.useRealTimers();
});

describe('AppThemeProvider', () => {
  it('starts on Golden Hour Gym, and says when the saved choice has been read', async () => {
    const { result } = renderHook(() => useAppTheme(), { wrapper });

    expect(result.current.loaded).toBe(false);
    await waitFor(() => expect(result.current.loaded).toBe(true));
    expect(result.current.theme.id).toBe('golden-hour-gym');
    expect(result.current.accent.accent).toBe('#D99A50');
  });

  it('applies a chosen theme at once and keeps it on the phone', async () => {
    const { result } = renderHook(() => useAppTheme(), { wrapper });
    await waitFor(() => expect(result.current.loaded).toBe(true));

    act(() => result.current.choose('forest'));

    expect(result.current.theme.id).toBe('forest');
    expect(result.current.accent.accent).toBe('#9DBF7A');
    await waitFor(async () =>
      expect(JSON.parse((await AsyncStorage.getItem(KEY))!)).toEqual({
        themeId: 'forest',
        followSeasons: false,
      }),
    );
  });

  it('opens on the theme saved last time', async () => {
    await AsyncStorage.setItem(KEY, JSON.stringify({ themeId: 'coast', followSeasons: false }));

    const { result } = renderHook(() => useAppTheme(), { wrapper });

    await waitFor(() => expect(result.current.loaded).toBe(true));
    expect(result.current.theme.id).toBe('coast');
  });

  it('ignores a saved value it doesn’t know', async () => {
    await AsyncStorage.setItem(KEY, JSON.stringify({ themeId: 'midnight', followSeasons: 'yes' }));

    const { result } = renderHook(() => useAppTheme(), { wrapper });

    await waitFor(() => expect(result.current.loaded).toBe(true));
    expect(result.current.theme.id).toBe('golden-hour-gym');
    expect(result.current.followSeasons).toBe(false);
  });

  it('shows the season where the person lives only while following the seasons', async () => {
    // Only the clock is faked: 25 October.
    jest.useFakeTimers({
      now: new Date(2026, 9, 25),
      doNotFake: [
        'setTimeout',
        'clearTimeout',
        'setInterval',
        'clearInterval',
        'setImmediate',
        'clearImmediate',
        'nextTick',
        'queueMicrotask',
        'requestAnimationFrame',
        'cancelAnimationFrame',
        'requestIdleCallback',
        'cancelIdleCallback',
        'hrtime',
        'performance',
      ],
    });
    const { result } = renderHook(() => useAppTheme(), { wrapper });
    await waitFor(() => expect(result.current.loaded).toBe(true));

    act(() => result.current.setFollowSeasons(true));
    expect(result.current.theme.id).toBe('autumn');

    mockUseProfile.mockReturnValue({ profile: { country: 'AU' } });
    const southern = renderHook(() => useAppTheme(), { wrapper });
    await waitFor(() => expect(southern.result.current.loaded).toBe(true));
    expect(southern.result.current.theme.id).toBe('spring');
  });

  it('stops following the seasons when a theme is picked, so the pick shows', async () => {
    const { result } = renderHook(() => useAppTheme(), { wrapper });
    await waitFor(() => expect(result.current.loaded).toBe(true));
    act(() => result.current.setFollowSeasons(true));

    act(() => result.current.choose('alpine'));

    expect(result.current.followSeasons).toBe(false);
    expect(result.current.theme.id).toBe('alpine');
  });
});
