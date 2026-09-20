import { useCallback, useEffect, useRef, useState } from 'react';
import { ActivityIndicator, ScrollView, Text, TouchableOpacity, View } from 'react-native';
import { Feather } from '@expo/vector-icons';
import * as ImagePicker from 'expo-image-picker';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useAuth } from '../auth/AuthProvider';
import { AppCard } from '../design/AppCard';
import { Avatar } from '../design/Avatar';
import { BottomSheet } from '../design/BottomSheet';
import { EmptyState } from '../design/EmptyState';
import { LoadingState } from '../design/LoadingState';
import { ModeToggle } from '../design/ModeToggle';
import { StatValue } from '../design/StatValue';
import { colors } from '../design/theme';
import { greetingName } from '../dashboard/greeting';
import { getMyProfile, updateMyProfile, type ProfileResponse } from '../lib/api';
import { removeAvatarFile, uploadAvatar } from '../lib/avatarUpload';
import { fromKg } from '../lib/units';
import { useAppMenu } from '../navigation/AppMenuContext';
import type { RootStackScreenProps } from '../navigation/types';
import { computeLifetimeStats, computeLifetimeVolumeKg } from '../progress/lifetimeStats';
import { computeMuscleGroupSetCounts } from '../progress/muscleGroupProgress';
import { PRsSection } from '../progress/PRsSection';
import { fetchAllCompletedWorkouts } from '../progress/progressStatsQueries';
import { StatTile } from '../progress/StatTile';
import {
  computeWeeklySetCounts,
  computeWeeklyVolumeKg,
  computeWeeklyWorkoutCounts,
} from '../progress/trainingOverTime';
import { useProgressTheme } from '../progress/useProgressTheme';
import { WeeklyTrendChart } from '../progress/WeeklyTrendChart';
import { CategoryTabs } from '../settings/CategoryTabs';
import {
  fetchAllExerciseHistory,
  type HistoricalSetWithExercise,
} from '../workouts/allExerciseHistoryQueries';
import {
  fetchAllOneRepMaxes,
  fetchAllRepPRs,
  type OneRepMaxWithExercise,
  type RepPRWithExercise,
} from '../workouts/prSummaryQueries';
import { SPLIT_MUSCLE_GROUP_LABELS } from '../workouts/splitMuscleGroups';
import { formatTotalTime } from '../workouts/workoutMonthSummary';
import { fetchWorkoutHistory, type WorkoutSummary } from '../workouts/workoutQueries';
import {
  enrichWorkoutSummaries,
  type EnrichedWorkoutSummary,
} from '../workouts/workoutHistoryEnrichment';
import { formatCardDate, formatCardDuration } from './WorkoutHistoryScreen';
import { profileStyles as styles } from './profileStyles';

type Props = RootStackScreenProps<'Profile'>;
type ProfileTab = 'Workouts' | 'Stats' | 'PRs';

const PROFILE_TABS: { key: ProfileTab; label: string }[] = [
  { key: 'Workouts', label: 'Workouts' },
  { key: 'Stats', label: 'Stats' },
  { key: 'PRs', label: 'PRs' },
];

const RECENT_WORKOUTS_LIMIT = 10;
const TREND_WEEKS = 8;
const TOP_MUSCLE_GROUPS_LIMIT = 5;

function formatCount(n: number): string {
  return Math.round(n).toLocaleString();
}

function errorMessage(reason: unknown): string {
  return reason instanceof Error ? reason.message : 'Something went wrong';
}

interface ProfileWorkoutRowProps {
  workout: EnrichedWorkoutSummary;
  accentColor: string;
  weightUnit: 'kg' | 'lb';
  onPress: () => void;
}

