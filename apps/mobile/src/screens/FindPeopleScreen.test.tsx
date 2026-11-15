import { act, fireEvent, render, screen } from '@testing-library/react-native';
import { Share } from 'react-native';
import { expectNoBareText } from '../testUtils/expectNoBareText';
import { useAuth } from '../auth/AuthProvider';
import {
  listFollowRequests,
  listPersonFollowers,
  listPersonFollowing,
  respondToFollowRequest,
  searchUsers,
  sendFollowRequest,
  unfollowUser,
} from '../lib/api';
import { FindPeopleScreen } from './FindPeopleScreen';

jest.mock('../auth/AuthProvider', () => ({
  useAuth: jest.fn(),
}));

jest.mock('../lib/safetyApi', () => ({
  blockUser: jest.fn(),
  reportUser: jest.fn(),
}));

jest.mock('../lib/api', () => ({
  listFollowRequests: jest.fn(),
  listPersonFollowers: jest.fn(),
  listPersonFollowing: jest.fn(),
  respondToFollowRequest: jest.fn(),
  searchUsers: jest.fn(),
  sendFollowRequest: jest.fn(),
  unfollowUser: jest.fn(),
  matchContacts: jest.fn(),
}));

// The phone's contacts, as hashes -- the reading and hashing have their own tests.
const mockContactHashes = jest.fn();
jest.mock('../social/contactHashes', () => ({
  contactHashes: (...args: unknown[]) => mockContactHashes(...args),
}));
// Your country, which a contact's number without its code is read as.
jest.mock('../profile/ProfileProvider', () => ({
  useProfile: () => ({ profile: { country: 'CA' } }),
}));

const mockUseAuth = useAuth as jest.Mock;
const mockListFollowRequests = listFollowRequests as jest.Mock;
const mockListPersonFollowers = listPersonFollowers as jest.Mock;
const mockListPersonFollowing = listPersonFollowing as jest.Mock;
const mockRespondToFollowRequest = respondToFollowRequest as jest.Mock;
const mockSearchUsers = searchUsers as jest.Mock;
const mockSendFollowRequest = sendFollowRequest as jest.Mock;
const mockUnfollowUser = unfollowUser as jest.Mock;

const mockGoBack = jest.fn();
const mockNavigate = jest.fn();
// eslint-disable-next-line @typescript-eslint/no-explicit-any
const navigation: any = {
  goBack: mockGoBack,
  navigate: mockNavigate,
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
  mockListPersonFollowers.mockReset().mockResolvedValue([]);
  mockListPersonFollowing.mockReset().mockResolvedValue([]);
  mockContactHashes
    .mockReset()
    .mockResolvedValue({ access: 'undetermined', emailHashes: [], phoneHashes: [] });
  mockRespondToFollowRequest.mockReset().mockResolvedValue({ success: true });
  mockSearchUsers.mockReset().mockResolvedValue([]);
  mockSendFollowRequest.mockReset().mockResolvedValue({ status: 'pending' });
  mockUnfollowUser.mockReset().mockResolvedValue({ success: true });
  mockGoBack.mockClear();
});

afterEach(() => {
  jest.useRealTimers();
});

