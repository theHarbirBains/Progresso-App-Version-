import { FlatList, Image } from 'react-native';
import { act, fireEvent, render, screen, waitFor, within } from '@testing-library/react-native';
import { expectNoBareText } from '../testUtils/expectNoBareText';
import * as ImagePicker from 'expo-image-picker';
import { useAuth } from '../auth/AuthProvider';
import { getPersonProfile, getPersonWorkouts, updateMyProfile } from '../lib/api';
import { forgetShown } from '../lib/lastShown';
import { removeAvatarFile, uploadAvatar } from '../lib/avatarUpload';
import { MembershipContext } from '../membership/useMembership';
import { fetchTodaysFoodLogs } from '../nutrition/foodLogQueries';
import { fetchNutritionGoals } from '../nutrition/nutritionGoalQueries';
import { NutritionGoalsProvider } from '../nutrition/NutritionGoalsProvider';
import { FoodLogProvider } from '../nutrition/FoodLogProvider';
import { ProfileProvider } from '../profile/ProfileProvider';
import { AllTimeStatsProvider } from '../progress/AllTimeStatsProvider';
import { fetchAllCompletedWorkouts } from '../progress/progressStatsQueries';
import { fetchAllExerciseHistory } from '../workouts/allExerciseHistoryQueries';
import { fetchAllOneRepMaxes, fetchAllRepPRs } from '../workouts/prSummaryQueries';
import type { MembershipTier } from '../lib/api';
import { ProfileScreen } from './ProfileScreen';
import { fetchMyProfile } from '../profile/profileQueries';

jest.mock('../auth/AuthProvider', () => ({
  useAuth: jest.fn(),
}));

jest.mock('../lib/api', () => ({
  updateMyProfile: jest.fn(),
  // Your profile as the people who follow you see it, and its first workouts.
  getPersonProfile: jest.fn(),
  getPersonWorkouts: jest.fn(),
  getSocialSummary: jest.fn().mockResolvedValue({}),
  likeWorkout: jest.fn(),
  unlikeWorkout: jest.fn(),
}));

jest.mock('../profile/profileQueries', () => ({
  fetchMyProfile: jest.fn(),
}));

jest.mock('../lib/avatarUpload', () => ({
  uploadAvatar: jest.fn(),
  removeAvatarFile: jest.fn(),
}));

jest.mock('../progress/progressStatsQueries', () => ({
  fetchAllCompletedWorkouts: jest.fn(),
}));

// The shared food log keeps a logged food in the library first (foodQueries.keepInLibrary);
// here there's nothing to copy, so each food is logged as it is.
jest.mock('../nutrition/foodQueries', () => ({
  keepInLibrary: jest.fn().mockResolvedValue(null),
  createFood: jest.fn(),
  USER_ENTERED: { confidence: 'user_entered' },
}));
jest.mock('../nutrition/foodLogQueries', () => ({
  fetchTodaysFoodLogs: jest.fn(),
}));

jest.mock('../nutrition/nutritionGoalQueries', () => ({
  fetchNutritionGoals: jest.fn(),
}));

jest.mock('../workouts/allExerciseHistoryQueries', () => ({
  fetchAllExerciseHistory: jest.fn(),
}));

jest.mock('../workouts/prSummaryQueries', () => ({
  fetchAllExerciseRecords: jest.fn().mockResolvedValue([]),
  fetchAllRepPRs: jest.fn(),
  fetchAllOneRepMaxes: jest.fn(),
}));

const mockUseAuth = useAuth as jest.Mock;
const mockFetchMyProfile = fetchMyProfile as jest.Mock;
const mockUpdateMyProfile = updateMyProfile as jest.Mock;
const mockGetPersonProfile = getPersonProfile as jest.Mock;
const mockGetPersonWorkouts = getPersonWorkouts as jest.Mock;
const mockUploadAvatar = uploadAvatar as jest.Mock;
const mockRemoveAvatarFile = removeAvatarFile as jest.Mock;
const mockRequestMediaLibraryPermissionsAsync =
  ImagePicker.requestMediaLibraryPermissionsAsync as jest.Mock;
