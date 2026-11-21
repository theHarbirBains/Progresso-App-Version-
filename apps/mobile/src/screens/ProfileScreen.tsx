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
import { workingSets } from '../workouts/exerciseHistoryGrouping';
import { formatTotalTime } from '../workouts/workoutMonthSummary';
import { PersonProfilePage } from './PersonProfileScreen';
import { profileStyles as styles } from './profileStyles';
import { wholeFigureText } from '../nutrition/wholeFigures';

type Props = RootStackScreenProps<'Profile'>;

const TOP_MUSCLE_GROUPS_LIMIT = 5;

function formatCount(n: number): string {
  return Math.round(n).toLocaleString();
}

// Today's calories and macros against your targets, atop Stats -- real data
// from the shared food log and goals, the same NutritionToday itself uses.
// Each is a block like Stats' own figures: what's eaten as the figure, "of
// 2,200 Calories" under it (just "Calories" with no target). Tapping it opens
// Nutrition Today.
function TodaysNutritionCard({ navigation }: { navigation: Props['navigation'] }) {
  const { nutritionTheme } = useProgressTheme();
  const { goals, loading: goalsLoading, error: goalsError } = useNutritionGoals();
  const { logs, loading: logsLoading, error: logsError } = useFoodLog();
  const totals = useMemo(() => sumDailyTotals(logs), [logs]);
  if (goalsLoading || logsLoading) return <SkeletonCards heights={[150]} />;
  const error = goalsError ?? logsError;
  const figures = [
    { id: 'calories', label: 'Calories', unit: '', eaten: totals.calories, goal: goals?.calories },
    { id: 'protein', label: 'Protein', unit: 'g', eaten: totals.proteinG, goal: goals?.proteinG },
    { id: 'carbs', label: 'Carbs', unit: 'g', eaten: totals.carbsG, goal: goals?.carbsG },
    { id: 'fat', label: 'Fat', unit: 'g', eaten: totals.fatG, goal: goals?.fatG },
  ];

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
      <View style={styles.statBlockGrid}>
        {figures.map((figure) => (
          <View key={figure.id} style={styles.statBlockCell}>
            <StatBlock
              testID={`profile-nutrition-${figure.id}`}
              value={`${wholeFigureText(figure.eaten)}${figure.unit}`}
              label={
                figure.goal != null
                  ? `of ${wholeFigureText(figure.goal)}${figure.unit} ${figure.label}`
                  : figure.label
              }
            />
          </View>
        ))}
      </View>
    </AppCard>
  );
}

// Your own training, under Stats' six figures: this week, your total sets and
// time, and your most-trained muscle groups -- all worked out from the shared
// history (AllTimeStatsProvider) with the same functions Progress uses, and
// only while the Stats tab is open.
function YourTraining() {
  const { weightUnit } = useProgressTheme();
  const { allWorkouts, allSetHistory, statsLoading, statsError } = useAllTimeStats();

  const figures = useMemo(
    () => ({
      totalMinutes: computeLifetimeStats(allWorkouts).totalMinutes,
      muscleGroupCounts: computeMuscleGroupSetCounts(allSetHistory).slice(
        0,
        TOP_MUSCLE_GROUPS_LIMIT,
      ),
      // computeWeekly*'s own contract: one week asked for is this week.
      thisWeekWorkouts: computeWeeklyWorkoutCounts(allWorkouts, 1)[0]?.value ?? 0,
      thisWeekSets: computeWeeklySetCounts(allSetHistory, 1)[0]?.value ?? 0,
      thisWeekVolume: fromKg(computeWeeklyVolumeKg(allSetHistory, 1)[0]?.value ?? 0, weightUnit),
    }),
    [allWorkouts, allSetHistory, weightUnit],
  );

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
          value={formatCount(workingSets(allSetHistory).length)}
        />
        <StatTile
          testID="profile-stat-tile-time"
          label="Training Time"
          value={formatTotalTime(figures.totalMinutes)}
        />
      </View>

      <View style={styles.section}>
        <Text style={styles.muscleGroupsTitle}>Most Trained Muscle Groups</Text>
        {figures.muscleGroupCounts.length === 0 ? (
          <Text style={styles.emptyText}>Your most-trained muscle groups will appear here.</Text>
        ) : (
          figures.muscleGroupCounts.map((mg) => (
            <View
              key={mg.group}
              testID={`profile-muscle-group-${mg.group}`}
              style={styles.muscleGroupRow}
            >
              <Text style={styles.muscleGroupLabel}>{mg.label}</Text>
              <Text style={styles.muscleGroupCount}>
                {mg.count} {mg.count === 1 ? 'set' : 'sets'}
              </Text>
            </View>
          ))
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
// calories and macros (with Nutrition in your membership), this week and
// your muscle groups. The header has Find People, your
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
