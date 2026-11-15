import { Alert, Share } from 'react-native';
import { act, fireEvent, render, screen, waitFor } from '@testing-library/react-native';
import { useAuth } from '../auth/AuthProvider';
import {
  getPersonProfile,
  getSocialSummary,
  getPersonWorkouts,
  respondToFollowRequest,
  sendFollowRequest,
  unfollowUser,
} from '../lib/api';
import { expectNoBareText } from '../testUtils/expectNoBareText';
import { PersonProfileScreen } from './PersonProfileScreen';

jest.mock('../auth/AuthProvider', () => ({ useAuth: jest.fn() }));
jest.mock('../lib/api', () => ({
  getPersonProfile: jest.fn(),
  getPersonWorkouts: jest.fn(),
  sendFollowRequest: jest.fn(),
  unfollowUser: jest.fn(),
  respondToFollowRequest: jest.fn(),
  getSocialSummary: jest.fn().mockResolvedValue({}),
  likeWorkout: jest.fn(),
  unlikeWorkout: jest.fn(),
  reportUser: jest.fn(),
  blockUser: jest.fn(),
}));
jest.mock('../progress/useProgressTheme', () => ({
  useProgressTheme: () => ({
    theme: { accent: '#D99A50', onAccent: '#000000', accentBg: '#332211' },
    weightUnit: 'kg',
  }),
}));

const mockNavigate = jest.fn();
// eslint-disable-next-line @typescript-eslint/no-explicit-any
const navigation: any = {
  navigate: mockNavigate,
  push: jest.fn(),
  goBack: jest.fn(),
  addListener: jest.fn((event: string, cb: () => void) => {
    if (event === 'focus') cb();
    return jest.fn();
  }),
};
const route = { params: { userId: 'sam' } } as never;

const sam = { id: 'sam', username: 'sam', displayName: 'Sam Lee', avatarUrl: null };

function profile(extra: object = {}) {
  return {
    user: sam,
    isSelf: false,
    followStatus: 'accepted',
    followsYou: true,
    requestId: null,
    followerCount: 12,
    followingCount: 3,
    bio: 'Building strength. Chasing progress.',
    mutuals: {
      count: 4,
      people: [
        { id: 'jo', username: 'jo', displayName: 'Jo Park', avatarUrl: null },
        { id: 'al', username: 'al', displayName: 'Al Kim', avatarUrl: null },
      ],
    },
    canSeeActivity: true,
    stats: {
      workouts: 120,
      lastThirtyDays: 9,
      totalVolumeKg: 19400,
      prCount: 24,
      bestMonthWorkouts: 14,
    },
    bestLifts: [
      {
        exerciseId: 'ex-row',
        exerciseName: 'Seated Row',
        photoUrl: null,
        gym: 'Downtown',
        attachment: 'V-handle',
        weightKg: 100,
        reps: 5,
        performedAt: '2026-11-01',
      },
    ],
    ...extra,
  };
}

const workoutItem = {
  kind: 'workout' as const,
  id: 'workout-w1',
  timestamp: '2026-11-10T10:00:00Z',
  author: sam,
  workout: {
    id: 'w1',
    name: 'Pull Day',
    splitDayName: null,
    muscleGroups: ['back'],
    durationMinutes: 50,
    exerciseCount: 3,
    completedSetCount: 9,
    totalVolumeKg: 3000,
    completedExerciseCount: 3,
    topSets: [],
  },
};

function renderScreen() {
  return render(<PersonProfileScreen navigation={navigation} route={route} />);
}

beforeEach(() => {
  (useAuth as jest.Mock).mockReturnValue({
    user: { id: 'me' },
    session: { access_token: 'token-1' },
  });
  (getPersonProfile as jest.Mock).mockReset().mockResolvedValue(profile());
  (getPersonWorkouts as jest.Mock).mockReset().mockResolvedValue({
    items: [workoutItem],
    hasMore: false,
  });
  mockNavigate.mockClear();
});

