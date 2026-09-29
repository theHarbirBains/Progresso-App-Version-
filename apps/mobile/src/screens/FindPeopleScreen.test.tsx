import { act, fireEvent, render, screen } from '@testing-library/react-native';
import { expectNoBareText } from '../testUtils/expectNoBareText';
import { useAuth } from '../auth/AuthProvider';
import {
  listFollowRequests,
  respondToFollowRequest,
  searchUsers,
  sendFollowRequest,
  unfollowUser,
} from '../lib/api';
import { FindPeopleScreen } from './FindPeopleScreen';

jest.mock('../auth/AuthProvider', () => ({
  useAuth: jest.fn(),
}));

jest.mock('../lib/api', () => ({
  listFollowRequests: jest.fn(),
  respondToFollowRequest: jest.fn(),
  searchUsers: jest.fn(),
  sendFollowRequest: jest.fn(),
  unfollowUser: jest.fn(),
}));

const mockUseAuth = useAuth as jest.Mock;
const mockListFollowRequests = listFollowRequests as jest.Mock;
const mockRespondToFollowRequest = respondToFollowRequest as jest.Mock;
const mockSearchUsers = searchUsers as jest.Mock;
const mockSendFollowRequest = sendFollowRequest as jest.Mock;
const mockUnfollowUser = unfollowUser as jest.Mock;

const mockGoBack = jest.fn();
// eslint-disable-next-line @typescript-eslint/no-explicit-any
const navigation: any = {
  goBack: mockGoBack,
  addListener: jest.fn((event: string, cb: () => void) => {
    if (event === 'focus') cb();
    return jest.fn();
  }),
};
const route = {} as never;

const janeRequest = {
  followId: 'follow-1',
  createdAt: '2026-01-01T00:00:00Z',
  user: { id: 'user-2', username: 'jane', displayName: 'Jane Doe', avatarUrl: null },
};

const bobResult = {
  user: { id: 'user-3', username: 'bob', displayName: 'Bob Smith', avatarUrl: null },
  status: 'none' as const,
};

async function typeSearch(text: string) {
  fireEvent.changeText(screen.getByTestId('find-people-search-input'), text);
  await act(async () => {
    jest.advanceTimersByTime(300);
    await Promise.resolve();
  });
}

function renderScreen() {
  return render(<FindPeopleScreen navigation={navigation} route={route} />);
}

beforeEach(() => {
  jest.useFakeTimers();
  mockUseAuth.mockReturnValue({
    user: { id: 'user-1' },
    session: { access_token: 'token-123' },
  });
  mockListFollowRequests.mockReset().mockResolvedValue([]);
  mockRespondToFollowRequest.mockReset().mockResolvedValue({ success: true });
  mockSearchUsers.mockReset().mockResolvedValue([]);
  mockSendFollowRequest.mockReset().mockResolvedValue({ status: 'pending' });
  mockUnfollowUser.mockReset().mockResolvedValue({ success: true });
  mockGoBack.mockClear();
});

afterEach(() => {
  jest.useRealTimers();
});

describe('FindPeopleScreen -- requests', () => {
  it('shows an incoming follow request with Accept/Reject', async () => {
    mockListFollowRequests.mockResolvedValue([janeRequest]);
    renderScreen();

    const row = await screen.findByTestId('find-people-request-follow-1');
    expect(row).toHaveTextContent(/Jane Doe/);
    expect(screen.getByTestId('find-people-request-follow-1-accept')).toBeTruthy();
    expect(screen.getByTestId('find-people-request-follow-1-reject')).toBeTruthy();
  });

  it('accepting removes the request and calls the backend with "accept"', async () => {
    mockListFollowRequests.mockResolvedValue([janeRequest]);
    renderScreen();
    await screen.findByTestId('find-people-request-follow-1');

    fireEvent.press(screen.getByTestId('find-people-request-follow-1-accept'));

    expect(mockRespondToFollowRequest).toHaveBeenCalledWith('token-123', 'follow-1', 'accept');
    await act(async () => {
      await Promise.resolve();
    });
    expect(screen.queryByTestId('find-people-request-follow-1')).toBeNull();
  });

  it('rejecting removes the request and calls the backend with "reject"', async () => {
    mockListFollowRequests.mockResolvedValue([janeRequest]);
    renderScreen();
    await screen.findByTestId('find-people-request-follow-1');

    fireEvent.press(screen.getByTestId('find-people-request-follow-1-reject'));

    expect(mockRespondToFollowRequest).toHaveBeenCalledWith('token-123', 'follow-1', 'reject');
    await act(async () => {
      await Promise.resolve();
    });
    expect(screen.queryByTestId('find-people-request-follow-1')).toBeNull();
  });

  it('shows nothing extra when there are no pending requests', async () => {
    renderScreen();
    await act(async () => {
      await Promise.resolve();
    });

    expect(screen.queryByTestId('find-people-requests-card')).toBeNull();
  });

  it('shows an error state with a working retry when requests fail to load', async () => {
    mockListFollowRequests.mockRejectedValueOnce(new Error('network error'));
    renderScreen();

    expect(await screen.findByTestId('find-people-requests-error')).toHaveTextContent(
      'network error',
    );

    mockListFollowRequests.mockResolvedValue([janeRequest]);
    fireEvent.press(screen.getByTestId('find-people-requests-error-retry'));

    expect(await screen.findByTestId('find-people-request-follow-1')).toBeTruthy();
  });
});

