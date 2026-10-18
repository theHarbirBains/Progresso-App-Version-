import { fireEvent, render, screen, waitFor } from '@testing-library/react-native';
import { useAuth } from '../auth/AuthProvider';
import { listBlockedUsers, unblockUser } from '../lib/api';
import { expectNoBareText } from '../testUtils/expectNoBareText';
import { SettingsBlockedPeopleScreen } from './SettingsBlockedPeopleScreen';

jest.mock('../auth/AuthProvider', () => ({
  useAuth: jest.fn(),
}));

jest.mock('../lib/api', () => ({
  listBlockedUsers: jest.fn(),
  unblockUser: jest.fn(),
}));

const mockListBlockedUsers = listBlockedUsers as jest.Mock;
const mockUnblockUser = unblockUser as jest.Mock;
const mockGoBack = jest.fn();
// eslint-disable-next-line @typescript-eslint/no-explicit-any
const navigation: any = { goBack: mockGoBack };
const sam = { id: 'user-2', username: 'sam', displayName: 'Sam Lee', avatarUrl: null };
const pat = { id: 'user-3', username: 'pat', displayName: null, avatarUrl: null };

function renderScreen() {
  return render(<SettingsBlockedPeopleScreen navigation={navigation} route={{} as never} />);
}

beforeEach(() => {
  (useAuth as jest.Mock).mockReturnValue({ session: { access_token: 'token-1' } });
  mockListBlockedUsers.mockReset().mockResolvedValue([sam, pat]);
  mockUnblockUser.mockReset().mockResolvedValue({ success: true });
  mockGoBack.mockClear();
});

describe('SettingsBlockedPeopleScreen', () => {
  it('lists the people you blocked by name', async () => {
    renderScreen();

    expect(await screen.findByTestId('blocked-person-user-2')).toHaveTextContent(/Sam Lee/);
    expect(screen.getByTestId('blocked-person-user-2')).toHaveTextContent(/@sam/);
    expect(screen.getByTestId('blocked-person-user-3')).toHaveTextContent(/@pat/);
  });

  it('unblocks someone and takes them off the list', async () => {
    renderScreen();

    fireEvent.press(await screen.findByTestId('blocked-person-user-2-unblock'));

    await waitFor(() => expect(mockUnblockUser).toHaveBeenCalledWith('token-1', 'user-2'));
    await waitFor(() => expect(screen.queryByTestId('blocked-person-user-2')).toBeNull());
    expect(screen.getByTestId('blocked-person-user-3')).toBeTruthy();
  });

  it('names who each Unblock is for, for assistive tech', async () => {
    renderScreen();
    expect(await screen.findByLabelText('Unblock Sam Lee')).toBeTruthy();
  });

  it("says so when you haven't blocked anyone", async () => {
    mockListBlockedUsers.mockResolvedValue([]);
    renderScreen();
    expect(await screen.findByTestId('blocked-people-empty')).toHaveTextContent(
      /You haven't blocked anyone/,
    );
  });

  it('offers a retry when the list fails to load', async () => {
    mockListBlockedUsers.mockRejectedValueOnce(new Error('Network down'));
    renderScreen();

    expect(await screen.findByTestId('blocked-people-error')).toHaveTextContent(/Network down/);
  });

  it('goes back from the header', async () => {
    renderScreen();
    await screen.findByTestId('blocked-person-user-2');
    fireEvent.press(screen.getByTestId('app-header-back'));
    expect(mockGoBack).toHaveBeenCalled();
  });

  it('renders no bare text outside <Text>', async () => {
    renderScreen();
    await screen.findByTestId('blocked-person-user-2');
    expectNoBareText();
  });
});
