import { TouchableOpacity, View } from 'react-native';
import { Text } from '../design/Text';
import { Feather } from '@expo/vector-icons';
import { ExercisePhoto } from '../exercises/ExercisePhoto';
import { withAlpha } from '../theme/accentColor';
import { recordValueText, type PRFeedRow } from './prFeed';
import { progressStyles as styles } from './progressStyles';
import { formatWeight, fromKg, roundWeight } from '../lib/units';
import type { RootStackParamList } from '../navigation/types';
import { formatMonthDay } from '../workouts/workoutFormat';

interface Props {
  exerciseName: string;
  /** The exercise's machine photo -- shown in place of the ribbon, and opens full-screen when tapped. */
  photoUrl?: string | null;
  weightDisplay: number;
  /** null for a true-1RM record (a 1RM isn't described by a rep count the way a rep-count PR is). */
  reps: number | null;
  unit: 'kg' | 'lb';
  /** A bodyweight or timed record's value ("25 reps", "1:30"), shown in place of the weight. */
  value?: string;
  achievedAt: string;
  /** "1RM", "N-Rep PR", "Most Reps" or "Longest" -- the record-type distinction the spec asks for, exactly as the data supports it. */
  recordType: string;
  accentColor: string;
  onPress?: () => void;
  showDivider?: boolean;
  testID?: string;
}

/** One row on the PRs page -- a rep-count PR, a true 1RM, or a most-reps / longest record, all real database-maintained records. */
export function PRRow({
  exerciseName,
  photoUrl,
  weightDisplay,
  reps,
  unit,
  value,
  achievedAt,
  recordType,
  accentColor,
  onPress,
  showDivider,
  testID,
}: Props) {
  return (
    <TouchableOpacity
      testID={testID}
      style={[styles.recordRow, showDivider && styles.recordRowDivider]}
      onPress={onPress}
      disabled={!onPress}
      accessibilityRole="button"
    >
      {/* The exercise's own photo when it has one, so it's clear which
          exercise or machine the record is on -- tapping it opens it
          full-screen (the rest of the row still opens the exercise).
          Otherwise the ribbon. */}
      {photoUrl ? (
        <ExercisePhoto
          uri={photoUrl}
          name={exerciseName}
          size={40}
          testID={testID ? `${testID}-photo` : undefined}
        />
      ) : (
        <View
          testID={testID ? `${testID}-ribbon` : undefined}
          style={[styles.recordRowIcon, { backgroundColor: withAlpha(accentColor, 0.14) }]}
        >
          <Feather name="award" size={18} color={accentColor} />
        </View>
      )}
      <View style={styles.recordRowBody}>
        <Text style={styles.recordRowTitle}>{exerciseName}</Text>
        <Text style={styles.recordRowMeta}>
          {recordType} · {formatMonthDay(achievedAt)}
        </Text>
      </View>
      <Text style={[styles.recordRowValue, { color: accentColor }]}>
        {value ?? (
          <>
            {formatWeight(weightDisplay)}
            {unit}
            {reps !== null ? ` × ${reps}` : ''}
          </>
        )}
      </Text>
    </TouchableOpacity>
  );
}

// Only the route a record opens -- any screen's navigation satisfies it (see PRsSection's own).
type RecordNavigation = {
  navigate<RouteName extends 'ProgressExerciseDetail'>(
    screen: RouteName,
    params: RootStackParamList[RouteName],
  ): void;
};

interface FeedRowProps {
  item: PRFeedRow;
  weightUnit: 'kg' | 'lb';
  accentColor: string;
  showDivider: boolean;
  /** The exercise's photo in place of the ribbon (the PRs page). */
  showPhoto?: boolean;
  navigation: RecordNavigation;
  testID: string;
}

/**
 * A record from the PR feed (prFeed's mergeAndSortPRs) as a row -- the PRs page's and Overview's
 * Recent Milestones -- opening its exercise's progress. Exercise progress charts weights, so a
 * most-reps or longest record has none to open.
 */
export function PRFeedRecordRow({
  item,
  weightUnit,
  accentColor,
  showDivider,
  showPhoto = false,
  navigation,
  testID,
}: FeedRowProps) {
  return (
    <PRRow
      testID={testID}
      exerciseName={item.exerciseName}
      photoUrl={showPhoto ? item.photoUrl : undefined}
      weightDisplay={roundWeight(fromKg(item.weightKg ?? 0, weightUnit))}
      reps={item.reps}
      unit={weightUnit}
      value={recordValueText(item, weightUnit)}
      achievedAt={item.achievedAt}
      recordType={item.recordType}
      accentColor={accentColor}
      showDivider={showDivider}
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
  );
}
