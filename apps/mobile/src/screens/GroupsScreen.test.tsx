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

jest.mock('../progress/useProgressTheme', () => ({
  useProgressTheme: () => ({
    theme: { accent: '#3DDC97', onAccent: '#000000' },
    activeWorkoutSplitId: 'split-1',
    weightUnit: 'kg',
  }),
}));

jest.mock('../workouts/workoutSplitQueries', () => ({
  fetchWorkoutSplitDetail: jest.fn(async () => ({
    id: 'split-1',
    name: 'Main',
    days: [
      { id: 'day-1', name: 'Push', orderIndex: 1, muscleGroups: ['chest'] },
      { id: 'day-2', name: 'Pull', orderIndex: 2, muscleGroups: ['back'] },
    ],
  })),
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
  mockCreate.mockReset().mockResolvedValue({ groupId: 'g2' });
  mockRespond.mockReset().mockResolvedValue({ ok: true });
  mockNavigate.mockClear();
});

describe('GroupsScreen', () => {
  it('lists the live groups, and opens one', async () => {
    render(<GroupsScreen navigation={navigation} route={{} as never} />);

    fireEvent.press(await screen.findByTestId('group-row-g1'));
    expect(mockNavigate).toHaveBeenCalledWith('GroupSession', { groupId: 'g1' });
  });

  it('starts a group on any day of the split', async () => {
    render(<GroupsScreen navigation={navigation} route={{} as never} />);

    fireEvent.press(await screen.findByTestId('groups-day-day-2'));

    await waitFor(() =>
      expect(mockNavigate).toHaveBeenCalledWith('GroupSession', { groupId: 'g2' }),
    );
    expect(mockCreate).toHaveBeenCalledWith('token-1', { name: 'Pull', splitDayId: 'day-2' });
  });

  it('starts a separate workout outside the split, named by the person', async () => {
    render(<GroupsScreen navigation={navigation} route={{} as never} />);

    fireEvent.press(await screen.findByTestId('groups-create-separate'));
    fireEvent.changeText(await screen.findByTestId('groups-separate-name'), 'Arms and abs');
    fireEvent.press(screen.getByTestId('groups-separate-start'));

    await waitFor(() =>
      expect(mockCreate).toHaveBeenCalledWith('token-1', {
        name: 'Arms and abs',
        workoutName: 'Arms and abs',
      }),
    );
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
