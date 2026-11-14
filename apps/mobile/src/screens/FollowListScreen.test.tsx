import { act, fireEvent, render, screen } from '@testing-library/react-native';
import { useAuth } from '../auth/AuthProvider';
import { listPersonFollowers, listPersonFollowing, sendFollowRequest } from '../lib/api';
import { FollowListScreen } from './FollowListScreen';

jest.mock('../auth/AuthProvider', () => ({ useAuth: jest.fn() }));
jest.mock('../lib/api', () => ({
  listPersonFollowers: jest.fn(),
  listPersonFollowing: jest.fn(),
  sendFollowRequest: jest.fn(),
  unfollowUser: jest.fn(),
}));

const mockPush = jest.fn();
// eslint-disable-next-line @typescript-eslint/no-explicit-any
const navigation: any = {
  push: mockPush,
  goBack: jest.fn(),
  addListener: jest.fn((event: string, cb: () => void) => {
    if (event === 'focus') cb();
    return jest.fn();
  }),
};

const person = (id: string, name: string, status: 'none' | 'pending' | 'accepted') => ({
  user: { id, username: name.toLowerCase(), displayName: name, avatarUrl: null },
  status,
});

beforeEach(() => {
  (useAuth as jest.Mock).mockReturnValue({ user: { id: 'me' }, session: { access_token: 't' } });
  mockPush.mockClear();
});

describe('FollowListScreen', () => {
  it('lists who follows someone, each with your own follow of them -- none on your own row', async () => {
    (listPersonFollowers as jest.Mock).mockResolvedValue([
      person('jo', 'Jo', 'none'),
      person('me', 'Me', 'none'),
    ]);
    (sendFollowRequest as jest.Mock).mockResolvedValue({ status: 'pending' });
    render(
      <FollowListScreen
        navigation={navigation}
        route={{ params: { userId: 'sam', which: 'followers', name: 'Sam Lee' } } as never}
      />,
    );

    expect(await screen.findByTestId('follow-list-person-jo')).toHaveTextContent(/Jo/);
    expect(screen.getByTestId('follow-list-person-me')).toHaveTextContent(/Me \(you\)/);
    expect(screen.queryByTestId('follow-list-person-me-follow')).toBeNull();
    expect(listPersonFollowers).toHaveBeenCalledWith('t', 'sam');

    await act(async () => {
      fireEvent.press(screen.getByTestId('follow-list-person-jo-follow'));
    });
    expect(screen.getByTestId('follow-list-person-jo-requested')).toBeTruthy();

    fireEvent.press(screen.getByTestId('follow-list-person-jo'));
    expect(mockPush).toHaveBeenCalledWith('PersonProfile', { userId: 'jo' });
  });

  it('says when someone follows no one yet', async () => {
    (listPersonFollowing as jest.Mock).mockResolvedValue([]);
    render(
      <FollowListScreen
        navigation={navigation}
        route={{ params: { userId: 'sam', which: 'following' } } as never}
      />,
    );

    expect(await screen.findByTestId('follow-list-empty')).toHaveTextContent(
      'Not following anyone yet',
    );
  });

  it('says why the list cannot be read', async () => {
    (listPersonFollowers as jest.Mock).mockRejectedValue(
      new Error('Follow them to see who they follow'),
    );
    render(
      <FollowListScreen
        navigation={navigation}
        route={{ params: { userId: 'sam', which: 'followers' } } as never}
      />,
    );

    expect(await screen.findByTestId('follow-list-error')).toHaveTextContent(/Follow them/);
  });
});