const mockLaunchImageLibraryAsync = ImagePicker.launchImageLibraryAsync as jest.Mock;
const mockFetchAllCompletedWorkouts = fetchAllCompletedWorkouts as jest.Mock;
const mockFetchTodaysFoodLogs = fetchTodaysFoodLogs as jest.Mock;
const mockFetchNutritionGoals = fetchNutritionGoals as jest.Mock;
const mockFetchAllExerciseHistory = fetchAllExerciseHistory as jest.Mock;
const mockFetchAllRepPRs = fetchAllRepPRs as jest.Mock;
const mockFetchAllOneRepMaxes = fetchAllOneRepMaxes as jest.Mock;

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
const route = {} as never;

const AVATAR = 'https://project.supabase.co/storage/v1/object/public/avatars/user-1/avatar.jpg';

const baseProfile = {
  id: 'user-1',
  email: 'a@test.local',
  role: 'user',
  displayName: 'Harbir',
  username: 'harbir',
  bio: 'Chasing progress.',
  fitnessGoals: ['build_muscle'],
  weightUnit: 'kg' as const,
  workoutAccentColor: null as string | null,
  nutritionAccentColor: null as string | null,
  activeWorkoutSplitId: null as string | null,
  avatarUrl: null as string | null,
};

/** Your profile as the API gives it -- what the people who follow you see. */
function me(extra: object = {}) {
  return {
    user: { id: 'user-1', username: 'harbir', displayName: 'Harbir', avatarUrl: null },
    isSelf: true,
    followStatus: 'none',
    followsYou: false,
    requestId: null,
    followerCount: 4,
    followingCount: 2,
    bio: 'Chasing progress.',
    mutuals: { count: 0, people: [] },
    canSeeActivity: true,
    stats: {
      workouts: 120,
      lastThirtyDays: 9,
      totalVolumeKg: 19400,
      prCount: 24,
      bestMonthWorkouts: 14,
    },
    bestLifts: [],
    ...extra,
  };
}

const workoutItem = {
  kind: 'workout' as const,
  id: 'workout-w1',
  timestamp: '2026-11-10T10:00:00Z',
  author: { id: 'user-1', username: 'harbir', displayName: 'Harbir', avatarUrl: null },
  workout: {
    id: 'w1',
    name: 'Push Day',
    splitDayName: null,
    muscleGroups: ['chest'],
    durationMinutes: 60,
    exerciseCount: 4,
    completedSetCount: 12,
    totalVolumeKg: 1250,
    completedExerciseCount: 4,
    topSets: [],
  },
};

const benchPR = {
  reps: 5,
  bestWeightKg: 100,
  sourceSetId: 's1',
  achievedAt: '2026-09-01T00:00:00Z',
  exerciseId: 'ex1',
  exerciseName: 'Bench Press',
  muscleGroup: 'chest',
};

beforeEach(() => {
  forgetShown();
  mockUseAuth.mockReturnValue({
    user: { id: 'user-1' },
    session: { access_token: 'token-123' },
  });
  mockFetchMyProfile.mockReset().mockResolvedValue(baseProfile);
  mockUpdateMyProfile.mockReset().mockResolvedValue(baseProfile);
  mockGetPersonProfile.mockReset().mockResolvedValue(me());
  mockGetPersonWorkouts.mockReset().mockResolvedValue({ items: [workoutItem], hasMore: false });
  mockUploadAvatar.mockReset();
  mockRemoveAvatarFile.mockReset();
  mockRequestMediaLibraryPermissionsAsync.mockReset().mockResolvedValue({ granted: true });
  mockLaunchImageLibraryAsync.mockReset().mockResolvedValue({ canceled: true, assets: null });
  mockFetchAllCompletedWorkouts.mockReset().mockResolvedValue([
    {
      id: 'w1',
      name: 'Push',
      performedAt: '2026-09-01T00:00:00Z',
      completedAt: '2026-09-01T01:00:00Z',
      workoutSplitDayId: null,
    },
    {
      id: 'w2',
      name: 'Pull',
      performedAt: '2026-09-03T00:00:00Z',
      completedAt: '2026-09-03T01:00:00Z',
      workoutSplitDayId: null,
    },
  ]);
  mockFetchAllExerciseHistory.mockReset().mockResolvedValue([
    {
      weightKg: 100,
      reps: 5,
      performedAt: '2026-09-01T00:00:00Z',
      workoutExerciseId: 'we1',
      exerciseId: 'ex1',
      exerciseName: 'Bench Press',
      muscleGroup: 'chest',
    },
    {
      weightKg: 60,
      reps: 10,
      performedAt: '2026-09-01T00:00:00Z',
      workoutExerciseId: 'we2',
      exerciseId: 'ex2',
      exerciseName: 'Squat',
      muscleGroup: 'quadriceps',
    },
  ]);
  mockFetchAllRepPRs.mockReset().mockResolvedValue([]);
  mockFetchAllOneRepMaxes.mockReset().mockResolvedValue([]);
  mockFetchTodaysFoodLogs.mockReset().mockResolvedValue([]);
  mockFetchNutritionGoals
    .mockReset()
    .mockResolvedValue({ calories: null, proteinG: null, carbsG: null, fatG: null });
  mockNavigate.mockClear();
});

