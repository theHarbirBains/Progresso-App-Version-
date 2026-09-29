import { act, fireEvent, render, screen } from '@testing-library/react-native';
import { Share } from 'react-native';
import { expectNoBareText } from '../testUtils/expectNoBareText';
import { useAuth } from '../auth/AuthProvider';
import {
  listFollowRequests,
  listSuggestedUsers,
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
  listSuggestedUsers: jest.fn(),
  respondToFollowRequest: jest.fn(),
  searchUsers: jest.fn(),
  sendFollowRequest: jest.fn(),
  unfollowUser: jest.fn(),
}));

const mockUseAuth = useAuth as jest.Mock;
const mockListFollowRequests = listFollowRequests as jest.Mock;
const mockListSuggestedUsers = listSuggestedUsers as jest.Mock;
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
  mockListSuggestedUsers.mockReset().mockResolvedValue([]);
  mockRespondToFollowRequest.mockReset().mockResolvedValue({ success: true });
  mockSearchUsers.mockReset().mockResolvedValue([]);
  mockSendFollowRequest.mockReset().mockResolvedValue({ status: 'pending' });
  mockUnfollowUser.mockReset().mockResolvedValue({ success: true });
  mockGoBack.mockClear();
});

afterEach(() => {
  jest.useRealTimers();
});

describe('FindPeopleScreen -- requests tab', () => {
  it('badges the Requests tab with the pending count', async () => {
    mockListFollowRequests.mockResolvedValue([janeRequest]);
    renderScreen();

    expect(await screen.findByTestId('find-people-tab-requests')).toHaveTextContent(
      /Requests \(1\)/,
    );
  });

  it('shows an incoming follow request with Accept/Reject once the tab is opened', async () => {
    mockListFollowRequests.mockResolvedValue([janeRequest]);
    renderScreen();
    await screen.findByTestId('find-people-tab-requests');
    fireEvent.press(screen.getByTestId('find-people-tab-requests'));

    const row = await screen.findByTestId('find-people-request-follow-1');
    expect(row).toHaveTextContent(/Jane Doe/);
    expect(screen.getByTestId('find-people-request-follow-1-accept')).toBeTruthy();
    expect(screen.getByTestId('find-people-request-follow-1-reject')).toBeTruthy();
  });

  it('accepting removes the request and calls the backend with "accept"', async () => {
    mockListFollowRequests.mockResolvedValue([janeRequest]);
    renderScreen();
    fireEvent.press(screen.getByTestId('find-people-tab-requests'));
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
    fireEvent.press(screen.getByTestId('find-people-tab-requests'));
    await screen.findByTestId('find-people-request-follow-1');

    fireEvent.press(screen.getByTestId('find-people-request-follow-1-reject'));

    expect(mockRespondToFollowRequest).toHaveBeenCalledWith('token-123', 'follow-1', 'reject');
    await act(async () => {
      await Promise.resolve();
    });
    expect(screen.queryByTestId('find-people-request-follow-1')).toBeNull();
  });

  it('shows an honest empty state when there are no pending requests', async () => {
    renderScreen();
    fireEvent.press(screen.getByTestId('find-people-tab-requests'));

    expect(await screen.findByTestId('find-people-requests-empty')).toBeTruthy();
  });

  it('shows an error state with a working retry when requests fail to load', async () => {
    mockListFollowRequests.mockRejectedValueOnce(new Error('network error'));
    renderScreen();
    fireEvent.press(screen.getByTestId('find-people-tab-requests'));

    expect(await screen.findByTestId('find-people-requests-error')).toHaveTextContent(
      'network error',
    );

    mockListFollowRequests.mockResolvedValue([janeRequest]);
    fireEvent.press(screen.getByTestId('find-people-requests-error-retry'));

    expect(await screen.findByTestId('find-people-request-follow-1')).toBeTruthy();
  });
});

describe('FindPeopleScreen -- Suggested/Contacts (shown when search is empty)', () => {
  it('defaults to the Suggested sub-tab and shows real suggested people, no search performed', async () => {
    mockListSuggestedUsers.mockResolvedValue([bobResult]);
    renderScreen();

    expect(await screen.findByTestId('find-people-suggested-user-3')).toHaveTextContent(
      /Bob Smith/,
    );
    expect(mockSearchUsers).not.toHaveBeenCalled();
  });

  it('shows a Follow button on a suggested row, independent of the search-results list', async () => {
    mockListSuggestedUsers.mockResolvedValue([bobResult]);
    mockSendFollowRequest.mockResolvedValue({ status: 'pending' });
    renderScreen();
    await screen.findByTestId('find-people-suggested-user-3-follow');

    fireEvent.press(screen.getByTestId('find-people-suggested-user-3-follow'));

    expect(mockSendFollowRequest).toHaveBeenCalledWith('token-123', 'user-3');
    expect(await screen.findByTestId('find-people-suggested-user-3-requested')).toBeTruthy();
  });

  it('shows an empty state when there is nothing to suggest', async () => {
    renderScreen();

    expect(await screen.findByTestId('find-people-suggested-empty')).toBeTruthy();
  });

  it('shows an error state with a working retry for suggested people', async () => {
    mockListSuggestedUsers.mockRejectedValueOnce(new Error('network error'));
    renderScreen();

    expect(await screen.findByTestId('find-people-suggested-error')).toHaveTextContent(
      'network error',
    );

    mockListSuggestedUsers.mockResolvedValue([bobResult]);
    fireEvent.press(screen.getByTestId('find-people-suggested-error-retry'));

    expect(await screen.findByTestId('find-people-suggested-user-3')).toBeTruthy();
  });

  it('shows Contacts as an honest Coming Soon row, not a broken tap', async () => {
    renderScreen();
    await screen.findByTestId('find-people-suggested-empty');

    fireEvent.press(screen.getByTestId('find-people-subtab-contacts'));

    expect(await screen.findByTestId('find-people-contacts-coming-soon-badge')).toHaveTextContent(
      /Coming Soon/,
    );
  });

  it('invites via the OS share sheet', async () => {
    const shareSpy = jest.spyOn(Share, 'share').mockResolvedValue({ action: 'sharedAction' });
    renderScreen();
    await screen.findByTestId('find-people-invite');

    fireEvent.press(screen.getByTestId('find-people-invite'));

    expect(shareSpy).toHaveBeenCalledWith({ message: expect.stringContaining('Progresso') });
    shareSpy.mockRestore();
  });
});

describe('FindPeopleScreen -- search', () => {
  it('does not search before anything has been typed', async () => {
    renderScreen();
    await act(async () => {
      await Promise.resolve();
    });

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
    await typeSearch('bob');
    await screen.findByTestId('find-people-result-user-3');
    expectNoBareText();

    fireEvent.press(screen.getByTestId('find-people-tab-requests'));
    await screen.findByTestId('find-people-request-follow-1');
    expectNoBareText();
  });
});
