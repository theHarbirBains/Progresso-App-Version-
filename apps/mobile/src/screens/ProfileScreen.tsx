import { useCallback, useEffect, useRef, useState } from 'react';
import { ActivityIndicator, TouchableOpacity, View } from 'react-native';
import { Text } from '../design/Text';
import { Feather } from '@expo/vector-icons';
import * as ImagePicker from 'expo-image-picker';
import { useAuth } from '../auth/AuthProvider';
import { AppCard } from '../design/AppCard';
import { AppHeader } from '../design/AppHeader';
import { Avatar } from '../design/Avatar';
import { BottomSheet } from '../design/BottomSheet';
import { SecondaryButton, TextButton } from '../design/Button';
import { EmptyState } from '../design/EmptyState';
import { ListRow } from '../design/ListRow';
import { LoadingState } from '../design/LoadingState';
import { Screen } from '../design/Screen';
import { StatBlock } from '../design/StatBlock';
import { UnderlineTabs } from '../design/UnderlineTabs';
import { greetingName } from '../dashboard/greeting';
import { removeAvatarFile, uploadAvatar } from '../lib/avatarUpload';
import { fromKg } from '../lib/units';
import type { RootStackScreenProps } from '../navigation/types';
import { useFoodLog } from '../nutrition/FoodLogProvider';
import { sumDailyTotals } from '../nutrition/nutritionCalculations';
import { useNutritionGoals } from '../nutrition/NutritionGoalsProvider';
import { useProfile } from '../profile/ProfileProvider';
import { useAllTimeStats } from '../progress/AllTimeStatsProvider';
import { computeLifetimeStats, computeLifetimeVolumeKg } from '../progress/lifetimeStats';
import { computeMuscleGroupSetCounts } from '../progress/muscleGroupProgress';
import { PRsSection } from '../progress/PRsSection';
import { StatTile } from '../progress/StatTile';
import {
  computeWeeklySetCounts,
  computeWeeklyVolumeKg,
  computeWeeklyWorkoutCounts,
} from '../progress/trainingOverTime';
import { useProgressTheme } from '../progress/useProgressTheme';
import { WeeklyTrendChart } from '../progress/WeeklyTrendChart';
import { SPLIT_MUSCLE_GROUP_LABELS } from '../workouts/splitMuscleGroups';
import { formatTotalTime } from '../workouts/workoutMonthSummary';
import { fetchWorkoutHistory } from '../workouts/workoutQueries';
import {
  enrichWorkoutSummaries,
  type EnrichedWorkoutSummary,
} from '../workouts/workoutHistoryEnrichment';
import { formatCardDate, formatCardDuration } from '../workouts/workoutFormat';
import { profileStyles as styles } from './profileStyles';

type Props = RootStackScreenProps<'Profile'>;
type ProfileTab = 'Workouts' | 'Stats' | 'PRs';

const PROFILE_TABS: { key: ProfileTab; label: string; icon: keyof typeof Feather.glyphMap }[] = [
  { key: 'Workouts', label: 'Workouts', icon: 'list' },
  { key: 'Stats', label: 'Stats', icon: 'bar-chart-2' },
  { key: 'PRs', label: 'PRs', icon: 'award' },
];

const RECENT_WORKOUTS_LIMIT = 10;
const TREND_WEEKS = 12;
const TOP_MUSCLE_GROUPS_LIMIT = 5;

function formatCount(n: number): string {
  return Math.round(n).toLocaleString();
}

/** "1,850 / 2,200 cal" when a goal is set, else just "1,850 cal". Shared by every macro in the Calories & Macros widget. */
function formatMacro(consumed: number, goal: number | null, unit: string): string {
  const consumedText = `${formatCount(consumed)}${unit}`;
  return goal !== null ? `${consumedText} / ${formatCount(goal)}${unit}` : consumedText;
}

function errorMessage(reason: unknown): string {
  return reason instanceof Error ? reason.message : 'Something went wrong';
}

interface ProfileWorkoutRowProps {
  workout: EnrichedWorkoutSummary;
  weightUnit: 'kg' | 'lb';
  divider: boolean;
  onPress: () => void;
}