describe('PersonProfileScreen', () => {
  it('shows who they are: name, @username, bio, counts and mutual friends', async () => {
    renderScreen();

    expect(await screen.findByTestId('person-profile-name')).toHaveTextContent('Sam Lee');
    expect(screen.getByTestId('person-profile-identity')).toHaveTextContent(/@sam/);
    expect(screen.getByTestId('person-profile-bio')).toHaveTextContent(
      'Building strength. Chasing progress.',
    );
    // Their fitness goals aren't for their profile.
    expect(screen.queryByTestId('person-profile-goals')).toBeNull();
    expect(screen.getByTestId('person-profile-follows-you')).toBeTruthy();
    expect(screen.getByTestId('person-profile-count-followers')).toHaveTextContent(/12.*Followers/);
    expect(screen.getByTestId('person-profile-count-following')).toHaveTextContent(/3.*Following/);
    expect(screen.getByTestId('person-profile-mutuals')).toHaveTextContent(/4 mutual friends/);
    expect(screen.getByTestId('person-profile-following')).toBeTruthy();
    expectNoBareText();
  });

  it('lists the mutual friends, each opening their profile', async () => {
    renderScreen();

    fireEvent.press(await screen.findByTestId('person-profile-mutuals'));

    expect(screen.getByTestId('person-profile-mutuals-sheet')).toHaveTextContent(
      /Mutual Friends.*People you follow who follow Sam Lee/,
    );
    fireEvent.press(screen.getByTestId('person-profile-mutual-jo'));
    expect(navigation.push).toHaveBeenCalledWith('PersonProfile', { userId: 'jo' });
  });

  it('has no mutual friends or bio line when there are none', async () => {
    (getPersonProfile as jest.Mock).mockResolvedValue(
      profile({ mutuals: { count: 0, people: [] }, bio: null }),
    );
    renderScreen();

    await screen.findByTestId('person-profile-name');
    expect(screen.queryByTestId('person-profile-mutuals')).toBeNull();
    expect(screen.queryByTestId('person-profile-bio')).toBeNull();
  });

  it('shows the four figures, in your unit: workouts, the last 30 days, PRs and total volume', async () => {
    renderScreen();

    expect(await screen.findByTestId('person-profile-stat-workouts')).toHaveTextContent(/120/);
    expect(screen.getByTestId('person-profile-stat-recent')).toHaveTextContent(/9.*Last 30 Days/);
    expect(screen.getByTestId('person-profile-stat-prs')).toHaveTextContent(/24.*PRs/);
    expect(screen.getByTestId('person-profile-stat-volume')).toHaveTextContent(
      /19\.4K kg.*Total Volume/,
    );
  });

  it('opens on Achievements: the badges they have earned', async () => {
    renderScreen();

    expect(await screen.findByTestId('person-profile-achievements')).toBeTruthy();
    expect(screen.getByTestId('person-profile-tab-achievements')).toHaveTextContent(
      /Achievements$/,
    );
    // 120 workouts, 14 in a month, 24 PRs, 19,400 kg: the best of each kind, then what's next.
    expect(screen.getByTestId('person-profile-badge-workouts-100')).toHaveTextContent(
      /100 Workouts$/,
    );
    expect(screen.getByTestId('person-profile-badge-consistency')).toBeTruthy();
    expect(screen.getByTestId('person-profile-badge-prs-10')).toHaveTextContent(/10 PRs$/);
    expect(screen.getByTestId('person-profile-badge-workouts-250')).toBeTruthy();
    // Their workouts are under Workouts.
    expect(screen.queryByTestId('person-profile-workout-w1')).toBeNull();
  });

  it('lists every badge, earned or not, with what each takes', async () => {
    renderScreen();

    fireEvent.press(await screen.findByTestId('person-profile-badges-all'));

    expect(screen.getByTestId('person-profile-badges-sheet')).toHaveTextContent(/6 of 13 earned/);
    expect(screen.getByTestId('person-profile-badges-workouts-100')).toHaveTextContent(
      /100 Workouts.*Finish 100 workouts.*Earned/,
    );
    expect(screen.getByTestId('person-profile-badges-lifted-kg-50000')).toHaveTextContent(
      /50K kg Lifted.*Lift 50K kg in all/,
    );
    expect(screen.getByTestId('person-profile-badges-lifted-kg-50000')).not.toHaveTextContent(
      /Earned/,
    );
  });

  it('shows their heaviest lifts under PRs, every workout under Workouts, and Stats', async () => {
    (getPersonWorkouts as jest.Mock).mockResolvedValue({ items: [workoutItem], hasMore: true });
    renderScreen();

    fireEvent.press(await screen.findByTestId('person-profile-tab-prs'));
    expect(screen.getByTestId('person-profile-lift-ex-row')).toHaveTextContent(
      /Seated Row.*Downtown · V-handle.*100 kg × 5/,
    );

    fireEvent.press(screen.getByTestId('person-profile-tab-workouts'));
    expect(screen.getByTestId('person-profile-workout-w1')).toHaveTextContent(/Pull Day/);
    expect(screen.getByTestId('person-profile-load-more')).toBeTruthy();

    fireEvent.press(screen.getByTestId('person-profile-tab-stats'));
    expect(screen.getByTestId('person-profile-stats-month')).toHaveTextContent(/14.*Busiest Month/);
    expect(screen.getByTestId('person-profile-stats-badges')).toHaveTextContent(/6 of 13/);
  });

  it('shares their profile', async () => {
    const share = jest
      .spyOn(Share, 'share')
      .mockResolvedValue({ action: 'sharedAction', activityType: undefined });
    renderScreen();

    fireEvent.press(await screen.findByTestId('person-profile-share'));

    expect(share).toHaveBeenCalledWith({ message: 'Check out Sam Lee on Progresso (@sam).' });
    share.mockRestore();
  });

  it('offers Edit Profile on your own, in place of Follow', async () => {
    (getPersonProfile as jest.Mock).mockResolvedValue(
      profile({ isSelf: true, followStatus: 'none', followsYou: false }),
    );
    renderScreen();

    fireEvent.press(await screen.findByTestId('person-profile-edit'));
    expect(mockNavigate).toHaveBeenCalledWith('SettingsPersonalInfo');
    expect(screen.queryByTestId('person-profile-follow')).toBeNull();
    expect(screen.queryByTestId('person-profile-more')).toBeNull();
  });

  it('opens their workouts read-only, and who follows them', async () => {
    renderScreen();

    fireEvent.press(await screen.findByTestId('person-profile-tab-workouts'));
    fireEvent.press(screen.getByTestId('person-profile-workout-w1'));
    expect(mockNavigate).toHaveBeenCalledWith('WorkoutDetail', {
      workoutId: 'w1',
      authorId: 'sam',
    });

    fireEvent.press(screen.getByTestId('person-profile-count-followers'));
    expect(mockNavigate).toHaveBeenCalledWith('FollowList', {
      userId: 'sam',
      which: 'followers',
      name: 'Sam Lee',
    });
  });

  it('shows only who they are until they accept, with Follow sending the request', async () => {
    (getPersonProfile as jest.Mock).mockResolvedValue(
      profile({
        followStatus: 'none',
        followsYou: false,
        canSeeActivity: false,
        stats: null,
        bestLifts: null,
      }),
    );
    // Asked for alongside the profile, and refused until they accept.
    (getPersonWorkouts as jest.Mock).mockRejectedValue(new Error('Follow them to see'));
    (sendFollowRequest as jest.Mock).mockResolvedValue({ status: 'pending' });
    renderScreen();

    expect(await screen.findByTestId('person-profile-private')).toHaveTextContent(
      /Follow Sam to see their training/,
    );
    expect(screen.queryByTestId('person-profile-error')).toBeNull();
    expect(screen.queryByTestId('person-profile-tiles')).toBeNull();
    expect(screen.queryByTestId('person-profile-tab')).toBeNull();

    await act(async () => {
      fireEvent.press(screen.getByTestId('person-profile-follow'));
    });
    expect(sendFollowRequest).toHaveBeenCalledWith('token-1', 'sam');
    expect(getPersonProfile).toHaveBeenCalledTimes(2);
  });

  it('asks before unfollowing', async () => {
    const alert = jest.spyOn(Alert, 'alert').mockImplementation((_t, _m, buttons) => {
      buttons?.find((b) => b.text === 'Unfollow')?.onPress?.();
    });
    (unfollowUser as jest.Mock).mockResolvedValue({ success: true });
    renderScreen();

    await screen.findByTestId('person-profile-count-following');
    fireEvent.press(screen.getByTestId('person-profile-following'));

    expect(alert).toHaveBeenCalledWith('Unfollow Sam?', expect.any(String), expect.any(Array));
    await waitFor(() => expect(unfollowUser).toHaveBeenCalledWith('token-1', 'sam'));
    alert.mockRestore();
  });

  it('answers their request to follow you from their profile', async () => {
    (getPersonProfile as jest.Mock).mockResolvedValue(profile({ requestId: 'f9' }));
    (respondToFollowRequest as jest.Mock).mockResolvedValue({ success: true });
    renderScreen();

    expect(await screen.findByTestId('person-profile-request')).toHaveTextContent(
      /Sam wants to follow you/,
    );
    await act(async () => {
      fireEvent.press(screen.getByTestId('person-profile-request-accept'));
    });
    expect(respondToFollowRequest).toHaveBeenCalledWith('token-1', 'f9', 'accept');
  });

  it('keeps Report and Block behind the "..." -- never on your own profile', async () => {
    renderScreen();

    fireEvent.press(await screen.findByTestId('person-profile-more'));
    expect(screen.getByTestId('person-actions-block')).toHaveTextContent(/Block Sam Lee/);
  });

  it("keeps its placeholders until their workouts' likes are in, then shows it all", async () => {
    let answer: (value: unknown) => void = () => undefined;
    (getSocialSummary as jest.Mock).mockReturnValueOnce(
      new Promise((resolve) => {
        answer = resolve;
      }),
    );
    renderScreen();

    await waitFor(() => expect(getSocialSummary).toHaveBeenCalled());
    expect(screen.getByTestId('person-profile-loading')).toBeTruthy();
    expect(screen.queryByTestId('person-profile-name')).toBeNull();

    await act(async () => {
      answer({ w1: { likeCount: 4, commentCount: 0, likedByMe: false } });
    });
    expect(screen.getByTestId('person-profile-name')).toHaveTextContent('Sam Lee');
  });

  it('says yours, not theirs, with no heaviest lifts on your own', async () => {
    (getPersonProfile as jest.Mock).mockResolvedValue(
      profile({ isSelf: true, followStatus: 'none', followsYou: false, bestLifts: [] }),
    );
    renderScreen();

    fireEvent.press(await screen.findByTestId('person-profile-tab-prs'));
    expect(screen.getByTestId('person-profile-no-lifts')).toBeTruthy();
    expect(screen.getByText(/^Your heaviest set on each weighted exercise/)).toBeTruthy();
  });

  it('opens their photo full screen, to see it properly', async () => {
    const photo = 'https://project.supabase.co/storage/v1/object/public/avatars/sam/avatar.jpg';
    (getPersonProfile as jest.Mock).mockResolvedValue(
      profile({ user: { ...sam, avatarUrl: photo } }),
    );
    renderScreen();

    const zoom = await screen.findByTestId('person-profile-photo-zoom');
    expect(zoom.props.accessibilityLabel).toBe('View Sam Lee photo');
    fireEvent.press(zoom);
    expect(screen.getByTestId('person-profile-photo-lightbox')).toBeTruthy();

    fireEvent.press(screen.getByTestId('person-profile-photo-lightbox-close'));
    expect(screen.queryByTestId('person-profile-photo-lightbox')).toBeNull();
  });

  it('has nothing to open with no photo', async () => {
    renderScreen();

    await screen.findByTestId('person-profile-name');
    expect(screen.queryByTestId('person-profile-photo-zoom')).toBeNull();
  });

  it('says so when the profile cannot be read', async () => {
    (getPersonProfile as jest.Mock).mockRejectedValue(new Error('User not found'));
    renderScreen();

    expect(await screen.findByTestId('person-profile-error')).toHaveTextContent(/User not found/);
  });
});