function renderProfile(membership: MembershipTier = 'everything') {
  return render(
    <MembershipContext.Provider value={membership}>
      <ProfileProvider>
        <NutritionGoalsProvider>
          <FoodLogProvider>
            <AllTimeStatsProvider>
              <ProfileScreen navigation={navigation} route={route} />
            </AllTimeStatsProvider>
          </FoodLogProvider>
        </NutritionGoalsProvider>
      </ProfileProvider>
    </MembershipContext.Provider>,
  );
}

async function openTab(tab: 'achievements' | 'workouts' | 'prs' | 'stats') {
  fireEvent.press(await screen.findByTestId(`person-profile-tab-${tab}`));
}

describe('ProfileScreen -- your profile as your friends see it', () => {
  it('keeps its placeholders until it is all in, then shows who you are', async () => {
    renderProfile();
    expect(screen.getByTestId('profile-loading')).toBeTruthy();

    expect(await screen.findByTestId('person-profile-name')).toHaveTextContent('Harbir');
    expect(screen.getByTestId('person-profile-identity')).toHaveTextContent(/@harbir/);
    expect(screen.getByTestId('person-profile-bio')).toHaveTextContent('Chasing progress.');
    expect(screen.queryByTestId('profile-loading')).toBeNull();
  });

  it('shows who you are from your own profile, so an edit shows at once', async () => {
    mockGetPersonProfile.mockResolvedValue(
      me({ user: { id: 'user-1', username: 'old', displayName: 'Old Name', avatarUrl: null } }),
    );
    mockFetchMyProfile.mockResolvedValue({ ...baseProfile, bio: 'Just changed.' });
    renderProfile();

    expect(await screen.findByTestId('person-profile-name')).toHaveTextContent('Harbir');
    expect(screen.getByTestId('person-profile-bio')).toHaveTextContent('Just changed.');
  });

  it('never shows your fitness goals', async () => {
    renderProfile();

    await screen.findByTestId('person-profile-name');
    expect(screen.queryByTestId('person-profile-goals')).toBeNull();
    expect(screen.queryByText('Build Muscle')).toBeNull();
  });

  it('keeps Settings in the header, and offers Edit Profile and Share -- never Follow or "..."', async () => {
    renderProfile();
    await screen.findByTestId('person-profile-name');

    expect(screen.getByTestId('profile-open-settings').props.accessibilityLabel).toBe('Settings');
    fireEvent.press(screen.getByTestId('profile-open-settings'));
    expect(mockNavigate).toHaveBeenCalledWith('AccountSettings');

    mockNavigate.mockClear();
    fireEvent.press(screen.getByTestId('person-profile-edit'));
    expect(mockNavigate).toHaveBeenCalledWith('SettingsPersonalInfo');

    expect(screen.getByTestId('person-profile-share')).toBeTruthy();
    expect(screen.queryByTestId('person-profile-follow')).toBeNull();
    expect(screen.queryByTestId('person-profile-more')).toBeNull();
  });

  it('shows who follows you and who you follow, each opening its list', async () => {
    renderProfile();

    expect(await screen.findByTestId('person-profile-count-followers')).toHaveTextContent(
      /4.*Followers/,
    );
    expect(screen.getByTestId('person-profile-count-following')).toHaveTextContent(/2.*Following/);
    fireEvent.press(screen.getByTestId('person-profile-count-followers'));
    expect(mockNavigate).toHaveBeenCalledWith('FollowList', {
      userId: 'user-1',
      which: 'followers',
      name: 'Harbir',
    });
  });

  it('shows the four figures your friends see', async () => {
    renderProfile();

    expect(await screen.findByTestId('person-profile-stat-workouts')).toHaveTextContent(/120/);
    expect(screen.getByTestId('person-profile-stat-recent')).toHaveTextContent(/9.*Last 30 Days/);
    expect(screen.getByTestId('person-profile-stat-prs')).toHaveTextContent(/24.*PRs/);
    expect(screen.getByTestId('person-profile-stat-volume')).toHaveTextContent(/19\.4K kg/);
  });

  it('opens on Achievements, and lists your workouts under Workouts, each opening yours', async () => {
    renderProfile();

    expect(await screen.findByTestId('person-profile-achievements')).toBeTruthy();
    expect(screen.getByTestId('person-profile-tab-achievements')).toHaveTextContent(
      /Achievements$/,
    );

    await openTab('workouts');
    fireEvent.press(screen.getByTestId('person-profile-workout-w1'));
    expect(mockNavigate).toHaveBeenCalledWith('WorkoutDetail', { workoutId: 'w1' });
  });

  it('opens again showing what it last showed, while it reads it again', async () => {
    const first = renderProfile();
    await screen.findByTestId('person-profile-name');
    first.unmount();

    mockGetPersonProfile.mockReturnValue(new Promise(() => undefined));
    renderProfile();

    expect(screen.queryByTestId('profile-loading')).toBeNull();
    expect(await screen.findByTestId('person-profile-stat-workouts')).toHaveTextContent(/120/);
  });

  it('does not render its own bottom nav', async () => {
    renderProfile();
    await screen.findByTestId('person-profile-name');

    expect(screen.queryByTestId('bottom-nav-bar')).toBeNull();
  });

  it('renders no bare text outside <Text> on any tab', async () => {
    renderProfile();
    await screen.findByTestId('person-profile-name');
    expectNoBareText();

    for (const tab of ['workouts', 'prs', 'stats'] as const) {
      await openTab(tab);
      expectNoBareText();
    }
  });
});

