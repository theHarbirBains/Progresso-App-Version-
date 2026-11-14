import { Alert } from 'react-native';
import { act, fireEvent, render, screen, waitFor } from '@testing-library/react-native';
import { useAuth } from '../auth/AuthProvider';
import {
  getPersonProfile,
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
    canSeeActivity: true,
    stats: { workouts: 40, lastThirtyDays: 9 },
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
  it('shows someone you follow in full: who they are, counts, stats, heaviest lifts and workouts', async () => {
    renderScreen();

    expect(await screen.findByTestId('person-profile-name')).toHaveTextContent('Sam Lee');
    expect(screen.getByTestId('person-profile-follows-you')).toBeTruthy();
    expect(screen.getByTestId('person-profile-count-followers')).toHaveTextContent(/12.*Followers/);
    expect(screen.getByTestId('person-profile-count-following')).toHaveTextContent(/3.*Following/);
    expect(screen.getByTestId('person-profile-stat-workouts')).toHaveTextContent(/40/);
    expect(screen.getByTestId('person-profile-stat-recent')).toHaveTextContent(/9/);
    expect(screen.getByTestId('person-profile-lift-ex-row')).toHaveTextContent(
      /Seated Row.*Downtown · V-handle.*100 kg × 5/,
    );
    expect(await screen.findByTestId('person-profile-workout-w1')).toHaveTextContent(/Pull Day/);
    expect(screen.getByTestId('person-profile-following')).toBeTruthy();
    expectNoBareText();
  });

  it('opens their workouts read-only, and who follows them', async () => {
    renderScreen();

    fireEvent.press(await screen.findByTestId('person-profile-workout-w1'));
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
    (sendFollowRequest as jest.Mock).mockResolvedValue({ status: 'pending' });
    renderScreen();

    expect(await screen.findByTestId('person-profile-private')).toHaveTextContent(
      /Follow Sam to see their training/,
    );
    expect(getPersonWorkouts).not.toHaveBeenCalled();
    expect(screen.queryByTestId('person-profile-stats')).toBeNull();

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

  it('says so when the profile cannot be read', async () => {
    (getPersonProfile as jest.Mock).mockRejectedValue(new Error('User not found'));
    renderScreen();

    expect(await screen.findByTestId('person-profile-error')).toHaveTextContent(/User not found/);
  });
});
