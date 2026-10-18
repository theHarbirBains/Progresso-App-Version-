import { AppState } from 'react-native';
import { act, renderHook, waitFor } from '@testing-library/react-native';
import { useAuth } from '../auth/AuthProvider';
import { claimTrainerInvites, getTrainerStatus } from '../lib/api';
import { TRAINER_STATUS_RETRY_DELAYS_MS, useTrainerStatus } from './useTrainerStatus';

jest.mock('../auth/AuthProvider', () => ({
  useAuth: jest.fn(),
}));

jest.mock('../lib/api', () => ({
  claimTrainerInvites: jest.fn(),
  getTrainerStatus: jest.fn(),
}));

const mockUseAuth = useAuth as jest.Mock;
const mockClaim = claimTrainerInvites as jest.Mock;
const mockStatus = getTrainerStatus as jest.Mock;

beforeEach(() => {
  mockUseAuth.mockReset();
  mockClaim.mockReset().mockResolvedValue({ claimed: 0 });
  mockStatus.mockReset();
});

describe('useTrainerStatus', () => {
  it('attaches waiting invites, then reports that this person is a trainer', async () => {
    mockUseAuth.mockReturnValue({ session: { access_token: 'token-1' }, user: { id: 'u1' } });
    mockStatus.mockResolvedValue({ isTrainer: true });

    const { result } = renderHook(() => useTrainerStatus());

    await waitFor(() => expect(result.current).toBe(true));
    expect(mockClaim).toHaveBeenCalledWith('token-1');
    expect(mockClaim.mock.invocationCallOrder[0]).toBeLessThan(
      mockStatus.mock.invocationCallOrder[0],
    );
  });

  it('keeps the trainer entries hidden, and does not fail, when the status check errors', async () => {
    mockUseAuth.mockReturnValue({ session: { access_token: 'token-1' }, user: { id: 'u1' } });
    mockStatus.mockRejectedValue(new Error('offline'));

    const { result } = renderHook(() => useTrainerStatus());

    await waitFor(() => expect(mockStatus).toHaveBeenCalled());
    expect(result.current).toBe(false);
  });

  it('does nothing while signed out', () => {
    mockUseAuth.mockReturnValue({ session: null, user: null });

    const { result } = renderHook(() => useTrainerStatus());

    expect(result.current).toBe(false);
    expect(mockClaim).not.toHaveBeenCalled();
    expect(mockStatus).not.toHaveBeenCalled();
  });

  it('does not call the API again when only the access token refreshes', async () => {
    mockUseAuth.mockReturnValue({ session: { access_token: 'token-1' }, user: { id: 'u1' } });
    mockStatus.mockResolvedValue({ isTrainer: true });
    const { result, rerender } = renderHook(() => useTrainerStatus());
    await waitFor(() => expect(result.current).toBe(true));

    mockUseAuth.mockReturnValue({ session: { access_token: 'token-2' }, user: { id: 'u1' } });
    rerender({});

    expect(mockClaim).toHaveBeenCalledTimes(1);
    expect(mockStatus).toHaveBeenCalledTimes(1);
    expect(result.current).toBe(true);
  });

  it('checks again, with the new token, when a different person signs in', async () => {
    mockUseAuth.mockReturnValue({ session: { access_token: 'token-1' }, user: { id: 'u1' } });
    mockStatus
      .mockResolvedValueOnce({ isTrainer: true })
      .mockResolvedValueOnce({ isTrainer: false });
    const { result, rerender } = renderHook(() => useTrainerStatus());
    await waitFor(() => expect(result.current).toBe(true));

    mockUseAuth.mockReturnValue({ session: { access_token: 'token-9' }, user: { id: 'u2' } });
    rerender({});

    await waitFor(() => expect(result.current).toBe(false));
    expect(mockStatus).toHaveBeenLastCalledWith('token-9');
  });

  describe('after a failed check', () => {
    beforeEach(() => jest.useFakeTimers());
    afterEach(() => jest.useRealTimers());

    it('tries again, so a trainer whose first check failed still gets trainer mode', async () => {
      mockUseAuth.mockReturnValue({ session: { access_token: 'token-1' }, user: { id: 'u1' } });
      mockStatus
        .mockRejectedValueOnce(new Error('cold start'))
        .mockResolvedValueOnce({ isTrainer: true });
      const { result } = renderHook(() => useTrainerStatus());
      await act(async () => {});
      expect(result.current).toBe(false);

      await act(async () => {
        await jest.advanceTimersByTimeAsync(TRAINER_STATUS_RETRY_DELAYS_MS[0]!);
      });

      expect(result.current).toBe(true);
      expect(mockStatus).toHaveBeenCalledTimes(2);
      // The invite claim succeeded the first time, so it isn't repeated.
      expect(mockClaim).toHaveBeenCalledTimes(1);
    });

    it('stops after a few tries, and tries again when the app returns to the foreground', async () => {
      mockUseAuth.mockReturnValue({ session: { access_token: 'token-1' }, user: { id: 'u1' } });
      mockStatus.mockRejectedValue(new Error('offline'));
      const listeners: ((state: string) => void)[] = [];
      const addListener = jest
        .spyOn(AppState, 'addEventListener')
        .mockImplementation((_type, listener) => {
          listeners.push(listener as (state: string) => void);
          return { remove: jest.fn() } as never;
        });
      const { result } = renderHook(() => useTrainerStatus());

      await act(async () => {
        await jest.runAllTimersAsync();
      });
      expect(mockStatus).toHaveBeenCalledTimes(1 + TRAINER_STATUS_RETRY_DELAYS_MS.length);

      mockStatus.mockResolvedValue({ isTrainer: true });
      await act(async () => {
        listeners.forEach((listener) => listener('active'));
      });

      expect(result.current).toBe(true);
      addListener.mockRestore();
    });
  });
});
