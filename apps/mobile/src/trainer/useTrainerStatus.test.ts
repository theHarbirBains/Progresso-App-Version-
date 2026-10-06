import { renderHook, waitFor } from '@testing-library/react-native';
import { useAuth } from '../auth/AuthProvider';
import { claimTrainerInvites, getTrainerStatus } from '../lib/api';
import { useTrainerStatus } from './useTrainerStatus';

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
});
