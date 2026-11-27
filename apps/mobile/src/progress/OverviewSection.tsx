import { useMemo, type ReactNode } from 'react';
import { ScrollView, TouchableOpacity, View } from 'react-native';
import { Text } from '../design/Text';
import type { RootStackScreenProps } from '../navigation/types';
import type { ExerciseHistoryGroup } from '../workouts/allExerciseHistoryQueries';
import type {
  ExerciseRecordWithExercise,
  OneRepMaxWithExercise,
  RepPRWithExercise,
} from '../workouts/prSummaryQueries';
import { mergeAndSortPRs } from './prFeed';
import { PRFeedRecordRow } from './PRRow';
import { ProgressEmptyState } from './ProgressEmptyState';
import { progressStyles as styles } from './progressStyles';
import { ProgressCardHeader } from './ProgressCardHeader';

type Navigation = RootStackScreenProps<'ProgressOverview'>['navigation'];

const RECENT_MILESTONES_LIMIT = 3;
// Stable, so the milestones aren't rebuilt on every render when a caller passes none.
const EMPTY_RECORDS: ExerciseRecordWithExercise[] = [];

interface Props {
  groups: ExerciseHistoryGroup[];
  repPRs: RepPRWithExercise[];
  oneRepMaxes: OneRepMaxWithExercise[];
  /** A bodyweight or timed exercise's most reps / longest time. */
  exerciseRecords?: ExerciseRecordWithExercise[];
  weightUnit: 'kg' | 'lb';
  accentColor: string;
  navigation: Navigation;
  /** Shows All Time, where every record is -- "Recent Milestones" card's "View All" link. */
  onViewAllMilestones: () => void;
  /** Shown first, above everything else -- the Weekly Summary. */
  top?: ReactNode;
}

export function OverviewSection({
  groups,
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
        keyboardDismissMode="on-drag"
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
      keyboardDismissMode="on-drag"
      testID="progress-overview-scroll"
      style={styles.sectionFill}
      contentContainerStyle={{ paddingBottom: 32 }}
      showsVerticalScrollIndicator={false}
    >
      {top}
      {recentMilestones.length > 0 ? (
        <View style={styles.overviewCard}>
          <ProgressCardHeader
            title="Recent Milestones"
            action={
              <TouchableOpacity
                testID="progress-overview-view-all-milestones"
                onPress={onViewAllMilestones}
              >
                <Text style={[styles.viewAllText, { color: accentColor }]}>View All</Text>
              </TouchableOpacity>
            }
          />
          {recentMilestones.map((item, index) => (
            <PRFeedRecordRow
              key={item.key}
              testID={`progress-overview-milestone-${item.key}`}
              item={item}
              weightUnit={weightUnit}
              accentColor={accentColor}
              showDivider={index > 0}
              navigation={navigation}
            />
          ))}
        </View>
      ) : null}
    </ScrollView>
  );
}