// What have I done? -- real workout history, the same enrichment data
// WorkoutHistoryScreen's own WorkoutRow uses, laid out as a plain row with the
// set count and volume added to its one muted detail line.
function ProfileWorkoutRow({ workout, weightUnit, divider, onPress }: ProfileWorkoutRowProps) {
  const muscles = workout.muscleGroups.map((g) => SPLIT_MUSCLE_GROUP_LABELS[g]).join(' • ');
  const sets = `${workout.completedSetCount} ${workout.completedSetCount === 1 ? 'set' : 'sets'}`;
  const duration =
    workout.durationMinutes !== null ? ` · ${formatCardDuration(workout.durationMinutes)}` : '';
  return (
    <ListRow
      testID={`profile-workout-${workout.id}`}
      title={workout.splitDayName ?? workout.name}
      subtitle={muscles || undefined}
      detail={`${formatCardDate(workout.performedAt)}${duration} · ${sets} · ${formatCount(fromKg(workout.totalVolumeKg, weightUnit))} ${weightUnit}`}
      divider={divider}
      onPress={onPress}
    />
  );
}

// The You tab's own root screen (see App.tsx's bottom nav). Deliberately
// thin on its own logic: every statistic/record/history section here
// re-fetches and re-derives from the exact same functions Progress/Workout
// History already use (fetchAllCompletedWorkouts + computeLifetimeStats,
// fetchAllExerciseHistory + computeLifetimeVolumeKg/
// computeMuscleGroupSetCounts/trainingOverTime's weekly aggregations,
// fetchAllRepPRs/fetchAllOneRepMaxes + PRsSection, fetchWorkoutHistory +
// enrichWorkoutSummaries) -- nothing here is a new calculation. This is a
// fitness profile, not a social one: no followers/likes/photo grid/social
// badges -- three tabs answering "what have I done" (Workouts), "how am I
// progressing" (Stats), "what have I achieved" (PRs).
//
// Layout: a hero identity card (avatar, name, Edit Profile), a stats card
// (Workouts/Total Sets/Total Volume as StatBlocks), then the Workouts/
// Stats/PRs tabs with the active tab's content in its own widget -- the
// same AppCard-per-widget language the workout and nutrition screens use.
// The header's avatar can be tapped to choose/change/remove a real profile
// picture (see Avatar/avatarUpload.ts); with none set, it falls back to the
// same accent-tinted initial-letter/icon avatar used elsewhere -- there is
// still no bio/location field, this is a fitness profile, not a social one.
export function ProfileScreen({ navigation }: Props) {
  const { user } = useAuth();
  const userId = user?.id ?? '';
  const { theme, nutritionTheme, weightUnit, themeLoading } = useProgressTheme();
  const { profile, error: profileError, updateProfile } = useProfile();
  const {
    goals: nutritionGoals,
    loading: nutritionGoalsLoading,
    error: nutritionGoalsError,
  } = useNutritionGoals();
  // The user's whole workout/set/PR history, shared with ProgressOverviewScreen
  // via AllTimeStatsProvider -- fetched once (refreshed only after a workout
  // is completed, not on every visit to this tab).
  const { allWorkouts, allSetHistory, repPRs, oneRepMaxes, statsLoading, statsError, prsLoading, prsError } =
    useAllTimeStats();

  const { logs: todaysFoodLogs, loading: logsLoading, error: logsError } = useFoodLog();
  const displayNutritionError = nutritionGoalsError ?? logsError;

  const [tab, setTab] = useState<ProfileTab>('Workouts');

  const [recentWorkouts, setRecentWorkouts] = useState<EnrichedWorkoutSummary[]>([]);
  const [workoutsError, setWorkoutsError] = useState<string | null>(null);

  const [avatarSheetOpen, setAvatarSheetOpen] = useState(false);
  const [avatarSaving, setAvatarSaving] = useState(false);
  const [avatarError, setAvatarError] = useState<string | null>(null);

  const [loading, setLoading] = useState(true);
  const hasLoadedOnce = useRef(false);

  const load = useCallback(async () => {
    if (!userId) return;
    if (!hasLoadedOnce.current) setLoading(true);
    setWorkoutsError(null);

    try {
      const result = await fetchWorkoutHistory(userId, 0, RECENT_WORKOUTS_LIMIT);
      setRecentWorkouts(await enrichWorkoutSummaries(result.rows));
    } catch (err) {
      setWorkoutsError(errorMessage(err));
    }

    setLoading(false);
    hasLoadedOnce.current = true;
  }, [userId]);

  useEffect(() => {
    const unsubscribe = navigation.addListener('focus', load);
    return unsubscribe;
  }, [navigation, load]);

  async function handleChoosePhoto() {
    setAvatarSheetOpen(false);
    if (!userId) return;
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
      await updateProfile({ avatarUrl: publicUrl });
    } catch (err) {
      setAvatarError(err instanceof Error ? err.message : 'Failed to update profile picture');
    } finally {
      setAvatarSaving(false);
    }
  }

  async function handleRemovePhoto() {
    setAvatarSheetOpen(false);
    if (!userId) return;
    setAvatarError(null);
    setAvatarSaving(true);
    try {
      await removeAvatarFile(userId);
      await updateProfile({ avatarUrl: null });
    } catch (err) {
      setAvatarError(err instanceof Error ? err.message : 'Failed to remove profile picture');
    } finally {
      setAvatarSaving(false);
    }
  }

  if (loading || themeLoading || nutritionGoalsLoading || statsLoading || prsLoading || logsLoading) {
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
  // computeWeekly*'s own contract: oldest first, always including the
  // current week -- so the last point is "this week".
  const thisWeekWorkouts = weeklyWorkoutPoints[weeklyWorkoutPoints.length - 1]?.value ?? 0;
  const thisWeekSets = weeklySetPoints[weeklySetPoints.length - 1]?.value ?? 0;
  const thisWeekVolume = weeklyVolumePoints[weeklyVolumePoints.length - 1]?.value ?? 0;

  const todaysNutritionTotals = sumDailyTotals(todaysFoodLogs);

  return (
    <>
      <Screen
        testID="profile-screen"
        scrollTestID="profile-scroll"
        contentContainerStyle={styles.scrollContent}
        header={
          <AppHeader
            title="Profile"
            rightAction={{
              icon: 'settings',
              onPress: () => navigation.navigate('AccountSettings'),
              accessibilityLabel: 'Settings',
              testID: 'profile-open-settings',
            }}
          />
        }
      >
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

        <AppCard hero topAccent={theme.accent} testID="profile-identity">
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
              <Text testID="profile-activity-count" style={styles.activityCount}>
                {formatCount(lifetimeStats.totalWorkouts)}{' '}
                {lifetimeStats.totalWorkouts === 1 ? 'workout' : 'workouts'}
              </Text>
              {profile?.username ? (
                <Text testID="profile-username" style={styles.username}>
                  @{profile.username}
                </Text>
              ) : null}
            </View>
          </View>

          <View style={styles.editProfileWrap}>
            <SecondaryButton
              testID="profile-edit"
              label="Edit Profile"
              onPress={() => navigation.navigate('AccountSettings')}
            />
          </View>
        </AppCard>

        <AppCard testID="profile-stats">
          {statsError ? (
            <Text testID="profile-stats-error" style={styles.errorText}>
              {statsError}
            </Text>
          ) : null}
          <View style={styles.statsRow}>
            <StatBlock
              testID="profile-stat-workouts"
              value={formatCount(lifetimeStats.totalWorkouts)}
              label="Workouts"
            />
            <StatBlock
              testID="profile-stat-sets"
              value={formatCount(totalSets)}
              label="Total Sets"
            />
            <StatBlock
              testID="profile-stat-volume"
              value={formatCount(fromKg(totalVolumeKg, weightUnit))}
              label={`Total Volume (${weightUnit})`}
            />
          </View>
        </AppCard>

        <AppCard
          testID="profile-nutrition"
          topAccent={nutritionTheme.accent}
          onPress={() => navigation.navigate('Nutrition')}
        >
          <Text style={styles.nutritionTitle}>Today&apos;s Calories & Macros</Text>
          {displayNutritionError ? (
            <Text testID="profile-nutrition-error" style={styles.errorText}>
              {displayNutritionError}
            </Text>
          ) : null}
          <View style={styles.statTileGrid}>
            <StatTile
              testID="profile-nutrition-calories"
              label="Calories"
              value={formatMacro(
                todaysNutritionTotals.calories,
                nutritionGoals?.calories ?? null,
                '',
              )}
            />
            <StatTile
              testID="profile-nutrition-protein"
              label="Protein"
              value={formatMacro(
                todaysNutritionTotals.proteinG,
                nutritionGoals?.proteinG ?? null,
                'g',
              )}
            />
            <StatTile
              testID="profile-nutrition-carbs"
              label="Carbs"
              value={formatMacro(todaysNutritionTotals.carbsG, nutritionGoals?.carbsG ?? null, 'g')}
            />
            <StatTile
              testID="profile-nutrition-fat"
              label="Fat"
              value={formatMacro(todaysNutritionTotals.fatG, nutritionGoals?.fatG ?? null, 'g')}
            />
          </View>
        </AppCard>

        <View style={styles.tabsWrap}>
          <UnderlineTabs
            testID="profile-tabs"
            categories={PROFILE_TABS}
            active={tab}
            onSelect={setTab}
            accentColor={theme.accent}
          />
        </View>

        {tab === 'Workouts' ? (
          <AppCard testID="profile-tab-content">
            {workoutsError ? (
              <Text testID="profile-workouts-error" style={styles.errorText}>
                {workoutsError}
              </Text>
            ) : null}
            {recentWorkouts.length === 0 ? (
              <EmptyState
                testID="profile-workouts-empty"
                title="Your workout history will appear here."
              />
            ) : (
              <>
                {recentWorkouts.map((workout, index) => (
                  <ProfileWorkoutRow
                    key={workout.id}
                    workout={workout}
                    weightUnit={weightUnit}
                    divider={index > 0}
                    onPress={() => navigation.navigate('WorkoutDetail', { workoutId: workout.id })}
                  />
                ))}
                <TextButton
                  testID="profile-view-all-workouts"
                  label="View All Workouts"
                  onPress={() => navigation.navigate('WorkoutHistory')}
                />
              </>
            )}
          </AppCard>
        ) : null}

        {tab === 'Stats' ? (
          <AppCard testID="profile-tab-content">
            <Text style={styles.thisWeekTitle}>This Week</Text>
            <View style={styles.thisWeekRow}>
              <StatBlock
                testID="profile-this-week-workouts"
                value={formatCount(thisWeekWorkouts)}
                label="Workouts"
              />
              <StatBlock
                testID="profile-this-week-sets"
                value={formatCount(thisWeekSets)}
                label="Sets"
              />
              <StatBlock
                testID="profile-this-week-volume"
                value={formatCount(thisWeekVolume)}
                label={`Volume (${weightUnit})`}
              />
            </View>

            <View style={styles.statTileGrid}>
              <StatTile
                testID="profile-stat-tile-workouts"
                label="Workouts"
                value={formatCount(lifetimeStats.totalWorkouts)}
              />
              <StatTile
                testID="profile-stat-tile-sets"
                label="Total Sets"
                value={formatCount(totalSets)}
              />
              <StatTile
                testID="profile-stat-tile-volume"
                label={`Total Volume (${weightUnit})`}
                value={formatCount(fromKg(totalVolumeKg, weightUnit))}
              />
              <StatTile
                testID="profile-stat-tile-time"
                label="Training Time"
                value={formatTotalTime(lifetimeStats.totalMinutes)}
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
          </AppCard>
        ) : null}

        {tab === 'PRs' ? (
          <AppCard testID="profile-tab-content">
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
          </AppCard>
        ) : null}
      </Screen>

      <BottomSheet
        visible={avatarSheetOpen}
        onClose={() => setAvatarSheetOpen(false)}
        testID="profile-avatar-sheet"
      >
        <Text style={styles.avatarSheetTitle}>Profile Picture</Text>
        <ListRow
          testID="profile-avatar-choose-photo"
          icon="image"
          title="Choose Photo"
          onPress={handleChoosePhoto}
        />
        {profile?.avatarUrl ? (
          <ListRow
            testID="profile-avatar-remove-photo"
            icon="trash-2"
            title="Remove Photo"
            destructive
            divider
            onPress={handleRemovePhoto}
          />
        ) : null}
      </BottomSheet>
    </>
  );
}
