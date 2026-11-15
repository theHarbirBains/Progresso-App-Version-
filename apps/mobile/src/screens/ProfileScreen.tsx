import { useMemo } from 'react';
import { View } from 'react-native';
import { Text } from '../design/Text';
import { useAuth } from '../auth/AuthProvider';
import { AppCard } from '../design/AppCard';
import { AppHeader } from '../design/AppHeader';
import { BottomSheet } from '../design/BottomSheet';
import { ListRow } from '../design/ListRow';
import { SkeletonCards } from '../design/Skeleton';
import { StatBlock } from '../design/StatBlock';
import { fromKg } from '../lib/units';
import { useMembership } from '../membership/useMembership';
import type { RootStackScreenProps } from '../navigation/types';
import { useFoodLog } from '../nutrition/FoodLogProvider';
import { sumDailyTotals } from '../nutrition/nutritionCalculations';
import { useNutritionGoals } from '../nutrition/NutritionGoalsProvider';
import { useProfile } from '../profile/ProfileProvider';
import { useAvatarPhoto } from '../profile/useAvatarPhoto';
import { useAllTimeStats } from '../progress/AllTimeStatsProvider';
import { computeLifetimeStats } from '../progress/lifetimeStats';
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
import { formatTotalTime } from '../workouts/workoutMonthSummary';
import { PersonProfilePage } from './PersonProfileScreen';
import { profileStyles as styles } from './profileStyles';
import { wholeFigureText } from '../nutrition/wholeFigures';

type Props = RootStackScreenProps<'Profile'>;

const TREND_WEEKS = 12;
const TOP_MUSCLE_GROUPS_LIMIT = 5;

function formatCount(n: number): string {
  return Math.round(n).toLocaleString();
}

/** "1,850 / 2,200 cal" when a goal is set, else just "1,850 cal". Shared by every macro in the Calories & Macros widget. */
function formatMacro(consumed: number, goal: number | null, unit: string): string {
  const consumedText = `${wholeFigureText(consumed)}${unit}`;
  return goal !== null ? `${consumedText} / ${wholeFigureText(goal)}${unit}` : consumedText;
}

// Today's calories and macros against your targets, atop Stats -- real data
// from the shared food log and goals, the same NutritionToday itself uses.
// Tapping it opens Nutrition Today.
function TodaysNutritionCard({ navigation }: { navigation: Props['navigation'] }) {
  const { nutritionTheme } = useProgressTheme();
  const { goals, loading: goalsLoading, error: goalsError } = useNutritionGoals();
  const { logs, loading: logsLoading, error: logsError } = useFoodLog();
  const totals = useMemo(() => sumDailyTotals(logs), [logs]);
  if (goalsLoading || logsLoading) return <SkeletonCards heights={[150]} />;
  const error = goalsError ?? logsError;

  return (
    <AppCard
      testID="profile-nutrition"
      topAccent={nutritionTheme.accent}
      onPress={() => navigation.navigate('Nutrition')}
    >
      <Text style={styles.nutritionTitle}>Today&apos;s Calories & Macros</Text>
      {error ? (
        <Text testID="profile-nutrition-error" style={styles.errorText}>
          {error}
        </Text>
      ) : null}
      <View style={styles.statTileGrid}>
        <StatTile
          testID="profile-nutrition-calories"
          label="Calories"
          value={formatMacro(totals.calories, goals?.calories ?? null, '')}
        />
        <StatTile
          testID="profile-nutrition-protein"
          label="Protein"
          value={formatMacro(totals.proteinG, goals?.proteinG ?? null, 'g')}
        />
        <StatTile
          testID="profile-nutrition-carbs"
          label="Carbs"
          value={formatMacro(totals.carbsG, goals?.carbsG ?? null, 'g')}
        />
        <StatTile
          testID="profile-nutrition-fat"
          label="Fat"
          value={formatMacro(totals.fatG, goals?.fatG ?? null, 'g')}
        />
      </View>
    </AppCard>
  );
}

