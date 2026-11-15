import { Alert, Share } from 'react-native';
import { act, fireEvent, render, screen, waitFor } from '@testing-library/react-native';
import { useAuth } from '../auth/AuthProvider';
import {
  getPersonProfile,
  getSocialSummary,
  getPersonWorkouts,
  listFollowRequests,
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
  listFollowRequests: jest.fn(),
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

/** An exercise they've done, with its best set: 100 kg x 5, in 12 workouts. */
function lift(exerciseId: string, exerciseName: string, extra: object = {}) {
  return {
    exerciseId,
    exerciseName,
    photoUrl: null,
    gym: null,
    attachment: null,
    measurementType: 'weight_reps',
    weightKg: 100,
    reps: 5,
    durationSeconds: null,
    performedAt: '2026-11-01',
    workouts: 12,
    lastPerformedAt: '2026-11-10',
    ...extra,
  };
}

/** An achievement they've earned, as the API lists it. */
function earned(
  id: string,
  title: string,
  ap: number,
  level: number,
  levels: number,
  lastAwardedAt: string,
) {
  return {
    id,
    title,
    description: `${title}, done`,
    icon: 'activity',
    category: 'workouts',
    kind: levels > 1 ? 'levels' : 'single',
    level,
    levels,
    ap,
    firstAwardedAt: '2026-10-05T10:00:00Z',
    lastAwardedAt,
  };
}

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
      totalSets: 1500,
      totalReps: 12000,
      trainingMinutes: 6000,
      oneRepMaxCount: 2,
      exerciseCount: 20,
      bestSessionVolumeKg: 5000,
      bodyweightReps: 0,
      timedSeconds: 0,
      groupWorkouts: 1,
      committedMonths: 1,
      strongWeeks: 12,
      likesReceived: 30,
      likesGiven: 8,
    },
    exercises: [lift('ex-row', 'Seated Row', { gym: 'Downtown', attachment: 'V-handle' })],
    rank: { points: 2250, awards: 14 },
    achievements: [
      earned('guns-blazin', "Guns Blazin'", 60, 2, 8, '2026-11-09T10:00:00Z'),
      earned('first-steps', 'First Steps', 25, 1, 1, '2026-11-02T10:00:00Z'),
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
  (listFollowRequests as jest.Mock).mockReset().mockResolvedValue([]);
  mockNavigate.mockClear();
});

