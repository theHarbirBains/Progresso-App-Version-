import { fireEvent, render, screen, waitFor } from '@testing-library/react-native';
import { useAuth } from '../auth/AuthProvider';
import { createGroup, listGroupInvites, listGroups, respondToGroupInvite } from '../lib/api';
import { GroupsScreen } from './GroupsScreen';

jest.mock('../auth/AuthProvider', () => ({
  useAuth: jest.fn(),
}));

jest.mock('../lib/api', () => ({
  createGroup: jest.fn(),
  listGroupInvites: jest.fn(),
  listGroups: jest.fn(),
  respondToGroupInvite: jest.fn(),
}));

const mockUseAuth = useAuth as jest.Mock;
const mockListGroups = listGroups as jest.Mock;
const mockInvites = listGroupInvites as jest.Mock;
const mockCreate = createGroup as jest.Mock;
const mockRespond = respondToGroupInvite as jest.Mock;

const mockNavigate = jest.fn();
// eslint-disable-next-line @typescript-eslint/no-explicit-any
const navigation: any = { navigate: mockNavigate, goBack: jest.fn() };

const live = {
  id: 'g1',
  name: 'Thursday legs',
  hostId: 'me',
  startedAt: '2026-10-06T09:00:00.000Z',
  myRole: 'host',
};

beforeEach(() => {
  mockUseAuth.mockReturnValue({ session: { access_token: 'token-1' }, user: { id: 'me' } });
  mockListGroups.mockReset().mockResolvedValue([live]);
  mockInvites.mockReset().mockResolvedValue([]);
  mockCreate.mockReset();
  mockRespond.mockReset().mockResolvedValue({ ok: true });
  mockNavigate.mockClear();
});

describe('GroupsScreen', () => {
  it('lists the live groups, and opens one', async () => {
    render(<GroupsScreen navigation={navigation} route={{} as never} />);

    fireEvent.press(await screen.findByTestId('group-row-g1'));
    expect(mockNavigate).toHaveBeenCalledWith('GroupSession', { groupId: 'g1' });
  });

  it('starts a new group from its name', async () => {
    mockCreate.mockResolvedValue({ groupId: 'g2' });
    render(<GroupsScreen navigation={navigation} route={{} as never} />);

    fireEvent.changeText(await screen.findByTestId('groups-name-input'), 'Saturday push');
    fireEvent.press(screen.getByTestId('groups-create'));

    await waitFor(() =>
      expect(mockNavigate).toHaveBeenCalledWith('GroupSession', { groupId: 'g2' }),
    );
    expect(mockCreate).toHaveBeenCalledWith('token-1', { name: 'Saturday push' });
  });

  it('accepting an invite joins the group and opens it', async () => {
    mockInvites.mockResolvedValue([
      {
        groupId: 'g3',
        name: 'Friday arms',
        hostDisplayName: 'Jo',
        invitedAt: '2026-10-05T00:00:00.000Z',
      },
    ]);
    render(<GroupsScreen navigation={navigation} route={{} as never} />);

    fireEvent.press(await screen.findByTestId('group-invite-accept-g3'));

    await waitFor(() => expect(mockRespond).toHaveBeenCalledWith('token-1', 'g3', 'accept'));
    expect(mockNavigate).toHaveBeenCalledWith('GroupSession', { groupId: 'g3' });
  });
});
