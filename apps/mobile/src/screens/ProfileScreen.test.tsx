import { FlatList, Image, StyleSheet } from 'react-native';
import { act, fireEvent, render, screen, waitFor, within } from '@testing-library/react-native';
import { AppCard } from '../design/AppCard';
import { PrimaryButton } from '../design/Button';
import { expectNoBareText } from '../testUtils/expectNoBareText';
import * as ImagePicker from 'expo-image-picker';
import { useAuth } from '../auth/AuthProvider';
import { BackgroundThemeProvider } from '../design/BackgroundThemeContext';
import { getMyProfile, updateMyProfile } from '../lib/api';
import { removeAvatarFile, uploadAvatar } from '../lib/avatarUpload';
import { AppMenuContext } from '../navigation/AppMenuContext';
import { fetchTodaysFoodLogs } from '../nutrition/foodLogQueries';
import { fetchNutritionGoals } from '../nutrition/nutritionGoalQueries';
import { NutritionGoalsProvider } from '../nutrition/NutritionGoalsProvider';
import { ProfileProvider } from '../profile/ProfileProvider';
import { AllTimeStatsProvider } from '../progress/AllTimeStatsProvider';
import { fetchAllCompletedWorkouts } from '../progress/progressStatsQueries';
import { fetchAllExerciseHistory } from '../workouts/allExerciseHistoryQueries';
import { fetchAllOneRepMaxes, fetchAllRepPRs } from '../workouts/prSummaryQueries';
import { enrichWorkoutSummaries } from '../workouts/workoutHistoryEnrichment';
import { fetchWorkoutHistory } from '../workouts/workoutQueries';
import { ProfileScreen } from './ProfileScreen';

jest.mock('../auth/AuthProvider', () => ({
  useAuth: jest.fn(),
}));

jest.mock('../lib/api', () => ({
  getMyProfile: jest.fn(),
  updateMyProfile: jest.fn(),
}));

jest.mock('../lib/avatarUpload', () => ({
  uploadAvatar: jest.fn(),
  removeAvatarFile: jest.fn(),
}));

jest.mock('../progress/progressStatsQueries', () => ({
  fetchAllCompletedWorkouts: jest.fn(),
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
  fetchAllRepPRs: jest.fn(),
  fetchAllOneRepMaxes: jest.fn(),
}));

jest.mock('../workouts/workoutQueries', () => ({
  fetchWorkoutHistory: jest.fn(),
}));

jest.mock('../workouts/workoutHistoryEnrichment', () => ({
  enrichWorkoutSummaries: jest.fn(),
}));

const mockUseAuth = useAuth as jest.Mock;
const mockGetMyProfile = getMyProfile as jest.Mock;
const mockUpdateMyProfile = updateMyProfile as jest.Mock;
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
const mockFetchWorkoutHistory = fetchWorkoutHistory as jest.Mock;
const mockEnrichWorkoutSummaries = enrichWorkoutSummaries as jest.Mock;

const mockNavigate = jest.fn();
// eslint-disable-next-line @typescript-eslint/no-explicit-any
const navigation: any = {
  navigate: mockNavigate,
  addListener: jest.fn((event: string, cb: () => void) => {
    if (event === 'focus') cb();
    return jest.fn();
  }),
};
const route = {} as never;

const baseProfile = {
  id: 'user-1',
  email: 'a@test.local',
  role: 'user',
  displayName: 'Harbir',
  username: 'harbir',
  weightUnit: 'kg' as const,
  workoutAccentColor: null as string | null,
  nutritionAccentColor: null as string | null,
  activeWorkoutSplitId: null as string | null,
  avatarUrl: null as string | null,
};

function enrichedWorkout(overrides: Record<string, unknown> = {}) {
  return {
    id: 'w1',
    name: 'Push Day',
    performedAt: '2026-09-01T10:00:00Z',
    completedAt: '2026-09-01T11:00:00Z',
    workoutSplitDayId: null,
    splitDayName: null,
    muscleGroups: [],
    completedSetCount: 12,
    totalVolumeKg: 1250,
    durationMinutes: 60,
    ...overrides,
  };
}