describe('PersonProfileScreen', () => {
  it('shows who they are: name, @username and workouts, bio, counts and mutual friends', async () => {
    renderScreen();

    expect(await screen.findByTestId('person-profile-name')).toHaveTextContent('Sam Lee');
    expect(screen.getByTestId('person-profile-subline')).toHaveTextContent('@sam · 120 workouts');
    expect(screen.getByTestId('person-profile-bio')).toHaveTextContent(
      'Building strength. Chasing progress.',
    );
    // Their fitness goals aren't for their profile.
    expect(screen.queryByTestId('person-profile-goals')).toBeNull();
    // No "Follows you" line: the counts and the Following button say it.
    expect(screen.queryByTestId('person-profile-follows-you')).toBeNull();
    expect(screen.queryByText('Follows you')).toBeNull();
    // One line: "12 followers • 3 following" -- someone else's follow requests are never asked for.
    expect(screen.getByTestId('person-profile-counts')).toHaveTextContent(
      '12 followers•3 following',
    );
    expect(listFollowRequests).not.toHaveBeenCalled();
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

  it('leaves their workouts out from under their name until you can see them', async () => {
    (getPersonProfile as jest.Mock).mockResolvedValue(
      profile({ followStatus: 'none', canSeeActivity: false, stats: null }),
    );
    renderScreen();

    expect(await screen.findByTestId('person-profile-subline')).toHaveTextContent('@sam');
    expect(screen.getByTestId('person-profile-subline')).not.toHaveTextContent(/workouts/);
  });

  it('puts your follow requests between the counts on your own, opening them', async () => {
    (useAuth as jest.Mock).mockReturnValue({
      user: { id: 'sam' },
      session: { access_token: 'token-1' },
    });
    (getPersonProfile as jest.Mock).mockResolvedValue(
      profile({ isSelf: true, followStatus: 'none', followsYou: false }),
    );
    (listFollowRequests as jest.Mock).mockResolvedValue([{ followId: 'f1' }, { followId: 'f2' }]);
    renderScreen();

    expect(await screen.findByTestId('person-profile-counts')).toHaveTextContent(
      '12 followers•2 requests•3 following',
    );
    fireEvent.press(screen.getByTestId('person-profile-count-requests'));
    expect(mockNavigate).toHaveBeenCalledWith('FindPeople', { tab: 'requests' });
  });

  it('leaves the requests out of your own counts when there are none', async () => {
    (useAuth as jest.Mock).mockReturnValue({
      user: { id: 'sam' },
      session: { access_token: 'token-1' },
    });
    (getPersonProfile as jest.Mock).mockResolvedValue(
      profile({ isSelf: true, followStatus: 'none', followsYou: false }),
    );
    renderScreen();

    expect(await screen.findByTestId('person-profile-counts')).toHaveTextContent(
      '12 followers•3 following',
    );
    expect(listFollowRequests).toHaveBeenCalledWith('token-1');
    expect(screen.queryByTestId('person-profile-count-requests')).toBeNull();
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

  it('opens on Stats, with Achievements last', async () => {
    renderScreen();

    expect(await screen.findByTestId('person-profile-stats')).toBeTruthy();
    expect(screen.queryByTestId('person-profile-achievements')).toBeNull();
    const tabs = screen
      .getAllByTestId(/^person-profile-tab-/)
      .map((tab) => String(tab.props.testID).replace('person-profile-tab-', ''));
    expect(tabs).toEqual(['stats', 'workouts', 'prs', 'achievements']);
  });

  it("lists only what they've earned under Achievements, the latest first", async () => {
    renderScreen();

    fireEvent.press(await screen.findByTestId('person-profile-tab-achievements'));
    expect(screen.getByTestId('person-profile-achievements')).toHaveTextContent(
      /Achievements.*2 earned/,
    );
    expect(screen.getByTestId('person-profile-tab-achievements')).toHaveTextContent(
      /Achievements$/,
    );
    expect(screen.getByTestId('person-profile-achievement-guns-blazin')).toHaveTextContent(
      /Guns Blazin'.*Guns Blazin', done.*Level 2 of 8 ·.*\+60/,
    );
    expect(screen.getByTestId('person-profile-achievement-first-steps')).toHaveTextContent(
      /First Steps.*Unlocked ·.*\+25/,
    );
    // Never one still ahead, and never theirs to see all of.
    expect(screen.queryByTestId('person-profile-achievement-iron-regular')).toBeNull();
    expect(screen.queryByTestId('profile-all-achievements')).toBeNull();
    // Their workouts are under Workouts.
    expect(screen.queryByTestId('person-profile-workout-w1')).toBeNull();
  });

  it('says so when they have earned none yet', async () => {
    (getPersonProfile as jest.Mock).mockResolvedValue(profile({ achievements: [] }));
    renderScreen();

    fireEvent.press(await screen.findByTestId('person-profile-tab-achievements'));
    expect(screen.getByTestId('person-profile-no-achievements')).toBeTruthy();
  });

  it('shows their lifetime rank: emblem, division, AP and the way on, opening every rank', async () => {
    renderScreen();

    expect(await screen.findByTestId('person-profile-rank')).toHaveTextContent(
      /Gold V.*2,250 AP · 2 achievements.*150 AP to Gold IV/,
    );
    fireEvent.press(screen.getByTestId('person-profile-rank'));
    expect(mockNavigate).toHaveBeenCalledWith('RankProgression', { points: 2250, name: 'Sam' });
  });

  it('shows no rank for someone who hides it', async () => {
    (getPersonProfile as jest.Mock).mockResolvedValue(profile({ rank: null }));
    renderScreen();

    await screen.findByTestId('person-profile-name');
    expect(screen.queryByTestId('person-profile-rank')).toBeNull();
  });

  it('shows every exercise under PRs, each opening its top sets; every workout; and Stats', async () => {
    (getPersonWorkouts as jest.Mock).mockResolvedValue({ items: [workoutItem], hasMore: true });
    (getPersonProfile as jest.Mock).mockResolvedValue(
      profile({
        exercises: [
          lift('ex-row', 'Seated Row', { gym: 'Downtown', attachment: 'V-handle' }),
          lift('ex-push', 'Push-Up', {
            measurementType: 'bodyweight',
            weightKg: null,
            reps: 25,
            workouts: 1,
          }),
          lift('ex-plank', 'Plank', {
            measurementType: 'timed',
            weightKg: null,
            reps: null,
            durationSeconds: 90,
          }),
        ],
      }),
    );
    renderScreen();

    fireEvent.press(await screen.findByTestId('person-profile-tab-prs'));
    expect(screen.getByTestId('person-profile-lift-ex-row')).toHaveTextContent(
      /Seated Row.*12 workouts · Downtown · V-handle.*100 kg × 5/,
    );
    expect(screen.getByTestId('person-profile-lift-ex-push')).toHaveTextContent(
      /Push-Up.*1 workout.*25 reps/,
    );
    expect(screen.getByTestId('person-profile-lift-ex-plank')).toHaveTextContent(/Plank.*1:30/);
    // A few exercises need no search.
    expect(screen.queryByTestId('person-profile-lift-search')).toBeNull();
    fireEvent.press(screen.getByTestId('person-profile-lift-ex-row'));
    expect(mockNavigate).toHaveBeenCalledWith('PersonExercise', {
      userId: 'sam',
      exerciseId: 'ex-row',
      name: 'Seated Row',
    });

    fireEvent.press(screen.getByTestId('person-profile-tab-workouts'));
    expect(screen.getByTestId('person-profile-workout-w1')).toHaveTextContent(/Pull Day/);
    expect(screen.getByTestId('person-profile-load-more')).toBeTruthy();

    fireEvent.press(screen.getByTestId('person-profile-tab-stats'));
    expect(screen.getByTestId('person-profile-stats-month')).toHaveTextContent(/14.*Busiest Month/);
    expect(screen.getByTestId('person-profile-stats-ap')).toHaveTextContent(
      /2,250.*Achievement Points/,
    );
  });

  it('searches their exercises once there are more than a few', async () => {
    (getPersonProfile as jest.Mock).mockResolvedValue(
      profile({
        exercises: [
          'Bench Press',
          'Incline Press',
          'Squat',
          'Deadlift',
          'Seated Row',
          'Lat Pulldown',
          'Leg Press',
        ].map((name, index) => lift(`ex-${index}`, name, index === 6 ? { gym: 'Downtown' } : {})),
      }),
    );
    renderScreen();
    fireEvent.press(await screen.findByTestId('person-profile-tab-prs'));

    fireEvent.changeText(screen.getByTestId('person-profile-lift-search'), 'press');
    expect(screen.getByTestId('person-profile-lift-ex-0')).toBeTruthy();
    expect(screen.getByTestId('person-profile-lift-ex-1')).toBeTruthy();
    expect(screen.getByTestId('person-profile-lift-ex-6')).toBeTruthy();
    expect(screen.queryByTestId('person-profile-lift-ex-2')).toBeNull();

    // The gym counts as part of the name.
    fireEvent.changeText(screen.getByTestId('person-profile-lift-search'), 'downtown');
    expect(screen.getByTestId('person-profile-lift-ex-6')).toBeTruthy();
    expect(screen.queryByTestId('person-profile-lift-ex-0')).toBeNull();

    fireEvent.changeText(screen.getByTestId('person-profile-lift-search'), 'zercher');
    expect(screen.getByTestId('person-profile-lift-none')).toHaveTextContent(
      'No exercise matches "zercher".',
    );
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
        exercises: null,
        achievements: null,
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
    // Their rank is anyone's to see; what earned it isn't, yet.
    expect(screen.getByTestId('person-profile-rank')).toHaveTextContent(/Gold V.*2,250 AP/);
    expect(screen.getByTestId('person-profile-rank')).not.toHaveTextContent(/achievements/);

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
      profile({ isSelf: true, followStatus: 'none', followsYou: false, exercises: [] }),
    );
    renderScreen();

    fireEvent.press(await screen.findByTestId('person-profile-tab-prs'));
    expect(screen.getByTestId('person-profile-no-lifts')).toBeTruthy();
    expect(screen.getByText(/^Your best set on each exercise shows here/)).toBeTruthy();
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
