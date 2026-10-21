import { useMemo, type ReactNode } from 'react';
import { ScrollView, TouchableOpacity, View } from 'react-native';
import { Text } from '../design/Text';
import { Feather } from '@expo/vector-icons';
import { fromKg, roundWeight } from '../lib/units';
import type { RootStackScreenProps } from '../navigation/types';
import type { ExerciseHistoryGroup } from '../workouts/allExerciseHistoryQueries';
import type {
  ExerciseRecordWithExercise,
  OneRepMaxWithExercise,
  RepPRWithExercise,
} from '../workouts/prSummaryQueries';
import type { LifetimeStats } from './lifetimeStats';
import { mergeAndSortPRs, recordValueText } from './prFeed';
import { PRRow } from './PRRow';
import { ProgressEmptyState } from './ProgressEmptyState';
import { progressStyles as styles } from './progressStyles';

type Navigation = RootStackScreenProps<'ProgressOverview'>['navigation'];

const RECENT_MILESTONES_LIMIT = 3;
// Stable, so the milestones aren't rebuilt on every render when a caller passes none.
const EMPTY_RECORDS: ExerciseRecordWithExercise[] = [];

interface Props {
  groups: ExerciseHistoryGroup[];
  lifetimeStats: LifetimeStats;
  totalCompletedSets: number;
  totalPRs: number;
  repPRs: RepPRWithExercise[];
  oneRepMaxes: OneRepMaxWithExercise[];
  /** A bodyweight or timed exercise's most reps / longest time. */
  exerciseRecords?: ExerciseRecordWithExercise[];
  weightUnit: 'kg' | 'lb';
  accentColor: string;
  navigation: Navigation;
  /** Switches Progress to All Time, where every record is -- "Recent Milestones" card's "View All" link. */
  onViewAllMilestones: () => void;
  /** Shown first, above everything else -- the Weekly Summary. */
  top?: ReactNode;
}

function OverviewStat({
  icon,
  value,
  label,
  accentColor,
  testID,
}: {
  icon: keyof typeof Feather.glyphMap;
  value: string;
  label: string;
  accentColor: string;
  testID: string;
}) {
  // Deliberately no card/background of its own -- these tiles sit directly
  // on the "Your Progress" card's own dark glass, never a bright card
  // nested inside another card (see progressStyles.ts's own note on this).
  return (
    <View testID={testID} style={styles.statTile}>
      <View>
        <Text style={styles.statTileValue}>{value}</Text>
        <Text style={styles.statTileLabel}>{label}</Text>
      </View>
    </View>
  );
}

// Overview: a quick, honest answer to "Am I getting better?" -- real
// lifetime counts (reusing computeLifetimeStats, the same derivation
// Dashboard/ProfileScreen already use) plus the most recent real PRs
// (mergeAndSortPRs, shared with the PRs tab). Every number here is real;
// nothing is a new formula or a fabricated example value.
export function OverviewSection({
  groups,
  lifetimeStats,
  totalCompletedSets,
  totalPRs,
  repPRs,
  oneRepMaxes,
  exerciseRecords = EMPTY_RECORDS,
  weightUnit,
  accentColor,
  navigation,
  onViewAllMilestones,
  top,
}: Props) {
  const recentMilestones = useMemo(
    () => mergeAndSortPRs(repPRs, oneRepMaxes, exerciseRecords).slice(0, RECENT_MILESTONES_LIMIT),
    [repPRs, oneRepMaxes, exerciseRecords],
  );

  if (groups.length === 0) {
    const empty = (
      <ProgressEmptyState
        testID="progress-overview-empty"
        title="Your progression starts here."
        icon="trending-up"
      />
    );
    // The week can have food logged, or bodyweight work, before any weighted lift.
    return top ? (
      <ScrollView
        testID="progress-overview-scroll"
        style={styles.sectionFill}
        contentContainerStyle={{ paddingBottom: 32 }}
        showsVerticalScrollIndicator={false}
      >
        {top}
        {empty}
      </ScrollView>
    ) : (
      <View style={styles.sectionFill}>{empty}</View>
    );
  }

  return (
    <ScrollView
      testID="progress-overview-scroll"
      style={styles.sectionFill}
      contentContainerStyle={{ paddingBottom: 32 }}
      showsVerticalScrollIndicator={false}
    >
      {top}
      <View style={styles.overviewCard}>
        <View style={styles.overviewCardHeader}>
          <View style={styles.overviewCardTitleColumn}>
            <Text style={styles.overviewCardTitle}>Your Progress</Text>
            <Text style={styles.overviewCardSubtitle}>
              A quick snapshot of your lifting journey.
            </Text>
          </View>
        </View>

        <View style={styles.statsRow}>
          <OverviewStat
            testID="progress-overview-stat-workouts"
            icon="calendar"
            value={String(lifetimeStats.totalWorkouts)}
            label="Workouts Completed"
            accentColor={accentColor}
          />
          <OverviewStat
            testID="progress-overview-stat-prs"
            icon="award"
            value={String(totalPRs)}
            label="Personal Records"
            accentColor={accentColor}
          />
          <OverviewStat
            testID="progress-overview-stat-exercises"
            icon="list"
            value={String(groups.length)}
            label="Exercises Tracked"
            accentColor={accentColor}
          />
          <OverviewStat
            testID="progress-overview-stat-sets"
            icon="check-circle"
            value={String(totalCompletedSets)}
            label="Sets Completed"
            accentColor={accentColor}
          />
        </View>
      </View>

      {recentMilestones.length > 0 ? (
        <View style={styles.overviewCard}>
          <View style={styles.overviewCardHeader}>
            <View style={styles.overviewCardTitleColumn}>
              <Text style={styles.overviewCardTitle}>Recent Milestones</Text>
              <Text style={styles.overviewCardSubtitle}>Your latest achievements.</Text>
            </View>
            <TouchableOpacity
              testID="progress-overview-view-all-milestones"
              onPress={onViewAllMilestones}
            >
              <Text style={[styles.viewAllText, { color: accentColor }]}>View All</Text>
            </TouchableOpacity>
          </View>
          {recentMilestones.map((item, index) => (
            <PRRow
              key={item.key}
              testID={`progress-overview-milestone-${item.key}`}
              exerciseName={item.exerciseName}
              weightDisplay={roundWeight(fromKg(item.weightKg ?? 0, weightUnit))}
              reps={item.reps}
              unit={weightUnit}
              value={recordValueText(item, weightUnit)}
              achievedAt={item.achievedAt}
              recordType={item.recordType}
              accentColor={accentColor}
              showDivider={index > 0}
              // Exercise progress charts weights; a most-reps / longest record has none to open.
              onPress={
                item.measurementType === 'weight_reps'
                  ? () =>
                      navigation.navigate('ProgressExerciseDetail', {
                        exerciseId: item.exerciseId,
                        exerciseName: item.exerciseName,
                      })
                  : undefined
              }
            />
          ))}
        </View>
      ) : null}
    </ScrollView>
  );
}