beforeEach(() => {
  mockUseAuth.mockReturnValue({
    user: { id: 'user-1' },
    session: { access_token: 'token-123' },
  });
  mockGetMyProfile.mockReset().mockResolvedValue(baseProfile);
  mockUpdateMyProfile.mockReset().mockResolvedValue(baseProfile);
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
  mockFetchWorkoutHistory.mockReset().mockResolvedValue({ rows: [{ id: 'w1' }], hasMore: false });
  mockEnrichWorkoutSummaries.mockReset().mockResolvedValue([enrichedWorkout()]);
  mockFetchTodaysFoodLogs.mockReset().mockResolvedValue([]);
  mockFetchNutritionGoals
    .mockReset()
    .mockResolvedValue({ calories: null, proteinG: null, carbsG: null, fatG: null });
  mockNavigate.mockClear();
  mockOpenMenu.mockClear();
});

const mockOpenMenu = jest.fn();

// ProfileScreen now renders the shared ModeToggle (via AppMenuContext) --
// this stands in for that root-level provider.
function renderProfile(currentMode: 'workout' | 'nutrition' = 'workout') {
  return render(
    <ProfileProvider>
      <NutritionGoalsProvider>
        <AllTimeStatsProvider>
          <BackgroundThemeProvider>
            <AppMenuContext.Provider
              value={{ openMenu: mockOpenMenu, currentMode }}
            >
              <ProfileScreen navigation={navigation} route={route} />
            </AppMenuContext.Provider>
          </BackgroundThemeProvider>
        </AllTimeStatsProvider>
      </NutritionGoalsProvider>
    </ProfileProvider>,
  );
}

describe('ProfileScreen identity', () => {
  it('shows a loading indicator while fetching', async () => {
    renderProfile();
    expect(screen.getByTestId('profile-loading')).toBeTruthy();
    await screen.findByTestId('profile-display-name');
  });

  it('keeps showing the same Profile content regardless of the selected mode', async () => {
    renderProfile('nutrition');

    expect(await screen.findByTestId('profile-display-name')).toHaveTextContent('Harbir');
    expect(screen.getByTestId('profile-username')).toHaveTextContent('@harbir');
  });

  it('shows the real display name and username, never invented data', async () => {
    renderProfile();

    expect(await screen.findByTestId('profile-display-name')).toHaveTextContent('Harbir');
    expect(screen.getByTestId('profile-username')).toHaveTextContent('@harbir');
  });

  it('falls back to username when displayName is unset', async () => {
    mockGetMyProfile.mockResolvedValue({ ...baseProfile, displayName: null });
    renderProfile();

    expect(await screen.findByTestId('profile-display-name')).toHaveTextContent('harbir');
  });

  it("shows the account's total workout count as an activity-count subtitle under the name", async () => {
    // The default mock resolves 2 completed workouts (see beforeEach).
    renderProfile();

    expect(await screen.findByTestId('profile-activity-count')).toHaveTextContent('2 workouts');
  });

  it('navigates to AccountSettings from both the settings icon and Edit Profile', async () => {
    renderProfile();
    await screen.findByTestId('profile-display-name');

    fireEvent.press(screen.getByTestId('profile-open-settings'));
    expect(mockNavigate).toHaveBeenCalledWith('AccountSettings');

    mockNavigate.mockClear();
    fireEvent.press(screen.getByTestId('profile-edit'));
    expect(mockNavigate).toHaveBeenCalledWith('AccountSettings');
  });
});

describe('ProfileScreen -- Calories & Macros widget', () => {
  it("shows today's calories and macros against goals, and navigates to Nutrition on tap", async () => {
    mockFetchTodaysFoodLogs.mockResolvedValue([
      { id: 'l1', foodId: 'f1', foodNameSnapshot: 'Chicken', servingSize: 100, servingUnit: 'g', quantity: 1, calories: 400, proteinG: 40, carbsG: 10, fatG: 8, mealType: 'lunch', loggedAt: '2026-09-01T12:00:00Z' },
    ]);
    mockFetchNutritionGoals.mockResolvedValue({
      calories: 2200,
      proteinG: 180,
      carbsG: 200,
      fatG: 70,
    });
    renderProfile();

    expect(await screen.findByTestId('profile-nutrition-calories')).toHaveTextContent(
      /400 \/ 2,200/,
    );
    expect(screen.getByTestId('profile-nutrition-protein')).toHaveTextContent(/40g \/ 180g/);
    expect(screen.getByTestId('profile-nutrition-carbs')).toHaveTextContent(/10g \/ 200g/);
    expect(screen.getByTestId('profile-nutrition-fat')).toHaveTextContent(/8g \/ 70g/);

    fireEvent.press(screen.getByTestId('profile-nutrition'));
    expect(mockNavigate).toHaveBeenCalledWith('Nutrition');
  });

  it('shows just the consumed amount, with no "/ goal", when no goal is set', async () => {
    mockFetchTodaysFoodLogs.mockResolvedValue([]);
    renderProfile();

    expect(await screen.findByTestId('profile-nutrition-calories')).toHaveTextContent(/^0/);
    expect(screen.getByTestId('profile-nutrition-calories')).not.toHaveTextContent('/');
  });

  it('shows a nutrition load error without crashing the rest of the screen', async () => {
    mockFetchNutritionGoals.mockRejectedValue(new Error('nutrition down'));
    renderProfile();

    expect(await screen.findByTestId('profile-nutrition-error')).toHaveTextContent('nutrition down');
    expect(screen.getByTestId('profile-display-name')).toBeTruthy();
  });
});

