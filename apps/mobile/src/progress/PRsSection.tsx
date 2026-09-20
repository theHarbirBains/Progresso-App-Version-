import { useMemo, useState } from 'react';
import { FlatList, TouchableOpacity, View } from 'react-native';
import { Text } from '../design/Text';
import { Feather } from '@expo/vector-icons';
import { colors, typeScale } from '../design/theme';
import { fromKg, roundWeight } from '../lib/units';
import type { RootStackParamList } from '../navigation/types';
import type { OneRepMaxWithExercise, RepPRWithExercise } from '../workouts/prSummaryQueries';
import { mergeAndSortPRs, type PRFeedRow } from './prFeed';
import { PRRow } from './PRRow';
import { ProgressEmptyState } from './ProgressEmptyState';
import { fetchWorkoutIdForSet } from './progressStatsQueries';
import { progressStyles as styles } from './progressStyles';

// A structural subset of the real navigation prop -- only the two routes
// this component actually navigates to. Any screen's real navigation
// object (ProgressOverviewScreen, ProfileScreen, ...) satisfies this
// regardless of its own route name, without the generic-variance issues
// NativeStackNavigationProp<RootStackParamList> (no pinned route) runs
// into for methods like setParams that this component never calls.
type Navigation = {
  navigate<RouteName extends 'ShareWorkout' | 'ProgressExerciseDetail'>(
    screen: RouteName,
    params: RootStackParamList[RouteName],
  ): void;
};

interface Props {
  repPRs: RepPRWithExercise[];
  oneRepMaxes: OneRepMaxWithExercise[];
  weightUnit: 'kg' | 'lb';
  accentColor: string;
  navigation: Navigation;
  /** Defaults to true (ProgressOverviewScreen's own usage, where this
   * section is the screen's only scrollable content). Pass false when
   * this is already nested inside another vertical ScrollView (e.g.
   * ProfileScreen) -- a FlatList nested inside a same-orientation
   * ScrollView breaks windowing (RN's own documented warning), so this
   * renders the identical rows as a plain, non-virtualized list instead.
   * Nothing about the data/PR logic differs between the two modes. */
  scrollable?: boolean;
}

// Every personal record Progresso currently tracks: rep-count PRs and true
// 1RMs (both database-maintained, see prSummaryQueries.ts), merged into one
// feed sorted by when they were achieved (mergeAndSortPRs, shared with
// OverviewSection's "Recent Milestones"). The record-type distinction shown
// per row is exactly what the data supports -- nothing invented. Section 12
// (Shareable Progress) lives here, next to the most recent record, reusing
// the existing ShareWorkout flow by resolving a PR's source set back to the
// workout it was achieved in.
export function PRsSection({
  repPRs,
  oneRepMaxes,
  weightUnit,
  accentColor,
  navigation,
  scrollable = true,
}: Props) {
  const [shareError, setShareError] = useState<string | null>(null);
  const [sharing, setSharing] = useState(false);

  const rows = useMemo<PRFeedRow[]>(
    () => mergeAndSortPRs(repPRs, oneRepMaxes),
    [repPRs, oneRepMaxes],
  );

  const mostRecent = rows[0] ?? null;

  async function handleShareMostRecent() {
    if (!mostRecent || sharing) return;
    setSharing(true);
    setShareError(null);
    try {
      const workoutId = await fetchWorkoutIdForSet(mostRecent.sourceSetId);
      if (!workoutId) {
        setShareError('That workout is no longer available to share.');
        return;
      }
      navigation.navigate('ShareWorkout', { workoutId });
    } catch (err) {
      setShareError(err instanceof Error ? err.message : 'Failed to open share');
    } finally {
      setSharing(false);
    }
  }

  function renderRow(item: PRFeedRow, index: number) {
    return (
      <PRRow
        key={item.key}
        testID={`progress-pr-row-${item.key}`}
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
    );
  }

  if (rows.length === 0) {
    return (
      <View style={styles.sectionFill}>
        <ProgressEmptyState
          testID="progress-prs-empty"
          title="Your personal records will appear here as you progress."
          icon="award"
        />
      </View>
    );
  }

  return (
    <View style={styles.sectionFill}>
      <Text
        testID="progress-prs-count"
        style={[typeScale.cardTitle, { color: colors.textPrimary, marginBottom: 8 }]}
      >
        {rows.length} {rows.length === 1 ? 'PR' : 'PRs'}
      </Text>
      {shareError ? (
        <Text testID="progress-share-error" style={styles.errorText}>
          {shareError}
        </Text>
      ) : null}
      <TouchableOpacity
        testID="progress-share-recent-pr"
        style={[styles.shareButton, { borderColor: accentColor, marginBottom: 16 }]}
        onPress={handleShareMostRecent}
        disabled={sharing}
        accessibilityRole="button"
      >
        <Feather name="share-2" size={14} color={accentColor} />
        <Text style={[styles.shareButtonText, { color: accentColor }]}>Share Progress</Text>
      </TouchableOpacity>
      {scrollable ? (
        <FlatList
          testID="progress-prs-list"
          style={styles.sectionFill}
          data={rows}
          keyExtractor={(item) => item.key}
          renderItem={({ item, index }) => renderRow(item, index)}
        />
      ) : (
        <View testID="progress-prs-list">{rows.map((item, index) => renderRow(item, index))}</View>
      )}
    </View>
  );
}