describe('ProfileScreen Stats tab -- yours alone, under the six figures', () => {
  it("shows today's calories and macros against your targets, opening Nutrition", async () => {
    mockFetchTodaysFoodLogs.mockResolvedValue([
      {
        id: 'l1',
        foodId: 'f1',
        foodNameSnapshot: 'Chicken',
        servingSize: 100,
        servingUnit: 'g',
        quantity: 1,
        calories: 400,
        proteinG: 40,
        carbsG: 10,
        fatG: 8,
        mealType: 'lunch',
        loggedAt: '2026-09-01T12:00:00Z',
      },
    ]);
    mockFetchNutritionGoals.mockResolvedValue({
      calories: 2200,
      proteinG: 180,
      carbsG: 200,
      fatG: 70,
    });
    renderProfile();
    await openTab('stats');

    expect(screen.getByTestId('person-profile-stats-month')).toHaveTextContent(/14.*Busiest Month/);
    expect(screen.getByTestId('profile-nutrition-calories')).toHaveTextContent(/400 \/ 2,200/);
    expect(screen.getByTestId('profile-nutrition-protein')).toHaveTextContent(/40g \/ 180g/);
    expect(screen.getByTestId('profile-nutrition-carbs')).toHaveTextContent(/10g \/ 200g/);
    expect(screen.getByTestId('profile-nutrition-fat')).toHaveTextContent(/8g \/ 70g/);

    fireEvent.press(screen.getByTestId('profile-nutrition'));
    expect(mockNavigate).toHaveBeenCalledWith('Nutrition');
  });

  it('shows just the consumed amount, with no "/ goal", when no goal is set', async () => {
    renderProfile();
    await openTab('stats');

    expect(screen.getByTestId('profile-nutrition-calories')).toHaveTextContent(/^0/);
    expect(screen.getByTestId('profile-nutrition-calories')).not.toHaveTextContent('/');
  });

  it('has no calories card when Nutrition is not in your membership', async () => {
    renderProfile('workouts');
    await openTab('stats');

    expect(screen.getByTestId('profile-training')).toBeTruthy();
    expect(screen.queryByTestId('profile-nutrition')).toBeNull();
  });

  it('shows a nutrition load error without crashing the rest of the page', async () => {
    mockFetchNutritionGoals.mockRejectedValue(new Error('nutrition down'));
    renderProfile();
    await openTab('stats');

    expect(screen.getByTestId('profile-nutrition-error')).toHaveTextContent('nutrition down');
    expect(screen.getByTestId('person-profile-name')).toBeTruthy();
  });

  it('shows your total sets, this week, the weekly trends and your most-trained muscle groups', async () => {
    // Performed "now" so the weekly bucketing always lands inside the trend window.
    const now = new Date();
    mockFetchAllCompletedWorkouts.mockResolvedValue([
      {
        id: 'w1',
        name: 'Push',
        performedAt: now.toISOString(),
        completedAt: now.toISOString(),
        workoutSplitDayId: null,
      },
    ]);
    renderProfile();
    await openTab('stats');

    expect(within(screen.getByTestId('profile-stat-tile-sets')).getByText('2')).toBeTruthy();
    expect(screen.getByTestId('profile-stat-tile-time')).toBeTruthy();
    expect(screen.getByTestId('profile-this-week-workouts')).toHaveTextContent(/^1/);
    expect(screen.getByTestId('profile-trend-workouts-total')).toHaveTextContent(/1 workout/);
    expect(screen.getByTestId('profile-trend-volume-total')).toBeTruthy();
    expect(screen.getByTestId('profile-trend-sets-total')).toBeTruthy();
    // One chest set and one quadriceps set.
    expect(screen.getByTestId('profile-muscle-group-chest')).toBeTruthy();
    expect(screen.getByTestId('profile-muscle-group-quadriceps')).toBeTruthy();
  });

  it('shows an empty message instead of an empty chart with no training at all', async () => {
    mockFetchAllCompletedWorkouts.mockResolvedValue([]);
    mockFetchAllExerciseHistory.mockResolvedValue([]);
    renderProfile();
    await openTab('stats');

    expect(screen.getByTestId('profile-trend-workouts-empty')).toBeTruthy();
    expect(screen.queryByTestId('profile-trend-workouts-chart')).toBeNull();
  });

  it('shows an error without crashing when your history cannot be read', async () => {
    mockFetchAllCompletedWorkouts.mockRejectedValue(new Error('Network down'));
    renderProfile();
    await openTab('stats');

    expect(screen.getByTestId('profile-stats-error')).toHaveTextContent('Network down');
  });
});