describe('ProfileScreen profile picture', () => {
  it('shows the initial-letter fallback when no picture is set', async () => {
    renderProfile();

    expect(await screen.findByTestId('profile-avatar')).toHaveTextContent(/H/);
  });

  it('displays the saved picture once the profile has one', async () => {
    mockGetMyProfile.mockResolvedValue({
      ...baseProfile,
      avatarUrl: 'https://project.supabase.co/storage/v1/object/public/avatars/user-1/avatar.jpg',
    });
    renderProfile();
    await screen.findByTestId('profile-display-name');

    const image = screen.getByTestId('profile-avatar').findByType(Image);
    expect(image.props.source).toEqual({
      uri: 'https://project.supabase.co/storage/v1/object/public/avatars/user-1/avatar.jpg',
    });
  });

  it('tapping the avatar opens the picture sheet, offering Choose Photo but not Remove Photo when none is set', async () => {
    renderProfile();
    await screen.findByTestId('profile-display-name');

    fireEvent.press(screen.getByTestId('profile-avatar'));

    expect(screen.getByTestId('profile-avatar-choose-photo')).toBeTruthy();
    expect(screen.queryByTestId('profile-avatar-remove-photo')).toBeNull();
  });

  it('offers Remove Photo once a picture is already set', async () => {
    mockGetMyProfile.mockResolvedValue({
      ...baseProfile,
      avatarUrl: 'https://project.supabase.co/storage/v1/object/public/avatars/user-1/avatar.jpg',
    });
    renderProfile();
    await screen.findByTestId('profile-display-name');

    fireEvent.press(screen.getByTestId('profile-avatar'));

    expect(screen.getByTestId('profile-avatar-remove-photo')).toBeTruthy();
  });

  it('selecting and uploading a photo saves it as the profile picture', async () => {
    mockLaunchImageLibraryAsync.mockResolvedValue({
      canceled: false,
      assets: [{ uri: 'file:///tmp/photo.jpg' }],
    });
    mockUploadAvatar.mockResolvedValue(
      'https://project.supabase.co/storage/v1/object/public/avatars/user-1/avatar.jpg?v=1',
    );
    mockUpdateMyProfile.mockResolvedValue({
      ...baseProfile,
      avatarUrl:
        'https://project.supabase.co/storage/v1/object/public/avatars/user-1/avatar.jpg?v=1',
    });
    renderProfile();
    await screen.findByTestId('profile-display-name');

    fireEvent.press(screen.getByTestId('profile-avatar'));
    await act(async () => {
      fireEvent.press(screen.getByTestId('profile-avatar-choose-photo'));
      await Promise.resolve();
      await Promise.resolve();
    });

    expect(mockUploadAvatar).toHaveBeenCalledWith('user-1', 'file:///tmp/photo.jpg');
    expect(mockUpdateMyProfile).toHaveBeenCalledWith('token-123', {
      avatarUrl:
        'https://project.supabase.co/storage/v1/object/public/avatars/user-1/avatar.jpg?v=1',
    });

    const image = screen.getByTestId('profile-avatar').findByType(Image);
    expect(image.props.source).toEqual({
      uri: 'https://project.supabase.co/storage/v1/object/public/avatars/user-1/avatar.jpg?v=1',
    });
  });

  it('changing an existing photo replaces it (same Choose Photo action, new upload)', async () => {
    mockGetMyProfile.mockResolvedValue({
      ...baseProfile,
      avatarUrl:
        'https://project.supabase.co/storage/v1/object/public/avatars/user-1/avatar.jpg?v=1',
    });
    mockLaunchImageLibraryAsync.mockResolvedValue({
      canceled: false,
      assets: [{ uri: 'file:///tmp/new-photo.jpg' }],
    });
    mockUploadAvatar.mockResolvedValue(
      'https://project.supabase.co/storage/v1/object/public/avatars/user-1/avatar.jpg?v=2',
    );
    mockUpdateMyProfile.mockResolvedValue({
      ...baseProfile,
      avatarUrl:
        'https://project.supabase.co/storage/v1/object/public/avatars/user-1/avatar.jpg?v=2',
    });
    renderProfile();
    await screen.findByTestId('profile-display-name');

    fireEvent.press(screen.getByTestId('profile-avatar'));
    await act(async () => {
      fireEvent.press(screen.getByTestId('profile-avatar-choose-photo'));
      await Promise.resolve();
      await Promise.resolve();
    });

    const image = screen.getByTestId('profile-avatar').findByType(Image);
    expect(image.props.source).toEqual({
      uri: 'https://project.supabase.co/storage/v1/object/public/avatars/user-1/avatar.jpg?v=2',
    });
  });

  it('removing the photo deletes the file and clears the profile field, reverting to the fallback', async () => {
    mockGetMyProfile.mockResolvedValue({
      ...baseProfile,
      avatarUrl: 'https://project.supabase.co/storage/v1/object/public/avatars/user-1/avatar.jpg',
    });
    mockUpdateMyProfile.mockResolvedValue({ ...baseProfile, avatarUrl: null });
    renderProfile();
    await screen.findByTestId('profile-display-name');

    fireEvent.press(screen.getByTestId('profile-avatar'));
    await act(async () => {
      fireEvent.press(screen.getByTestId('profile-avatar-remove-photo'));
      await Promise.resolve();
    });

    expect(mockRemoveAvatarFile).toHaveBeenCalledWith('user-1');
    expect(mockUpdateMyProfile).toHaveBeenCalledWith('token-123', { avatarUrl: null });
    expect(screen.getByTestId('profile-avatar')).toHaveTextContent(/H/);
  });

  it('does nothing when the picker is cancelled', async () => {
    mockLaunchImageLibraryAsync.mockResolvedValue({ canceled: true, assets: null });
    renderProfile();
    await screen.findByTestId('profile-display-name');

    fireEvent.press(screen.getByTestId('profile-avatar'));
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
    await screen.findByTestId('profile-display-name');

    fireEvent.press(screen.getByTestId('profile-avatar'));
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
    await screen.findByTestId('profile-display-name');

    fireEvent.press(screen.getByTestId('profile-avatar'));
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

describe('ProfileScreen lifetime stats', () => {
  it('computes Workouts/Total Sets/Total Volume from real data, not hardcoded values', async () => {
    renderProfile();

    expect(await screen.findByTestId('profile-stat-workouts')).toHaveTextContent(/2/);
    expect(screen.getByTestId('profile-stat-sets')).toHaveTextContent(/2/);
    // 100*5 + 60*10 = 1100 kg
    expect(screen.getByTestId('profile-stat-volume')).toHaveTextContent(/1,100/);
  });

  it('shows an error without crashing when the lifetime stats fetch fails', async () => {
    mockFetchAllCompletedWorkouts.mockRejectedValue(new Error('Network down'));
    renderProfile();

    expect(await screen.findByTestId('profile-stats-error')).toHaveTextContent('Network down');
    expect(screen.getByTestId('profile-display-name')).toBeTruthy();
  });
});

// This is a fitness profile, not a social one -- no Friends/followers
// section exists on this screen at all now (previously a placeholder),
// per the explicit redesign layout (header -> stats -> Edit Profile ->
// tabs -> tab content -> bottom nav, nothing else).
describe('ProfileScreen has no social-media functionality', () => {
  it('renders no Friends/followers section', async () => {
    renderProfile();
    await screen.findByTestId('profile-display-name');

    expect(screen.queryByTestId('profile-friends-card')).toBeNull();
    expect(screen.queryByText('Friends')).toBeNull();
  });
});

describe('ProfileScreen Workouts tab', () => {
  it('shows real workout history by default, with real set count and volume, not a photo grid', async () => {
    renderProfile();

    const card = await screen.findByTestId('profile-workout-w1');
    expect(within(card).getByText('Push Day')).toBeTruthy();
    expect(within(card).getByText(/12 sets/)).toBeTruthy();
    // 1250 kg, default 'kg' unit from baseProfile
    expect(within(card).getByText(/1,250/)).toBeTruthy();
  });

  it('shows an empty state instead of fabricating workout posts when there is no history', async () => {
    mockEnrichWorkoutSummaries.mockResolvedValue([]);
    renderProfile();

    expect(await screen.findByTestId('profile-workouts-empty')).toBeTruthy();
  });

  it('navigates to the existing workout detail experience when a row is pressed', async () => {
    renderProfile();
    const card = await screen.findByTestId('profile-workout-w1');

    fireEvent.press(card);

    expect(mockNavigate).toHaveBeenCalledWith('WorkoutDetail', { workoutId: 'w1' });
  });

  it('navigates to WorkoutHistory when View All Workouts is pressed', async () => {
    renderProfile();
    await screen.findByTestId('profile-workout-w1');

    fireEvent.press(screen.getByTestId('profile-view-all-workouts'));

    expect(mockNavigate).toHaveBeenCalledWith('WorkoutHistory');
  });
});

describe('ProfileScreen Stats tab', () => {
  it('shows real lifetime numbers via StatTile, reusing the same lifetimeStats calculation', async () => {
    renderProfile();
    await screen.findByTestId('profile-workout-w1');

    fireEvent.press(screen.getByTestId('profile-tabs-Stats'));

    const workoutsTile = await screen.findByTestId('profile-stat-tile-workouts');
    expect(within(workoutsTile).getByText('2')).toBeTruthy();
    const setsTile = screen.getByTestId('profile-stat-tile-sets');
    expect(within(setsTile).getByText('2')).toBeTruthy();
  });

  it('shows the weekly trend charts, reflecting real data rather than a fabricated placeholder', async () => {
    // Performed "now" (real clock) so the weekly bucketing always lands
    // inside the trend window regardless of when this test actually runs --
    // a fixed historical fixture date would fall outside an 8-week trailing
    // window depending on wall-clock time, making the assertion flaky.
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
    await screen.findByTestId('profile-workout-w1');

    fireEvent.press(screen.getByTestId('profile-tabs-Stats'));

    expect(await screen.findByTestId('profile-trend-workouts-total')).toHaveTextContent(
      /1 workout/,
    );
    expect(screen.getByTestId('profile-trend-volume-total')).toBeTruthy();
    expect(screen.getByTestId('profile-trend-sets-total')).toBeTruthy();
  });

  it("shows This Week's real workout count -- the current (most recent) week's bucket, not a lifetime total", async () => {
    // Same "performed now" reasoning as the trend-chart test above.
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
    await screen.findByTestId('profile-workout-w1');

    fireEvent.press(screen.getByTestId('profile-tabs-Stats'));

    expect(await screen.findByTestId('profile-this-week-workouts')).toHaveTextContent(/^1/);
  });

  it('shows an empty message instead of an empty chart when there is no training data at all', async () => {
    mockFetchAllCompletedWorkouts.mockResolvedValue([]);
    mockFetchAllExerciseHistory.mockResolvedValue([]);
    renderProfile();
    await screen.findByTestId('profile-workout-w1');

    fireEvent.press(screen.getByTestId('profile-tabs-Stats'));

    expect(await screen.findByTestId('profile-trend-workouts-empty')).toBeTruthy();
    expect(screen.queryByTestId('profile-trend-workouts-chart')).toBeNull();
  });

  it('shows real most-trained muscle groups, most-trained first, using the existing calculation', async () => {
    renderProfile();
    await screen.findByTestId('profile-workout-w1');

    fireEvent.press(screen.getByTestId('profile-tabs-Stats'));

    // Fixture has 1 chest set and 1 quadriceps set -- both real, tied counts.
    expect(await screen.findByTestId('profile-muscle-group-chest')).toBeTruthy();
    expect(screen.getByTestId('profile-muscle-group-quadriceps')).toBeTruthy();
  });
});

describe('ProfileScreen PRs tab', () => {
  it('reuses the existing PRsSection component with real PR data', async () => {
    mockFetchAllRepPRs.mockResolvedValue([
      {
        reps: 5,
        bestWeightKg: 100,
        sourceSetId: 's1',
        achievedAt: '2026-09-01T00:00:00Z',
        exerciseId: 'ex1',
        exerciseName: 'Bench Press',
        muscleGroup: 'chest',
      },
    ]);
    renderProfile();
    await screen.findByTestId('profile-workout-w1');

    fireEvent.press(screen.getByTestId('profile-tabs-PRs'));

    expect(await screen.findByTestId('progress-prs-count')).toHaveTextContent('1 PR');
  });

  // Regression guard: the whole page is one vertical ScrollView, so
  // PRsSection must never render its own FlatList here (RN's documented
  // "VirtualizedLists should never be nested inside plain ScrollViews with
  // the same orientation" warning/bug) -- see PRsSection's `scrollable`
  // prop, passed false from this screen.
  it('never nests a FlatList inside the page-level ScrollView, even on the PRs tab', async () => {
    mockFetchAllRepPRs.mockResolvedValue([
      {
        reps: 5,
        bestWeightKg: 100,
        sourceSetId: 's1',
        achievedAt: '2026-09-01T00:00:00Z',
        exerciseId: 'ex1',
        exerciseName: 'Bench Press',
        muscleGroup: 'chest',
      },
    ]);
    renderProfile();
    await screen.findByTestId('profile-workout-w1');

    fireEvent.press(screen.getByTestId('profile-tabs-PRs'));
    await screen.findByTestId('progress-prs-count');

    expect(screen.UNSAFE_queryAllByType(FlatList)).toHaveLength(0);
  });
});

describe('ProfileScreen navigation', () => {
  // The bottom nav is no longer owned by this screen -- it's mounted once
  // at the app-shell level (App.tsx) so it persists across every screen
  // instead of disappearing on navigation; see App.test.tsx's "Persistent
  // bottom navigation" coverage for its active-tab/navigate behavior.
  it('does not render its own bottom nav', async () => {
    renderProfile();
    await screen.findByTestId('profile-display-name');

    expect(screen.queryByTestId('bottom-nav-bar')).toBeNull();
  });

  it('reloads on focus', async () => {
    renderProfile();
    await screen.findByTestId('profile-display-name');

    await waitFor(() => expect(mockGetMyProfile).toHaveBeenCalled());
  });
});

describe('ProfileScreen -- header, widgets, one primary action', () => {
  it('is a stack of widgets: the identity hero, the stats card, the nutrition card, and the active tab in its own card', async () => {
    renderProfile();
    await screen.findByTestId('profile-workout-w1');

    let cards = screen.UNSAFE_queryAllByType(AppCard);
    expect(cards.map((c) => Boolean(c.props.hero))).toEqual([true, false, false, false]);
    expect(
      within(screen.getByTestId('profile-tab-content')).getByTestId('profile-workout-w1'),
    ).toBeTruthy();

    for (const tab of ['Stats', 'PRs']) {
      fireEvent.press(screen.getByTestId(`profile-tabs-${tab}`));
      cards = screen.UNSAFE_queryAllByType(AppCard);
      expect(cards).toHaveLength(4);
    }
  });

  it('puts a named Settings action in the shared header and offers Edit Profile as one outlined button', async () => {
    renderProfile();
    await screen.findByTestId('profile-workout-w1');

    expect(screen.getByTestId('profile-open-settings').props.accessibilityLabel).toBe('Settings');
    const edit = StyleSheet.flatten(screen.getByTestId('profile-edit').props.style);
    expect(edit.backgroundColor).toBeUndefined();
    expect(edit.borderWidth).toBe(1);
    expect(screen.UNSAFE_queryAllByType(PrimaryButton)).toHaveLength(0);
  });

  it('shows each workout as a row, separated by hairlines, none above the first', async () => {
    renderProfile();

    const first = StyleSheet.flatten((await screen.findByTestId('profile-workout-w1')).props.style);
    expect(first.borderTopWidth).toBeUndefined();
    expect(screen.getByTestId('profile-workout-w1').props.accessibilityRole).toBe('button');
  });

  it('renders no bare text outside <Text> on any tab', async () => {
    renderProfile();
    await screen.findByTestId('profile-workout-w1');
    expectNoBareText();

    for (const tab of ['Stats', 'PRs']) {
      fireEvent.press(screen.getByTestId(`profile-tabs-${tab}`));
      expectNoBareText();
    }
  });
});