describe('FindPeopleScreen -- following tab', () => {
  const following = [
    {
      user: { id: 'user-3', username: 'bob', displayName: 'Bob Smith', avatarUrl: null },
      status: 'accepted' as const,
    },
    {
      user: { id: 'user-4', username: 'sam', displayName: null, avatarUrl: null },
      status: 'accepted' as const,
    },
  ];

  it('lists everyone you follow, each opening their profile', async () => {
    mockListPersonFollowing.mockResolvedValue(following);
    renderScreen();

    fireEvent.press(await screen.findByTestId('find-people-tab-following'));

    expect(await screen.findByTestId('find-people-following-card')).toHaveTextContent(
      /You follow 2 people/,
    );
    expect(mockListPersonFollowing).toHaveBeenCalledWith('token-123', 'user-1');
    expect(screen.getByTestId('find-people-following-user-3')).toHaveTextContent(/Bob Smith/);
    expect(screen.getByTestId('find-people-following-user-4')).toHaveTextContent(/@sam/);
    // No search field: it's who you follow, not a search.
    expect(screen.queryByTestId('find-people-search-input')).toBeNull();

    fireEvent.press(screen.getByTestId('find-people-following-user-3'));
    expect(mockNavigate).toHaveBeenCalledWith('PersonProfile', { userId: 'user-3' });
  });

  it('unfollows from the list with its Following button, which then offers Follow again', async () => {
    mockListPersonFollowing.mockResolvedValue(following);
    renderScreen();
    fireEvent.press(await screen.findByTestId('find-people-tab-following'));

    fireEvent.press(await screen.findByTestId('find-people-following-user-3-following'));

    expect(await screen.findByTestId('find-people-following-user-3-follow')).toBeTruthy();
    expect(mockUnfollowUser).toHaveBeenCalledWith('token-123', 'user-3');
  });

  it('says so when you follow no one, with a way to find people', async () => {
    renderScreen();
    fireEvent.press(await screen.findByTestId('find-people-tab-following'));

    expect(await screen.findByTestId('find-people-following-empty')).toHaveTextContent(
      'Not following anyone yet',
    );
    fireEvent.press(screen.getByTestId('find-people-following-find'));
    expect(screen.getByTestId('find-people-search-input')).toBeTruthy();
  });

  it('shows an error with a working retry', async () => {
    mockListPersonFollowing.mockRejectedValueOnce(new Error('offline'));
    renderScreen();
    fireEvent.press(await screen.findByTestId('find-people-tab-following'));

    expect(await screen.findByTestId('find-people-following-error')).toBeTruthy();
    mockListPersonFollowing.mockResolvedValue(following);
    fireEvent.press(screen.getByTestId('find-people-following-error-retry'));

    expect(await screen.findByTestId('find-people-following-card')).toBeTruthy();
  });
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

  it('opens straight on Requests from a profile\'s "2 requests"', async () => {
    mockListFollowRequests.mockResolvedValue([janeRequest]);
    render(
      <FindPeopleScreen navigation={navigation} route={{ params: { tab: 'requests' } } as never} />,
    );

    expect(await screen.findByTestId('find-people-request-follow-1')).toHaveTextContent(/Jane Doe/);
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

describe('FindPeopleScreen -- Your Friends and Suggested (shown when search is empty)', () => {
  const jane = {
    user: { id: 'user-2', username: 'jane', displayName: 'Jane Doe', avatarUrl: null },
    status: 'none' as const,
  };
  const bob = { ...bobResult, status: 'accepted' as const };
  const sam = {
    user: { id: 'user-4', username: 'sam', displayName: 'Sam Lee', avatarUrl: null },
    status: 'accepted' as const,
  };

  it('opens on Your Friends: everyone who follows you or whom you follow, each once, by name', async () => {
    // Jane follows you; you follow Sam; you and Bob follow each other.
    mockListPersonFollowers.mockResolvedValue([jane, bob]);
    mockListPersonFollowing.mockResolvedValue([bob, sam]);
    renderScreen();

    expect(await screen.findByTestId('find-people-friends-card')).toHaveTextContent(/3 friends/);
    expect(mockListPersonFollowers).toHaveBeenCalledWith('token-123', 'user-1');
    const rows = screen
      .getAllByTestId(/^find-people-friend-user-\d$/)
      .map((row) => row.props.testID as string);
    expect(rows).toEqual([
      'find-people-friend-user-3',
      'find-people-friend-user-2',
      'find-people-friend-user-4',
    ]);
    // Someone who follows you whom you don't follow back: Follow.
    expect(screen.getByTestId('find-people-friend-user-2-follow')).toBeTruthy();
    expect(screen.getByTestId('find-people-friend-user-3-following')).toBeTruthy();
    expect(mockSearchUsers).not.toHaveBeenCalled();
  });

  it('follows back someone who follows you, right from the list', async () => {
    mockListPersonFollowers.mockResolvedValue([jane]);
    mockSendFollowRequest.mockResolvedValue({ status: 'pending' });
    renderScreen();

    fireEvent.press(await screen.findByTestId('find-people-friend-user-2-follow'));

    expect(mockSendFollowRequest).toHaveBeenCalledWith('token-123', 'user-2');
    expect(await screen.findByTestId('find-people-friend-user-2-requested')).toBeTruthy();
  });

  it('says so with no friends yet, with a way to Suggested', async () => {
    renderScreen();

    expect(await screen.findByTestId('find-people-friends-empty')).toHaveTextContent(
      'No friends yet',
    );
    fireEvent.press(screen.getByTestId('find-people-friends-suggested'));
    expect(await screen.findByTestId('contact-suggestions-ask')).toBeTruthy();
  });

  it('shows an error with a working retry for your friends', async () => {
    mockListPersonFollowers.mockRejectedValueOnce(new Error('network error'));
    renderScreen();

    expect(await screen.findByTestId('find-people-friends-error')).toHaveTextContent(
      'network error',
    );
    mockListPersonFollowers.mockResolvedValue([jane]);
    fireEvent.press(screen.getByTestId('find-people-friends-error-retry'));

    expect(await screen.findByTestId('find-people-friend-user-2')).toBeTruthy();
  });

  it('suggests the people in your contacts you do not follow yet, read without asking once allowed', async () => {
    const { matchContacts } = jest.requireMock('../lib/api') as { matchContacts: jest.Mock };
    mockContactHashes.mockResolvedValue({
      access: 'granted',
      emailHashes: ['a'.repeat(64)],
      phoneHashes: ['b'.repeat(64)],
    });
    matchContacts.mockResolvedValue([{ ...bobResult }, sam]);
    renderScreen();
    await screen.findByTestId('find-people-friends-empty');

    fireEvent.press(screen.getByTestId('find-people-subtab-suggested'));

    expect(await screen.findByTestId('contact-suggestions-found')).toHaveTextContent(
      /1 contact on Progresso/,
    );
    // Their own country reads a number without its code; nothing asked.
    expect(mockContactHashes).toHaveBeenCalledWith('CA', { ask: false });
    expect(matchContacts).toHaveBeenCalledWith('token-123', ['a'.repeat(64)], ['b'.repeat(64)]);
    // Sam, whom you already follow, isn't a suggestion.
    expect(screen.queryByTestId('contact-suggestions-person-user-4')).toBeNull();
    expect(screen.getByTestId('contact-suggestions-person-user-3-follow')).toBeTruthy();
    fireEvent.press(screen.getByTestId('contact-suggestions-person-user-3'));
    expect(mockNavigate).toHaveBeenCalledWith('PersonProfile', { userId: 'user-3' });
  });

  it('asks before reading the contacts the first time', async () => {
    renderScreen();
    await screen.findByTestId('find-people-friends-empty');
    fireEvent.press(screen.getByTestId('find-people-subtab-suggested'));

    expect(await screen.findByTestId('contact-suggestions-ask')).toHaveTextContent(
      /nothing is kept/,
    );
    mockContactHashes.mockResolvedValue({ access: 'granted', emailHashes: [], phoneHashes: [] });
    fireEvent.press(screen.getByTestId('contact-suggestions-find'));

    expect(await screen.findByTestId('contact-suggestions-none')).toBeTruthy();
    expect(mockContactHashes).toHaveBeenLastCalledWith('CA', { ask: true });
  });

  it('says how to allow contacts when Progresso may not see them', async () => {
    mockContactHashes.mockResolvedValue({ access: 'denied', emailHashes: [], phoneHashes: [] });
    renderScreen();
    await screen.findByTestId('find-people-friends-empty');

    fireEvent.press(screen.getByTestId('find-people-subtab-suggested'));

    expect(await screen.findByTestId('contact-suggestions-denied')).toHaveTextContent(
      /allow Contacts for Progresso/,
    );
    expect(screen.getByTestId('contact-suggestions-settings')).toBeTruthy();
  });

  it('invites via the OS share sheet', async () => {
    const shareSpy = jest.spyOn(Share, 'share').mockResolvedValue({
      action: 'sharedAction',
      activityType: undefined,
    });
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

describe('FindPeopleScreen -- profiles', () => {
  it("opens a person's profile when their row is tapped -- Report and Block are there", async () => {
    mockListPersonFollowers.mockResolvedValue([bobResult]);
    renderScreen();

    fireEvent.press(await screen.findByTestId('find-people-friend-user-3'));

    expect(mockNavigate).toHaveBeenCalledWith('PersonProfile', { userId: 'user-3' });
  });

  it('opens the profile of someone who asked to follow you', async () => {
    mockListFollowRequests.mockResolvedValue([janeRequest]);
    renderScreen();

    fireEvent.press(await screen.findByTestId('find-people-tab-requests'));
    fireEvent.press(await screen.findByTestId('find-people-request-follow-1'));

    expect(mockNavigate).toHaveBeenCalledWith('PersonProfile', { userId: 'user-2' });
  });
});