// Your own training, under Stats' six figures: this week, your total sets and
// time, the 12-week trends and your most-trained muscle groups -- all worked
// out from the shared history (AllTimeStatsProvider) with the same functions
// Progress uses, and only while the Stats tab is open.
function YourTraining() {
  const { theme, weightUnit } = useProgressTheme();
  const { allWorkouts, allSetHistory, statsLoading, statsError } = useAllTimeStats();

  const figures = useMemo(() => {
    const muscleGroupCounts = computeMuscleGroupSetCounts(allSetHistory).slice(
      0,
      TOP_MUSCLE_GROUPS_LIMIT,
    );
    const weeklyWorkoutPoints = computeWeeklyWorkoutCounts(allWorkouts, TREND_WEEKS);
    const weeklyVolumePoints = computeWeeklyVolumeKg(allSetHistory, TREND_WEEKS).map((p) => ({
      ...p,
      value: fromKg(p.value, weightUnit),
    }));
    const weeklySetPoints = computeWeeklySetCounts(allSetHistory, TREND_WEEKS);
    // computeWeekly*'s own contract: oldest first, always including the
    // current week -- so the last point is "this week".
    return {
      totalMinutes: computeLifetimeStats(allWorkouts).totalMinutes,
      muscleGroupCounts,
      maxMuscleGroupCount: muscleGroupCounts[0]?.count ?? 0,
      weeklyWorkoutPoints,
      weeklyVolumePoints,
      weeklySetPoints,
      thisWeekWorkouts: weeklyWorkoutPoints[weeklyWorkoutPoints.length - 1]?.value ?? 0,
      thisWeekSets: weeklySetPoints[weeklySetPoints.length - 1]?.value ?? 0,
      thisWeekVolume: weeklyVolumePoints[weeklyVolumePoints.length - 1]?.value ?? 0,
    };
  }, [allWorkouts, allSetHistory, weightUnit]);

  if (statsLoading) return <SkeletonCards heights={[320]} />;

  return (
    <AppCard testID="profile-training">
      {statsError ? (
        <Text testID="profile-stats-error" style={styles.errorText}>
          {statsError}
        </Text>
      ) : null}
      <Text style={styles.thisWeekTitle}>This Week</Text>
      <View style={styles.thisWeekRow}>
        <StatBlock
          testID="profile-this-week-workouts"
          value={formatCount(figures.thisWeekWorkouts)}
          label="Workouts"
        />
        <StatBlock
          testID="profile-this-week-sets"
          value={formatCount(figures.thisWeekSets)}
          label="Sets"
        />
        <StatBlock
          testID="profile-this-week-volume"
          value={formatCount(figures.thisWeekVolume)}
          label={`Volume (${weightUnit})`}
        />
      </View>

      <View style={styles.statTileGrid}>
        <StatTile
          testID="profile-stat-tile-sets"
          label="Total Sets"
          value={formatCount(allSetHistory.length)}
        />
        <StatTile
          testID="profile-stat-tile-time"
          label="Training Time"
          value={formatTotalTime(figures.totalMinutes)}
        />
      </View>

      <WeeklyTrendChart
        testID="profile-trend-workouts"
        label="Weekly Workouts"
        points={figures.weeklyWorkoutPoints}
        accentColor={theme.accent}
        formatTotal={(total) =>
          `${formatCount(total)} ${total === 1 ? 'workout' : 'workouts'} · last ${TREND_WEEKS} weeks`
        }
        emptyMessage="Log a workout to see your weekly trend."
      />

      <WeeklyTrendChart
        testID="profile-trend-volume"
        label="Volume Over Time"
        points={figures.weeklyVolumePoints}
        accentColor={theme.accent}
        formatTotal={(total) => `${formatCount(total)} ${weightUnit} · last ${TREND_WEEKS} weeks`}
        emptyMessage="Log some sets to see your volume trend."
      />

      <WeeklyTrendChart
        testID="profile-trend-sets"
        label="Sets Over Time"
        points={figures.weeklySetPoints}
        accentColor={theme.accent}
        formatTotal={(total) =>
          `${formatCount(total)} ${total === 1 ? 'set' : 'sets'} · last ${TREND_WEEKS} weeks`
        }
        emptyMessage="Log some sets to see your sets trend."
      />

      <View style={styles.section}>
        <Text style={styles.muscleGroupsTitle}>Most Trained Muscle Groups</Text>
        {figures.muscleGroupCounts.length === 0 ? (
          <Text style={styles.emptyText}>Your most-trained muscle groups will appear here.</Text>
        ) : (
          figures.muscleGroupCounts.map((mg) => {
            const percent =
              figures.maxMuscleGroupCount > 0 ? mg.count / figures.maxMuscleGroupCount : 0;
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
  );
}

// Every record you hold, under PRs' Heaviest Lifts: rep PRs, true 1RMs and a
// bodyweight or timed exercise's best (PRsSection, shared with Progress).
function YourRecords({ navigation }: { navigation: Props['navigation'] }) {
  const { theme, weightUnit } = useProgressTheme();
  const { repPRs, oneRepMaxes, exerciseRecords, prsLoading, prsError } = useAllTimeStats();
  if (prsLoading) return <SkeletonCards heights={[220]} />;

  return (
    <AppCard testID="profile-records">
      {prsError ? (
        <Text testID="profile-prs-error" style={styles.errorText}>
          {prsError}
        </Text>
      ) : null}
      <PRsSection
        repPRs={repPRs}
        oneRepMaxes={oneRepMaxes}
        exerciseRecords={exerciseRecords}
        weightUnit={weightUnit}
        accentColor={theme.accent}
        navigation={navigation}
        scrollable={false}
      />
    </AppCard>
  );
}

// The You tab's own root screen (see App.tsx's bottom nav): your profile
// exactly as the people who follow you see it (PersonProfilePage) -- photo,
// name, bio, counts, Edit Profile and Share, the four figures, and
// Achievements / Workouts / PRs / Stats -- plus what's yours alone, inside
// the same tabs: your full records under PRs, and under Stats today's
// calories and macros (with Nutrition in your membership), your weekly
// trends and your muscle groups. The header has Find People, your
// @username and Settings,
// and tapping your photo chooses, changes or removes it (useAvatarPhoto).
export function ProfileScreen({ navigation }: Props) {
  const { user } = useAuth();
  const userId = user?.id ?? '';
  const { themeLoading } = useProgressTheme();
  const { profile, error: profileError } = useProfile();
  const { nutrition } = useMembership();
  const { loading: goalsLoading } = useNutritionGoals();
  const { loading: logsLoading } = useFoodLog();
  const { statsLoading, prsLoading } = useAllTimeStats();
  const avatar = useAvatarPhoto(userId);

  const notices =
    profileError || avatar.error ? (
      <View style={styles.notices}>
        {profileError ? (
          <Text testID="profile-error" style={styles.errorText}>
            {profileError}
          </Text>
        ) : null}
        {avatar.error ? (
          <Text testID="profile-avatar-error" style={styles.errorText}>
            {avatar.error}
          </Text>
        ) : null}
      </View>
    ) : null;

  return (
    <>
      <PersonProfilePage
        userId={userId}
        navigation={navigation}
        own={{
          header: (
            <AppHeader
              testID="profile-header"
              title={profile?.username ? `@${profile.username}` : undefined}
              leftAction={{
                icon: 'search',
                onPress: () => navigation.navigate('FindPeople'),
                accessibilityLabel: 'Find people',
                testID: 'profile-find-people',
              }}
              rightAction={{
                icon: 'settings',
                onPress: () => navigation.navigate('AccountSettings'),
                accessibilityLabel: 'Settings',
                testID: 'profile-open-settings',
              }}
            />
          ),
          identity: profile
            ? {
                displayName: profile.displayName,
                lastName: profile.lastName,
                username: profile.username,
                avatarUrl: profile.avatarUrl,
                bio: profile.bio,
              }
            : null,
          avatar: { onPress: avatar.openSheet, saving: avatar.saving },
          notices,
          stats: (
            <>
              {nutrition ? <TodaysNutritionCard navigation={navigation} /> : null}
              <YourTraining />
            </>
          ),
          prs: <YourRecords navigation={navigation} />,
          ready:
            !themeLoading &&
            !statsLoading &&
            !prsLoading &&
            (!nutrition || (!goalsLoading && !logsLoading)),
        }}
      />

      <BottomSheet
        visible={avatar.sheetOpen}
        onClose={avatar.closeSheet}
        testID="profile-avatar-sheet"
      >
        <Text style={styles.avatarSheetTitle}>Profile Picture</Text>
        <ListRow
          testID="profile-avatar-choose-photo"
          icon="image"
          title="Choose Photo"
          onPress={avatar.choosePhoto}
        />
        {profile?.avatarUrl ? (
          <ListRow
            testID="profile-avatar-remove-photo"
            icon="trash-2"
            title="Remove Photo"
            destructive
            divider
            onPress={avatar.removePhoto}
          />
        ) : null}
      </BottomSheet>
    </>
  );
}
