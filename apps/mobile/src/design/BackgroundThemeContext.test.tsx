import { act, renderHook, waitFor } from '@testing-library/react-native';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { useAuth } from '../auth/AuthProvider';
import { getMyProfile, updateMyProfile } from '../lib/api';
import { DEFAULT_BACKGROUND_THEME } from './backgroundThemes';
import { BackgroundThemeProvider, useBackgroundTheme } from './BackgroundThemeContext';

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

const STORAGE_KEY = '@progresso/backgroundTheme';

beforeEach(async () => {
  mockUseAuth.mockReturnValue({ session: { access_token: 'token-123' } });
  mockGetMyProfile.mockReset().mockResolvedValue({ backgroundTheme: null });
  mockUpdateMyProfile.mockReset().mockResolvedValue({});
  await AsyncStorage.clear();
});

function renderInProvider() {
  return renderHook(() => useBackgroundTheme(), {
    wrapper: ({ children }) => <BackgroundThemeProvider>{children}</BackgroundThemeProvider>,
  });
}

describe('BackgroundThemeContext', () => {
  it('defaults to Obsidian and becomes ready once the local cache has been checked', async () => {
    const { result } = renderInProvider();

    await waitFor(() => expect(result.current.ready).toBe(true));
    expect(result.current.themeId).toBe(DEFAULT_BACKGROUND_THEME);
    expect(result.current.theme.id).toBe('obsidian');
  });

  it('restores the theme from the local cache instantly, without waiting on the profile fetch', async () => {
    await AsyncStorage.setItem(STORAGE_KEY, 'midnight');
    // Never resolves -- proves the cache alone is enough to pick a theme.
    mockGetMyProfile.mockReturnValue(new Promise(() => {}));

    const { result } = renderInProvider();

    await waitFor(() => expect(result.current.ready).toBe(true));
    expect(result.current.themeId).toBe('midnight');
  });

  it('reconciles with the backend profile once signed in, overriding a stale local cache', async () => {
    await AsyncStorage.setItem(STORAGE_KEY, 'midnight');
    mockGetMyProfile.mockResolvedValue({ backgroundTheme: 'forest' });

    const { result } = renderInProvider();

    await waitFor(() => expect(result.current.themeId).toBe('forest'));
    expect(await AsyncStorage.getItem(STORAGE_KEY)).toBe('forest');
  });

  it('ignores an invalid/unknown value from the profile rather than crashing', async () => {
    mockGetMyProfile.mockResolvedValue({ backgroundTheme: 'not-a-real-theme' });

    const { result } = renderInProvider();

    await waitFor(() => expect(result.current.ready).toBe(true));
    expect(result.current.themeId).toBe(DEFAULT_BACKGROUND_THEME);
  });

  it('setThemeId applies instantly (before the backend call resolves) and persists both locally and remotely', async () => {
    let resolveUpdate!: () => void;
    mockUpdateMyProfile.mockReturnValue(
      new Promise((resolve) => {
        resolveUpdate = () => resolve({});
      }),
    );

    const { result } = renderInProvider();
    await waitFor(() => expect(result.current.ready).toBe(true));

    let applyPromise!: Promise<void>;
    act(() => {
      applyPromise = result.current.setThemeId('plum');
    });
    await waitFor(() => expect(result.current.themeId).toBe('plum'));
    expect(mockUpdateMyProfile).toHaveBeenCalledWith('token-123', { backgroundTheme: 'plum' });

    await act(async () => {
      resolveUpdate();
      await applyPromise;
    });
    expect(await AsyncStorage.getItem(STORAGE_KEY)).toBe('plum');
  });
});