// What have I done? -- real workout history, the same enrichment data
// WorkoutHistoryScreen's own WorkoutCard uses, just laid out with the
// set-count/volume summary row this screen's design calls for (WorkoutCard
// itself is left exactly as WorkoutHistoryScreen uses it -- unrelated
// screen, not touched).
function ProfileWorkoutRow({ workout, accentColor, weightUnit, onPress }: ProfileWorkoutRowProps) {
  const title = workout.splitDayName ?? workout.name;
  return (
    <AppCard testID={`profile-workout-${workout.id}`} onPress={onPress} style={styles.workoutCard}>
      <Text style={styles.workoutTitle}>{title}</Text>
      <Text style={styles.workoutMeta}>
        {formatCardDate(workout.performedAt)}
        {workout.durationMinutes !== null
          ? ` · ${formatCardDuration(workout.durationMinutes)}`
          : ''}
      </Text>
      {workout.muscleGroups.length > 0 ? (
        <Text style={styles.workoutMuscleGroups}>
          {workout.muscleGroups.map((g) => SPLIT_MUSCLE_GROUP_LABELS[g]).join(' • ')}
        </Text>
      ) : null}
      <View style={styles.workoutStatsRow}>
        <Text style={styles.workoutStatsText}>
          {workout.completedSetCount} {workout.completedSetCount === 1 ? 'set' : 'sets'}
        </Text>
        <Text style={[styles.workoutStatsValue, { color: accentColor }]}>
          {formatCount(fromKg(workout.totalVolumeKg, weightUnit))} {weightUnit}
        </Text>
      </View>
    </AppCard>
  );
}

