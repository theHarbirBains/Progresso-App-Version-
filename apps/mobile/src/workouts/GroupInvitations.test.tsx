import { act, fireEvent, render, screen, waitFor } from '@testing-library/react-native';
import { Alert } from 'react-native';
import {
  cancelGroupInvite,
  inviteToGroup,
  listFollowing,
  type GroupDetail,
  type GroupInvitation,
} from '../lib/api';
import { GroupInvitations } from './GroupInvitations';

jest.mock('../lib/api', () => ({
  cancelGroupInvite: jest.fn(),
  inviteToGroup: jest.fn(),
  listFollowing: jest.fn(),
}));

const mockInvite = inviteToGroup as jest.Mock;
const mockCancel = cancelGroupInvite as jest.Mock;
const mockFollowing = listFollowing as jest.Mock;

const invitation = (extra: Partial<GroupInvitation>): GroupInvitation => ({
  userId: 'jo',
  displayName: 'Jo Lee',
  status: 'pending',
  invitedById: 'me',
  invitedByDisplayName: 'Harbir',
  invitedAt: '2026-11-25T10:00:00Z',
  respondedAt: null,
  canCancel: true,
  ...extra,
});

function group(
  invitations: GroupInvitation[],
  status: GroupDetail['status'] = 'live',
): GroupDetail {
  return {
    id: 'g1',
    name: 'Pull Crew',
    status,
    hostId: 'me',
    startedAt: '2026-11-25T09:55:00Z',
    finishedAt: null,
    members: [
      {
        userId: 'me',
        displayName: 'Harbir',
        role: 'host',
        status: 'joined',
        isGuest: false,
        workoutId: 'w1',
        workoutSplitDayId: null,
        workoutName: 'Pull Crew',
      },
      {
        userId: 'pat',
        displayName: 'Pat Doe',
        role: 'member',
        status: 'joined',
        isGuest: false,
        workoutId: 'w2',
        workoutSplitDayId: null,
        workoutName: 'Pull Crew',
      },
    ],
    invitations,
  };
}

const onChanged = jest.fn().mockResolvedValue(undefined);

function renderIt(detail: GroupDetail) {
  return render(
    <GroupInvitations
      group={detail}
      accessToken="token-1"
      accentColor="#EBC27C"
      onAccentColor="#1A1206"
      onChanged={onChanged}
    />,
  );
}

beforeEach(() => {
  jest.restoreAllMocks();
  mockInvite.mockReset();
  mockCancel.mockReset().mockResolvedValue({ ok: true });
  mockFollowing.mockReset().mockResolvedValue([
    { id: 'pat', username: 'pat', displayName: 'Pat Doe', avatarUrl: null },
    { id: 'jo', username: 'jo', displayName: 'Jo Lee', avatarUrl: null },
    { id: 'kim', username: 'kim', displayName: 'Kim Park', avatarUrl: null },
    { id: 'lee', username: 'lee', displayName: 'Lee Chan', avatarUrl: null },
  ]);
  onChanged.mockClear();
});

describe('GroupInvitations', () => {
  it('says what became of every invite, and who sent one still waiting', () => {
    renderIt(
      group([
        invitation({}),
        invitation({
          userId: 'kim',
          displayName: 'Kim Park',
          status: 'declined',
          canCancel: false,
        }),
        invitation({ userId: 'pat', displayName: 'Pat Doe', status: 'accepted', canCancel: false }),
        invitation({
          userId: 'lee',
          displayName: 'Lee Chan',
          status: 'cancelled',
          canCancel: false,
        }),
      ]),
    );

    expect(screen.getByTestId('group-session-invited-jo')).toHaveTextContent(
      /Jo Lee.*Invited by Harbir.*Waiting/,
    );
    expect(screen.getByTestId('group-session-invited-kim-status')).toHaveTextContent('Declined');
    expect(screen.getByTestId('group-session-invited-pat-status')).toHaveTextContent('Joined');
    expect(screen.getByTestId('group-session-invited-lee-status')).toHaveTextContent('Cancelled');
    // Only a waiting invite you sent can be taken back.
    expect(screen.getByTestId('group-session-invited-jo-cancel')).toBeTruthy();
    expect(screen.queryByTestId('group-session-invited-kim-cancel')).toBeNull();
  });

  it('says an invite to a finished workout has expired, with no way to invite more', () => {
    renderIt(group([invitation({ status: 'expired', canCancel: false })], 'finished'));

    expect(screen.getByTestId('group-session-invited-jo-status')).toHaveTextContent('Expired');
    expect(screen.queryByTestId('group-session-invited-invite')).toBeNull();
  });

  it('invites several friends at once, never offering anyone in the workout or invited already', async () => {
    mockInvite.mockResolvedValue({
      results: [
        { userId: 'kim', status: 'invited' },
        { userId: 'lee', status: 'invited' },
      ],
    });
    renderIt(group([invitation({})]));

    fireEvent.press(screen.getByTestId('group-session-invited-invite'));
    expect(await screen.findByTestId('group-session-invited-friend-kim')).toBeTruthy();
    // Pat's training, Jo's invited and waiting.
    expect(screen.queryByTestId('group-session-invited-friend-pat')).toBeNull();
    expect(screen.queryByTestId('group-session-invited-friend-jo')).toBeNull();

    fireEvent.press(screen.getByTestId('group-session-invited-friend-kim'));
    fireEvent.press(screen.getByTestId('group-session-invited-friend-lee'));
    expect(screen.getByTestId('group-session-invited-send')).toHaveTextContent('Send 2 Invites');
    await act(async () => {
      fireEvent.press(screen.getByTestId('group-session-invited-send'));
    });

    expect(mockInvite).toHaveBeenCalledWith('token-1', 'g1', ['kim', 'lee']);
    expect(onChanged).toHaveBeenCalled();
  });

  it("says who couldn't be invited", async () => {
    mockInvite.mockResolvedValue({ results: [{ userId: 'kim', status: 'skipped' }] });
    const alert = jest.spyOn(Alert, 'alert').mockImplementation(() => undefined);
    renderIt(group([]));

    fireEvent.press(screen.getByTestId('group-session-invited-invite'));
    fireEvent.press(await screen.findByTestId('group-session-invited-friend-kim'));
    await act(async () => {
      fireEvent.press(screen.getByTestId('group-session-invited-send'));
    });

    expect(alert).toHaveBeenCalledWith(
      "Couldn't invite them",
      "Kim Park can't be invited to this workout.",
    );
  });

  it('cancels an invite still waiting, once asked', async () => {
    jest.spyOn(Alert, 'alert').mockImplementation((_title, _message, buttons) => {
      buttons?.find((b) => b.text === 'Cancel Invite')?.onPress?.();
    });
    renderIt(group([invitation({})]));

    fireEvent.press(screen.getByTestId('group-session-invited-jo-cancel'));

    await waitFor(() => expect(mockCancel).toHaveBeenCalledWith('token-1', 'g1', 'jo'));
    expect(onChanged).toHaveBeenCalled();
  });
});
