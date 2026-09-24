import { useMemo } from 'react';
import { ScrollView, TouchableOpacity, View } from 'react-native';
import { Text } from '../design/Text';
import { Feather } from '@expo/vector-icons';
import { fromKg, roundWeight } from '../lib/units';
import type { RootStackScreenProps } from '../navigation/types';
import type { ExerciseHistoryGroup } from '../workouts/allExerciseHistoryQueries';
import type { OneRepMaxWithExercise, RepPRWithExercise } from '../workouts/prSummaryQueries';
import type { LifetimeStats } from './lifetimeStats';
import { mergeAndSortPRs } from './prFeed';
import { PRRow } from './PRRow';
import { ProgressEmptyState } from './ProgressEmptyState';
import { progressStyles as styles } from './progressStyles';

type Navigation = RootStackScreenProps<'ProgressOverview'>['navigation'];

const RECENT_MILESTONES_LIMIT = 3;

interface Props {
  groups: ExerciseHistoryGroup[];
  lifetimeStats: LifetimeStats;
  totalCompletedSets: number;
  totalPRs: number;
  repPRs: RepPRWithExercise[];
  oneRepMaxes: OneRepMaxWithExercise[];
  weightUnit: 'kg' | 'lb';
  accentColor: string;
  navigation: Navigation;
  /** Switches Progress to the Strength tab -- "Your Progress" card's "View Details" link. */
  onViewDetails: () => void;
  /** Switches Progress to the PRs tab -- "Recent Milestones" card's "View All" link. */
  onViewAllMilestones: () => void;
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
  weightUnit,
  accentColor,
  navigation,
  onViewDetails,
  onViewAllMilestones,
}: Props) {
  const recentMilestones = useMemo(
    () => mergeAndSortPRs(repPRs, oneRepMaxes).slice(0, RECENT_MILESTONES_LIMIT),
    [repPRs, oneRepMaxes],
  );

  if (groups.length === 0) {
    return (
      <View style={styles.sectionFill}>
        <ProgressEmptyState
          testID="progress-overview-empty"
          title="Your progression starts here."
          icon="trending-up"
        />
      </View>
    );
  }

  return (
    <ScrollView
      testID="progress-overview-scroll"
      style={styles.sectionFill}
      contentContainerStyle={{ paddingBottom: 32 }}
      showsVerticalScrollIndicator={false}
    >
      <View style={styles.overviewCard}>
        <View style={styles.overviewCardHeader}>
          <View style={styles.overviewCardTitleColumn}>
            <Text style={styles.overviewCardTitle}>Your Progress</Text>
            <Text style={styles.overviewCardSubtitle}>
              A quick snapshot of your lifting journey.
            </Text>
          </View>
          <TouchableOpacity testID="progress-overview-view-details" onPress={onViewDetails}>
            <Text style={[styles.viewAllText, { color: accentColor }]}>View Details</Text>
          </TouchableOpacity>
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
              weightDisplay={roundWeight(fromKg(item.weightKg, weightUnit))}
              reps={item.reps}
              unit={weightUnit}
              achievedAt={item.achievedAt}
              recordType={item.recordType}
              accentColor={accentColor}
              showDivider={index > 0}
              onPress={() =>
                navigation.navigate('ProgressExerciseDetail', {
                  exerciseId: item.exerciseId,
                  exerciseName: item.exerciseName,
                })
              }
            />
          ))}
        </View>
      ) : null}
    </ScrollView>
  );
}
