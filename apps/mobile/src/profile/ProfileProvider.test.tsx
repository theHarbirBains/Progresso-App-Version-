import { act, render, renderHook, waitFor } from '@testing-library/react-native';
import { useAuth } from '../auth/AuthProvider';
import { updateMyProfile } from '../lib/api';
import { ProfileProvider, useProfile } from './ProfileProvider';
import { fetchMyProfile } from './profileQueries';

jest.mock('../auth/AuthProvider', () => ({
  useAuth: jest.fn(),
}));

jest.mock('../lib/api', () => ({
  updateMyProfile: jest.fn(),
}));

jest.mock('./profileQueries', () => ({
  fetchMyProfile: jest.fn(),
}));

const mockUseAuth = useAuth as jest.Mock;
const mockFetchMyProfile = fetchMyProfile as jest.Mock;
const mockUpdateMyProfile = updateMyProfile as jest.Mock;

const baseProfile = {
  id: 'user-1',
  displayName: 'Harbir',
  username: 'harbir',
  weightUnit: 'kg' as const,
  workoutAccentColor: null,
  nutritionAccentColor: null,
};

const signedIn = { session: { access_token: 'token-123' }, user: { id: 'user-1' } };

beforeEach(() => {
  mockUseAuth.mockReturnValue(signedIn);
  mockFetchMyProfile.mockReset().mockResolvedValue(baseProfile);
  mockUpdateMyProfile.mockReset();
});

describe('ProfileProvider', () => {
  it('fetches the profile once and exposes it', async () => {
    const { result } = renderHook(() => useProfile(), { wrapper: ProfileProvider });

    expect(result.current.loading).toBe(true);
    await waitFor(() => expect(result.current.loading).toBe(false));

    expect(result.current.profile).toEqual(baseProfile);
    expect(result.current.error).toBeNull();
    expect(mockFetchMyProfile).toHaveBeenCalledWith('user-1');
  });

  it('does not refetch when only the access token refreshes', async () => {
    const { result, rerender } = renderHook(() => useProfile(), { wrapper: ProfileProvider });
    await waitFor(() => expect(result.current.loading).toBe(false));

    mockUseAuth.mockReturnValue({ ...signedIn, session: { access_token: 'token-456' } });
    rerender({});
    await act(async () => {});

    expect(mockFetchMyProfile).toHaveBeenCalledTimes(1);
    expect(result.current.profile).toEqual(baseProfile);
  });

  it('saves with the current access token after a token refresh', async () => {
    mockUpdateMyProfile.mockResolvedValue({ ...baseProfile, displayName: 'New Name' });
    const { result, rerender } = renderHook(() => useProfile(), { wrapper: ProfileProvider });
    await waitFor(() => expect(result.current.loading).toBe(false));

    mockUseAuth.mockReturnValue({ ...signedIn, session: { access_token: 'token-456' } });
    rerender({});
    await act(async () => {
      await result.current.updateProfile({ displayName: 'New Name' });
    });

    expect(mockUpdateMyProfile).toHaveBeenCalledWith('token-456', { displayName: 'New Name' });
  });

  // The entire point of this provider: previously, every screen using
  // useProgressTheme fetched its own copy of the profile independently --
  // 20+ redundant requests across a single session. Two consumers reading
  // the same context must only cost one fetch.
  it('fetches only once, even with multiple consumers reading the same context', async () => {
    function ConsumerA() {
      useProfile();
      return null;
    }
    function ConsumerB() {
      useProfile();
      return null;
    }

    render(
      <ProfileProvider>
        <ConsumerA />
        <ConsumerB />
      </ProfileProvider>,
    );

    await waitFor(() => expect(mockFetchMyProfile).toHaveBeenCalledTimes(1));
    // Give any accidental second effect a chance to fire before asserting
    // it never does.
    await act(async () => {});
    expect(mockFetchMyProfile).toHaveBeenCalledTimes(1);
  });

  it('does not fetch while signed out, and leaves profile null', async () => {
    mockUseAuth.mockReturnValue({ session: null, user: null });

    const { result } = renderHook(() => useProfile(), { wrapper: ProfileProvider });

    expect(result.current.profile).toBeNull();
    expect(mockFetchMyProfile).not.toHaveBeenCalled();
  });

  it('clears the cached profile on sign-out, so a later sign-in never flashes the previous account', async () => {
    const { result, rerender } = renderHook(() => useProfile(), { wrapper: ProfileProvider });
    await waitFor(() => expect(result.current.profile).toEqual(baseProfile));

    mockUseAuth.mockReturnValue({ session: null, user: null });
    rerender({});

    expect(result.current.profile).toBeNull();
    expect(result.current.loading).toBe(true);
  });

  it('sets error, without throwing, when the fetch fails', async () => {
    mockFetchMyProfile.mockRejectedValue(new Error('network down'));

    const { result } = renderHook(() => useProfile(), { wrapper: ProfileProvider });

    await waitFor(() => expect(result.current.loading).toBe(false));
    expect(result.current.error).toBe('network down');
    expect(result.current.profile).toBeNull();
  });

  it('updateProfile saves via updateMyProfile and updates the cache from its response -- no second fetch', async () => {
    mockUpdateMyProfile.mockResolvedValue({ ...baseProfile, displayName: 'New Name' });

    const { result } = renderHook(() => useProfile(), { wrapper: ProfileProvider });
    await waitFor(() => expect(result.current.loading).toBe(false));
    mockFetchMyProfile.mockClear();

    await act(async () => {
      await result.current.updateProfile({ displayName: 'New Name' });
    });

    expect(mockUpdateMyProfile).toHaveBeenCalledWith('token-123', { displayName: 'New Name' });
    expect(result.current.profile?.displayName).toBe('New Name');
    expect(mockFetchMyProfile).not.toHaveBeenCalled();
  });

  it('refetch re-fetches from the server', async () => {
    const { result } = renderHook(() => useProfile(), { wrapper: ProfileProvider });
    await waitFor(() => expect(result.current.loading).toBe(false));

    mockFetchMyProfile.mockResolvedValue({ ...baseProfile, displayName: 'Refetched' });
    await act(async () => {
      await result.current.refetch();
    });

    expect(result.current.profile?.displayName).toBe('Refetched');
  });

  it('throws a clear error when used outside a ProfileProvider', () => {
    // Suppress React's own noisy console.error for the expected render throw.
    const consoleError = jest.spyOn(console, 'error').mockImplementation(() => {});
    expect(() => renderHook(() => useProfile())).toThrow(
      'useProfile must be used within a ProfileProvider',
    );
    consoleError.mockRestore();
  });
});