describe('FindPeopleScreen -- search', () => {
  it('shows an initial prompt before anything has been searched', async () => {
    renderScreen();
    await act(async () => {
      await Promise.resolve();
    });

    expect(screen.getByTestId('find-people-empty-initial')).toBeTruthy();
    expect(mockSearchUsers).not.toHaveBeenCalled();
  });

  it('debounces input and searches via the backend', async () => {
    mockSearchUsers.mockResolvedValue([bobResult]);
    renderScreen();

    await typeSearch('bob');

    expect(mockSearchUsers).toHaveBeenCalledWith('token-123', 'bob');
    expect(await screen.findByTestId('find-people-result-user-3')).toHaveTextContent(/Bob Smith/);
  });

  it('shows a Follow button for someone not yet followed', async () => {
    mockSearchUsers.mockResolvedValue([bobResult]);
    renderScreen();
    await typeSearch('bob');

    expect(await screen.findByTestId('find-people-result-user-3-follow')).toBeTruthy();
  });

  it('following sends a request and the button flips to Requested', async () => {
    mockSearchUsers.mockResolvedValue([bobResult]);
    mockSendFollowRequest.mockResolvedValue({ status: 'pending' });
    renderScreen();
    await typeSearch('bob');
    await screen.findByTestId('find-people-result-user-3-follow');

    fireEvent.press(screen.getByTestId('find-people-result-user-3-follow'));

    expect(mockSendFollowRequest).toHaveBeenCalledWith('token-123', 'user-3');
    expect(await screen.findByTestId('find-people-result-user-3-requested')).toBeTruthy();
  });

  it('shows a Following button for an already-accepted follow, and unfollowing reverts it to Follow', async () => {
    mockSearchUsers.mockResolvedValue([{ ...bobResult, status: 'accepted' }]);
    renderScreen();
    await typeSearch('bob');
    await screen.findByTestId('find-people-result-user-3-following');

    fireEvent.press(screen.getByTestId('find-people-result-user-3-following'));

    expect(mockUnfollowUser).toHaveBeenCalledWith('token-123', 'user-3');
    expect(await screen.findByTestId('find-people-result-user-3-follow')).toBeTruthy();
  });

  it('shows an empty state when no one matches', async () => {
    mockSearchUsers.mockResolvedValue([]);
    renderScreen();

    await typeSearch('zzz');

    expect(screen.getByTestId('find-people-empty-results')).toHaveTextContent(
      'No one found for "zzz"',
    );
  });

  it('shows an error state with a working retry', async () => {
    mockSearchUsers.mockRejectedValueOnce(new Error('network error'));
    renderScreen();

    await typeSearch('bob');

    expect(await screen.findByTestId('find-people-search-error')).toHaveTextContent(
      'network error',
    );

    mockSearchUsers.mockResolvedValue([bobResult]);
    fireEvent.press(screen.getByTestId('find-people-search-error-retry'));

    expect(await screen.findByTestId('find-people-result-user-3')).toBeTruthy();
  });
});

describe('FindPeopleScreen -- misc', () => {
  it('goes back via the header', async () => {
    renderScreen();
    await act(async () => {
      await Promise.resolve();
    });

    fireEvent.press(screen.getByTestId('app-header-back'));

    expect(mockGoBack).toHaveBeenCalledWith();
  });

  it('renders no bare text outside <Text>', async () => {
    mockListFollowRequests.mockResolvedValue([janeRequest]);
    mockSearchUsers.mockResolvedValue([bobResult]);
    renderScreen();
    await screen.findByTestId('find-people-request-follow-1');
    await typeSearch('bob');
    await screen.findByTestId('find-people-result-user-3');

    expectNoBareText();
  });
});
