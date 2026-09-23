import { act, render, renderHook, waitFor } from '@testing-library/react-native';
import { useAuth } from '../auth/AuthProvider';
import { getMyProfile, updateMyProfile } from '../lib/api';
import { ProfileProvider, useProfile } from './ProfileProvider';

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

const baseProfile = {
  id: 'user-1',
  email: 'a@example.com',
  role: 'user',
  displayName: 'Harbir',
  username: 'harbir',
  weightUnit: 'kg' as const,
  workoutAccentColor: null,
  nutritionAccentColor: null,
};

beforeEach(() => {
  mockUseAuth.mockReturnValue({ session: { access_token: 'token-123' } });
  mockGetMyProfile.mockReset().mockResolvedValue(baseProfile);
  mockUpdateMyProfile.mockReset();
});

describe('ProfileProvider', () => {
  it('fetches the profile once and exposes it', async () => {
    const { result } = renderHook(() => useProfile(), { wrapper: ProfileProvider });

    expect(result.current.loading).toBe(true);
    await waitFor(() => expect(result.current.loading).toBe(false));

    expect(result.current.profile).toEqual(baseProfile);
    expect(result.current.error).toBeNull();
    expect(mockGetMyProfile).toHaveBeenCalledWith('token-123');
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

    await waitFor(() => expect(mockGetMyProfile).toHaveBeenCalledTimes(1));
    // Give any accidental second effect a chance to fire before asserting
    // it never does.
    await act(async () => {});
    expect(mockGetMyProfile).toHaveBeenCalledTimes(1);
  });

  it('does not fetch while signed out, and leaves profile null', async () => {
    mockUseAuth.mockReturnValue({ session: null });

    const { result } = renderHook(() => useProfile(), { wrapper: ProfileProvider });

    expect(result.current.profile).toBeNull();
    expect(mockGetMyProfile).not.toHaveBeenCalled();
  });

  it('clears the cached profile on sign-out, so a later sign-in never flashes the previous account', async () => {
    const { result, rerender } = renderHook(() => useProfile(), { wrapper: ProfileProvider });
    await waitFor(() => expect(result.current.profile).toEqual(baseProfile));

    mockUseAuth.mockReturnValue({ session: null });
    rerender({});

    expect(result.current.profile).toBeNull();
    expect(result.current.loading).toBe(true);
  });

  it('sets error, without throwing, when the fetch fails', async () => {
    mockGetMyProfile.mockRejectedValue(new Error('network down'));

    const { result } = renderHook(() => useProfile(), { wrapper: ProfileProvider });

    await waitFor(() => expect(result.current.loading).toBe(false));
    expect(result.current.error).toBe('network down');
    expect(result.current.profile).toBeNull();
  });

  it('updateProfile saves via updateMyProfile and updates the cache from its response -- no second fetch', async () => {
    mockUpdateMyProfile.mockResolvedValue({ ...baseProfile, displayName: 'New Name' });

    const { result } = renderHook(() => useProfile(), { wrapper: ProfileProvider });
    await waitFor(() => expect(result.current.loading).toBe(false));
    mockGetMyProfile.mockClear();

    await act(async () => {
      await result.current.updateProfile({ displayName: 'New Name' });
    });

    expect(mockUpdateMyProfile).toHaveBeenCalledWith('token-123', { displayName: 'New Name' });
    expect(result.current.profile?.displayName).toBe('New Name');
    expect(mockGetMyProfile).not.toHaveBeenCalled();
  });

  it('refetch re-fetches from the server', async () => {
    const { result } = renderHook(() => useProfile(), { wrapper: ProfileProvider });
    await waitFor(() => expect(result.current.loading).toBe(false));

    mockGetMyProfile.mockResolvedValue({ ...baseProfile, displayName: 'Refetched' });
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