describe('ProfileScreen PRs tab', () => {
  it('shows every record you hold under your heaviest lifts, as one plain list', async () => {
    mockGetPersonProfile.mockResolvedValue(
      me({
        bestLifts: [
          {
            exerciseId: 'ex1',
            exerciseName: 'Bench Press',
            photoUrl: null,
            gym: null,
            attachment: null,
            weightKg: 100,
            reps: 5,
            performedAt: '2026-09-01',
          },
        ],
      }),
    );
    mockFetchAllRepPRs.mockResolvedValue([benchPR]);
    renderProfile();
    await openTab('prs');

    expect(screen.getByTestId('person-profile-lift-ex1')).toHaveTextContent(/100 kg × 5/);
    expect(screen.getByTestId('progress-prs-count')).toHaveTextContent('1 PR');
    // The page is one ScrollView: PRsSection never nests a FlatList in it.
    expect(screen.UNSAFE_queryAllByType(FlatList)).toHaveLength(0);
  });

  it('lets your records speak for themselves when you have no heaviest lifts yet', async () => {
    renderProfile();
    await openTab('prs');

    expect(screen.queryByTestId('person-profile-no-lifts')).toBeNull();
    expect(screen.getByTestId('progress-prs-empty')).toBeTruthy();
  });
});

describe('ProfileScreen profile picture', () => {
  it('shows the initial-letter fallback when no picture is set', async () => {
    renderProfile();

    expect(await screen.findByTestId('profile-avatar')).toHaveTextContent(/H/);
    expect(screen.getByTestId('profile-avatar').props.accessibilityLabel).toBe(
      'Change profile picture',
    );
  });

  it('displays the saved picture once the profile has one', async () => {
    mockFetchMyProfile.mockResolvedValue({ ...baseProfile, avatarUrl: AVATAR });
    renderProfile();
    await screen.findByTestId('person-profile-name');

    await waitFor(() =>
      expect(screen.getByTestId('profile-avatar').findByType(Image).props.source).toEqual({
        uri: AVATAR,
      }),
    );
  });

  it('tapping the avatar opens the picture sheet, offering Choose Photo but not Remove Photo when none is set', async () => {
    renderProfile();
    fireEvent.press(await screen.findByTestId('profile-avatar'));

    expect(screen.getByTestId('profile-avatar-choose-photo')).toBeTruthy();
    expect(screen.queryByTestId('profile-avatar-remove-photo')).toBeNull();
  });

  it('offers Remove Photo once a picture is already set', async () => {
    mockFetchMyProfile.mockResolvedValue({ ...baseProfile, avatarUrl: AVATAR });
    renderProfile();
    fireEvent.press(await screen.findByTestId('profile-avatar'));

    expect(screen.getByTestId('profile-avatar-remove-photo')).toBeTruthy();
  });

  it('selecting and uploading a photo saves it and shows it at once', async () => {
    mockLaunchImageLibraryAsync.mockResolvedValue({
      canceled: false,
      assets: [{ uri: 'file:///tmp/photo.jpg' }],
    });
    mockUploadAvatar.mockResolvedValue(`${AVATAR}?v=1`);
    mockUpdateMyProfile.mockResolvedValue({ ...baseProfile, avatarUrl: `${AVATAR}?v=1` });
    renderProfile();

    fireEvent.press(await screen.findByTestId('profile-avatar'));
    await act(async () => {
      fireEvent.press(screen.getByTestId('profile-avatar-choose-photo'));
      await Promise.resolve();
      await Promise.resolve();
    });

    expect(mockUploadAvatar).toHaveBeenCalledWith('user-1', 'file:///tmp/photo.jpg');
    expect(mockUpdateMyProfile).toHaveBeenCalledWith('token-123', {
      avatarUrl: `${AVATAR}?v=1`,
    });
    await waitFor(() =>
      expect(screen.getByTestId('profile-avatar').findByType(Image).props.source).toEqual({
        uri: `${AVATAR}?v=1`,
      }),
    );
  });

  it('removing the photo deletes the file and clears the profile field, reverting to the fallback', async () => {
    mockFetchMyProfile.mockResolvedValue({ ...baseProfile, avatarUrl: AVATAR });
    mockUpdateMyProfile.mockResolvedValue({ ...baseProfile, avatarUrl: null });
    renderProfile();

    fireEvent.press(await screen.findByTestId('profile-avatar'));
    await act(async () => {
      fireEvent.press(screen.getByTestId('profile-avatar-remove-photo'));
      await Promise.resolve();
    });

    expect(mockRemoveAvatarFile).toHaveBeenCalledWith('user-1');
    expect(mockUpdateMyProfile).toHaveBeenCalledWith('token-123', { avatarUrl: null });
    await waitFor(() => expect(screen.getByTestId('profile-avatar')).toHaveTextContent(/H/));
  });

  it('does nothing when the picker is cancelled', async () => {
    renderProfile();

    fireEvent.press(await screen.findByTestId('profile-avatar'));
    await act(async () => {
      fireEvent.press(screen.getByTestId('profile-avatar-choose-photo'));
      await Promise.resolve();
    });

    expect(mockUploadAvatar).not.toHaveBeenCalled();
    expect(mockUpdateMyProfile).not.toHaveBeenCalledWith('token-123', expect.anything());
  });

  it('shows an error and keeps the previous picture when the upload fails', async () => {
    mockLaunchImageLibraryAsync.mockResolvedValue({
      canceled: false,
      assets: [{ uri: 'file:///tmp/photo.jpg' }],
    });
    mockUploadAvatar.mockRejectedValue(new Error('Upload failed: network error'));
    renderProfile();

    fireEvent.press(await screen.findByTestId('profile-avatar'));
    await act(async () => {
      fireEvent.press(screen.getByTestId('profile-avatar-choose-photo'));
      await Promise.resolve();
      await Promise.resolve();
    });

    expect(await screen.findByTestId('profile-avatar-error')).toHaveTextContent(
      'Upload failed: network error',
    );
    expect(mockUpdateMyProfile).not.toHaveBeenCalledWith('token-123', expect.anything());
    expect(screen.getByTestId('profile-avatar')).toHaveTextContent(/H/);
  });

  it('shows an error when photo library permission is denied, without opening the picker', async () => {
    mockRequestMediaLibraryPermissionsAsync.mockResolvedValue({ granted: false });
    renderProfile();

    fireEvent.press(await screen.findByTestId('profile-avatar'));
    await act(async () => {
      fireEvent.press(screen.getByTestId('profile-avatar-choose-photo'));
      await Promise.resolve();
    });

    expect(screen.getByTestId('profile-avatar-error')).toHaveTextContent(
      /Photo library permission is required/,
    );
    expect(mockLaunchImageLibraryAsync).not.toHaveBeenCalled();
  });
});