// The user's personal fitness profile. Deliberately thin on its own logic:
// every statistic/record/history section here re-fetches and re-derives
// from the exact same functions Dashboard/Progress/Workout History already
// use (fetchAllCompletedWorkouts + computeLifetimeStats, fetchAllExerciseHistory
// + computeLifetimeVolumeKg/computeMuscleGroupSetCounts/trainingOverTime's
// weekly aggregations, fetchAllRepPRs/fetchAllOneRepMaxes + PRsSection,
// fetchWorkoutHistory + enrichWorkoutSummaries) -- nothing here is a new
// calculation. This is a fitness profile, not a social one: no followers/
// likes/photo grid/social badges -- three tabs answering "what have I done"
// (Workouts), "how am I progressing" (Stats), "what have I achieved" (PRs).
// The header's avatar can be tapped to choose/change/remove a real profile
// picture (see Avatar/avatarUpload.ts); with none set, it falls back to the
// same accent-tinted initial-letter/icon avatar already established on
// Dashboard -- there is still no bio/location field, this is a fitness
// profile, not a social one.
export function ProfileScreen({ navigation }: Props) {
  const { user, session } = useAuth();
  const userId = user?.id ?? '';
  const accessToken = session?.access_token;
  const insets = useSafeAreaInsets();
  const { theme, nutritionTheme, weightUnit, themeLoading } = useProgressTheme();
  const { reportMode, currentMode } = useAppMenu();

  // Switching mode from a non-Dashboard root screen always goes to that
  // mode's Home (Dashboard) -- Dashboard is each mode's one true landing
  // page, not a copy of this screen's content in the other mode. A no-op
  // if the tapped segment is already selected.
  function handleModeChange(next: 'workout' | 'nutrition') {
    if (next === currentMode) return;
    reportMode?.(next);
    navigation.navigate('Dashboard');
  }

  const [tab, setTab] = useState<ProfileTab>('Workouts');

  const [profile, setProfile] = useState<ProfileResponse | null>(null);
  const [profileError, setProfileError] = useState<string | null>(null);

  const [allWorkouts, setAllWorkouts] = useState<WorkoutSummary[]>([]);
  const [allSetHistory, setAllSetHistory] = useState<HistoricalSetWithExercise[]>([]);
  const [statsError, setStatsError] = useState<string | null>(null);

  const [repPRs, setRepPRs] = useState<RepPRWithExercise[]>([]);
  const [oneRepMaxes, setOneRepMaxes] = useState<OneRepMaxWithExercise[]>([]);
  const [prsError, setPrsError] = useState<string | null>(null);

  const [recentWorkouts, setRecentWorkouts] = useState<EnrichedWorkoutSummary[]>([]);
  const [workoutsError, setWorkoutsError] = useState<string | null>(null);

  const [avatarSheetOpen, setAvatarSheetOpen] = useState(false);
  const [avatarSaving, setAvatarSaving] = useState(false);
  const [avatarError, setAvatarError] = useState<string | null>(null);

  const [loading, setLoading] = useState(true);
  const hasLoadedOnce = useRef(false);

  const load = useCallback(async () => {
    if (!userId || !accessToken) return;
    if (!hasLoadedOnce.current) setLoading(true);
    setProfileError(null);
    setStatsError(null);
    setPrsError(null);
    setWorkoutsError(null);

    const [profileResult, statsResult, prsResult, historyResult] = await Promise.allSettled([
      getMyProfile(accessToken),
      Promise.all([fetchAllCompletedWorkouts(userId), fetchAllExerciseHistory(userId)]),
      Promise.all([fetchAllRepPRs(userId), fetchAllOneRepMaxes(userId)]),
      fetchWorkoutHistory(userId, 0, RECENT_WORKOUTS_LIMIT).then((result) =>
        enrichWorkoutSummaries(result.rows),
      ),
    ]);

    if (profileResult.status === 'fulfilled') {
      setProfile(profileResult.value);
    } else {
      setProfileError(errorMessage(profileResult.reason));
    }

    if (statsResult.status === 'fulfilled') {
      setAllWorkouts(statsResult.value[0]);
      setAllSetHistory(statsResult.value[1]);
    } else {
      setStatsError(errorMessage(statsResult.reason));
    }

    if (prsResult.status === 'fulfilled') {
      setRepPRs(prsResult.value[0]);
      setOneRepMaxes(prsResult.value[1]);
    } else {
      setPrsError(errorMessage(prsResult.reason));
    }

    if (historyResult.status === 'fulfilled') {
      setRecentWorkouts(historyResult.value);
    } else {
      setWorkoutsError(errorMessage(historyResult.reason));
    }

    setLoading(false);
    hasLoadedOnce.current = true;
  }, [userId, accessToken]);

  useEffect(() => {
    const unsubscribe = navigation.addListener('focus', load);
    return unsubscribe;
  }, [navigation, load]);

  async function handleChoosePhoto() {
    setAvatarSheetOpen(false);
    if (!userId || !accessToken) return;
    setAvatarError(null);

    const permission = await ImagePicker.requestMediaLibraryPermissionsAsync();
    if (!permission.granted) {
      setAvatarError('Photo library permission is required to choose a profile picture.');
      return;
    }

    const result = await ImagePicker.launchImageLibraryAsync({
      mediaTypes: ImagePicker.MediaTypeOptions.Images,
      allowsEditing: true,
      aspect: [1, 1],
      quality: 0.7,
    });
    if (result.canceled || !result.assets[0]) return;

    setAvatarSaving(true);
    try {
      const publicUrl = await uploadAvatar(userId, result.assets[0].uri);
      const updated = await updateMyProfile(accessToken, { avatarUrl: publicUrl });
      setProfile((prev) => (prev ? { ...prev, avatarUrl: updated.avatarUrl } : prev));
    } catch (err) {
      setAvatarError(err instanceof Error ? err.message : 'Failed to update profile picture');
    } finally {
      setAvatarSaving(false);
    }
  }

  async function handleRemovePhoto() {
    setAvatarSheetOpen(false);
    if (!userId || !accessToken) return;
    setAvatarError(null);
    setAvatarSaving(true);
    try {
      await removeAvatarFile(userId);
      const updated = await updateMyProfile(accessToken, { avatarUrl: null });
      setProfile((prev) => (prev ? { ...prev, avatarUrl: updated.avatarUrl } : prev));
    } catch (err) {
      setAvatarError(err instanceof Error ? err.message : 'Failed to remove profile picture');
    } finally {
      setAvatarSaving(false);
    }
  }

  if (loading || themeLoading) {
    return <LoadingState testID="profile-loading" />;
  }

  const name = greetingName(profile?.displayName, profile?.username);
  const avatarInitial = name ? name.charAt(0).toUpperCase() : null;

  const lifetimeStats = computeLifetimeStats(allWorkouts);
  const totalVolumeKg = computeLifetimeVolumeKg(allSetHistory);
  const totalSets = allSetHistory.length;

  const muscleGroupCounts = computeMuscleGroupSetCounts(allSetHistory).slice(
    0,
    TOP_MUSCLE_GROUPS_LIMIT,
  );
  const maxMuscleGroupCount = muscleGroupCounts[0]?.count ?? 0;

  const weeklyWorkoutPoints = computeWeeklyWorkoutCounts(allWorkouts, TREND_WEEKS);
  const weeklyVolumePoints = computeWeeklyVolumeKg(allSetHistory, TREND_WEEKS).map((p) => ({
    ...p,
    value: fromKg(p.value, weightUnit),
  }));
  const weeklySetPoints = computeWeeklySetCounts(allSetHistory, TREND_WEEKS);

  return (
    <View style={[styles.screen, { paddingTop: insets.top }]} testID="profile-screen">
      <ScrollView testID="profile-scroll" contentContainerStyle={styles.scrollContent}>
        <View style={styles.headerRow}>
          <TouchableOpacity
            testID="profile-open-settings"
            style={styles.iconButton}
            onPress={() => navigation.navigate('AccountSettings')}
            accessibilityRole="button"
            accessibilityLabel="Settings"
          >
            <Feather name="settings" size={18} color={colors.textSecondary} />
          </TouchableOpacity>
        </View>

        <View style={styles.modeToggleWrap}>
          <ModeToggle
            mode={currentMode}
            onChange={handleModeChange}
            workoutTheme={theme}
            nutritionTheme={nutritionTheme}
            testIDPrefix="profile"
          />
        </View>

        {profileError ? (
          <Text testID="profile-error" style={styles.errorText}>
            {profileError}
          </Text>
        ) : null}

        {avatarError ? (
          <Text testID="profile-avatar-error" style={styles.errorText}>
            {avatarError}
          </Text>
        ) : null}

        <View style={styles.identityRow}>
          <TouchableOpacity
            testID="profile-avatar"
            style={styles.avatarWrap}
            onPress={() => setAvatarSheetOpen(true)}
            disabled={avatarSaving}
            accessibilityRole="button"
            accessibilityLabel="Change profile picture"
          >
            <View style={[styles.avatar, { backgroundColor: theme.accentBg }]}>
              {avatarSaving ? (
                <ActivityIndicator testID="profile-avatar-saving" color={theme.accent} />
              ) : (
                <Avatar
                  uri={profile?.avatarUrl}
                  initial={avatarInitial}
                  size={72}
                  iconSize={32}
                  iconColor={theme.accent}
                  initialStyle={[styles.avatarInitial, { color: theme.accent }]}
                />
              )}
            </View>
            <View style={[styles.avatarEditBadge, { backgroundColor: theme.accent }]}>
              <Feather name="camera" size={12} color={theme.onAccent} />
            </View>
          </TouchableOpacity>
          <View style={styles.identityBlock}>
            <Text testID="profile-display-name" style={styles.displayName}>
              {name ?? 'Your Profile'}
            </Text>
            {profile?.username ? (
              <Text testID="profile-username" style={styles.username}>
                @{profile.username}
              </Text>
            ) : null}
          </View>
        </View>

        <TouchableOpacity
          testID="profile-edit"
          style={styles.editProfileButton}
          onPress={() => navigation.navigate('AccountSettings')}
          accessibilityRole="button"
        >
          <Text style={styles.editProfileButtonText}>Edit Profile</Text>
        </TouchableOpacity>

        {statsError ? (
          <Text testID="profile-stats-error" style={styles.errorText}>
            {statsError}
          </Text>
        ) : null}
        <View style={styles.statsRow}>
          <View style={styles.statBlock}>
            <StatValue
              testID="profile-stat-workouts"
              value={formatCount(lifetimeStats.totalWorkouts)}
              color={theme.accent}
              size="medium"
            />
            <Text style={styles.statLabel}>Workouts</Text>
          </View>
          <View style={styles.statBlock}>
            <StatValue
              testID="profile-stat-sets"
              value={formatCount(totalSets)}
              color={theme.accent}
              size="medium"
            />
            <Text style={styles.statLabel}>Total Sets</Text>
          </View>
          <View style={styles.statBlock}>
            <StatValue
              testID="profile-stat-volume"
              value={formatCount(fromKg(totalVolumeKg, weightUnit))}
              color={theme.accent}
              size="medium"
            />
            <Text style={styles.statLabel}>Total Volume ({weightUnit})</Text>
          </View>
        </View>

        <View style={styles.tabsWrap}>
          <CategoryTabs
            testID="profile-tabs"
            categories={PROFILE_TABS}
            active={tab}
            onSelect={setTab}
            accentColor={theme.accent}
          />
        </View>

        <View style={styles.tabContent}>
          {tab === 'Workouts' ? (
            <>
              {workoutsError ? (
                <Text testID="profile-workouts-error" style={styles.errorText}>
                  {workoutsError}
                </Text>
              ) : null}
              {recentWorkouts.length === 0 ? (
                <View style={styles.emptyWrap}>
                  <EmptyState
                    testID="profile-workouts-empty"
                    icon={<Feather name="activity" size={24} color={colors.textMuted} />}
                    title="Your workout history will appear here."
                  />
                </View>
              ) : (
                <>
                  {recentWorkouts.map((workout) => (
                    <ProfileWorkoutRow
                      key={workout.id}
                      workout={workout}
                      accentColor={theme.accent}
                      weightUnit={weightUnit}
                      onPress={() =>
                        navigation.navigate('WorkoutDetail', { workoutId: workout.id })
                      }
                    />
                  ))}
                  <TouchableOpacity
                    testID="profile-view-all-workouts"
                    style={styles.viewAllRow}
                    onPress={() => navigation.navigate('WorkoutHistory')}
                    accessibilityRole="button"
                  >
                    <Text style={[styles.viewAllText, { color: theme.accent }]}>
                      View All Workouts
                    </Text>
                  </TouchableOpacity>
                </>
              )}
            </>
          ) : null}

          {tab === 'Stats' ? (
            <>
              <View style={styles.statTileGrid}>
                <StatTile
                  testID="profile-stat-tile-workouts"
                  icon="activity"
                  label="Workouts"
                  value={formatCount(lifetimeStats.totalWorkouts)}
                  accentColor={theme.accent}
                />
                <StatTile
                  testID="profile-stat-tile-sets"
                  icon="check-circle"
                  label="Total Sets"
                  value={formatCount(totalSets)}
                  accentColor={theme.accent}
                />
                <StatTile
                  testID="profile-stat-tile-volume"
                  icon="trending-up"
                  label={`Total Volume (${weightUnit})`}
                  value={formatCount(fromKg(totalVolumeKg, weightUnit))}
                  accentColor={theme.accent}
                />
                <StatTile
                  testID="profile-stat-tile-time"
                  icon="clock"
                  label="Training Time"
                  value={formatTotalTime(lifetimeStats.totalMinutes)}
                  accentColor={theme.accent}
                />
              </View>

              <WeeklyTrendChart
                testID="profile-trend-workouts"
                label="Weekly Workouts"
                points={weeklyWorkoutPoints}
                accentColor={theme.accent}
                formatTotal={(total) =>
                  `${formatCount(total)} ${total === 1 ? 'workout' : 'workouts'} · last ${TREND_WEEKS} weeks`
                }
                emptyMessage="Log a workout to see your weekly trend."
              />

              <WeeklyTrendChart
                testID="profile-trend-volume"
                label="Volume Over Time"
                points={weeklyVolumePoints}
                accentColor={theme.accent}
                formatTotal={(total) =>
                  `${formatCount(total)} ${weightUnit} · last ${TREND_WEEKS} weeks`
                }
                emptyMessage="Log some sets to see your volume trend."
              />

              <WeeklyTrendChart
                testID="profile-trend-sets"
                label="Sets Over Time"
                points={weeklySetPoints}
                accentColor={theme.accent}
                formatTotal={(total) =>
                  `${formatCount(total)} ${total === 1 ? 'set' : 'sets'} · last ${TREND_WEEKS} weeks`
                }
                emptyMessage="Log some sets to see your sets trend."
              />

              <View style={styles.section}>
                <Text style={styles.muscleGroupsTitle}>Most Trained Muscle Groups</Text>
                {muscleGroupCounts.length === 0 ? (
                  <Text style={styles.emptyText}>
                    Your most-trained muscle groups will appear here.
                  </Text>
                ) : (
                  muscleGroupCounts.map((mg) => {
                    const percent = maxMuscleGroupCount > 0 ? mg.count / maxMuscleGroupCount : 0;
                    return (
                      <View
                        key={mg.group}
                        testID={`profile-muscle-group-${mg.group}`}
                        style={styles.muscleGroupRow}
                      >
                        <View style={styles.muscleGroupLabelRow}>
                          <Text style={styles.muscleGroupLabel}>{mg.label}</Text>
                          <Text style={styles.muscleGroupCount}>
                            {mg.count} {mg.count === 1 ? 'set' : 'sets'}
                          </Text>
                        </View>
                        <View style={styles.muscleGroupBarTrack}>
                          <View
                            style={[
                              styles.muscleGroupBarFill,
                              { width: `${percent * 100}%`, backgroundColor: theme.accent },
                            ]}
                          />
                        </View>
                      </View>
                    );
                  })
                )}
              </View>
            </>
          ) : null}

          {tab === 'PRs' ? (
            <>
              {prsError ? (
                <Text testID="profile-prs-error" style={styles.errorText}>
                  {prsError}
                </Text>
              ) : null}
              <PRsSection
                repPRs={repPRs}
                oneRepMaxes={oneRepMaxes}
                weightUnit={weightUnit}
                accentColor={theme.accent}
                navigation={navigation}
                scrollable={false}
              />
            </>
          ) : null}
        </View>
      </ScrollView>

      <BottomSheet
        visible={avatarSheetOpen}
        onClose={() => setAvatarSheetOpen(false)}
        testID="profile-avatar-sheet"
      >
        <Text style={styles.avatarSheetTitle}>Profile Picture</Text>
        <TouchableOpacity
          testID="profile-avatar-choose-photo"
          style={styles.avatarSheetAction}
          onPress={handleChoosePhoto}
          accessibilityRole="button"
        >
          <Feather name="image" size={18} color={colors.textPrimary} />
          <Text style={styles.avatarSheetActionLabel}>Choose Photo</Text>
        </TouchableOpacity>
        {profile?.avatarUrl ? (
          <TouchableOpacity
            testID="profile-avatar-remove-photo"
            style={styles.avatarSheetAction}
            onPress={handleRemovePhoto}
            accessibilityRole="button"
          >
            <Feather name="trash-2" size={18} color={colors.destructive} />
            <Text style={[styles.avatarSheetActionLabel, styles.avatarSheetActionDestructive]}>
              Remove Photo
            </Text>
          </TouchableOpacity>
        ) : null}
      </BottomSheet>
    </View>
  );
}
