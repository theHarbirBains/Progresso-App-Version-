import { View } from 'react-native';
import { Feather } from '@expo/vector-icons';
import { Avatar } from '../design/Avatar';
import { Card } from '../design/Card';
import { StatBlock } from '../design/StatBlock';
import { Text } from '../design/Text';
import { colors } from '../design/theme';
import type { EnrichedWorkoutSummary } from '../workouts/workoutHistoryEnrichment';
import { SPLIT_MUSCLE_GROUP_LABELS } from '../workouts/splitMuscleGroups';
import { formatCardDate, formatCardDuration } from '../workouts/workoutFormat';
import { feedStyles as styles } from '../screens/feedStyles';
import { RecentWorkoutTopSets } from './RecentWorkoutTopSets';

/** The fields a workout card shows; Feed and the trainer view both supply these. */
export type WorkoutCardData = Pick<
  EnrichedWorkoutSummary,
  | 'id'
  | 'name'
  | 'muscleGroups'
  | 'durationMinutes'
  | 'completedExerciseCount'
  | 'completedSetCount'
  | 'topSets'
>;

interface Props {
  /** Prefixes every test id, so each place the card shows keeps its own: e.g. "feed-item-workout". */
  idPrefix: string;
  workout: WorkoutCardData;
  authorName: string;
  avatarUrl?: string | null;
  /** The date shown in the byline. Feed shows the workout's own date. */
  timestamp: string;
  weightUnit: 'kg' | 'lb';
  onPress?: () => void;
}

/**
 * One finished workout as a Feed card: a byline (avatar, name, date), the workout's
 * name and muscles, a Duration / Exercises / Sets strip, and the swipeable Top Sets
 * carousel. The Feed and a trainer's view of a client both use this, so they match.
 */
export function WorkoutFeedCard({
  idPrefix,
  workout,
  authorName,
  avatarUrl,
  timestamp,
  weightUnit,
  onPress,
}: Props) {
  return (
    <Card testID={`${idPrefix}-${workout.id}`} onPress={onPress}>
      <View style={styles.metaRow}>
        <View style={styles.avatarWrap}>
          <Avatar
            uri={avatarUrl ?? null}
            initial={authorName.charAt(0).toUpperCase()}
            size={32}
            iconSize={16}
            iconColor={colors.textSecondary}
            initialStyle={styles.avatarInitial}
          />
        </View>
        <View style={styles.metaBody}>
          <Text style={styles.metaName} numberOfLines={1}>
            {authorName}
          </Text>
          <View style={styles.metaSubRow}>
            <Feather name="activity" size={11} color={colors.textMuted} />
            <Text style={styles.metaTimestamp}>{formatCardDate(timestamp)}</Text>
          </View>
        </View>
      </View>

      <Text style={styles.itemTitle} numberOfLines={1}>
        {workout.name}
      </Text>
      {workout.muscleGroups.length > 0 ? (
        <Text style={styles.itemSubtitle} numberOfLines={1}>
          {workout.muscleGroups.map((group) => SPLIT_MUSCLE_GROUP_LABELS[group]).join(' • ')}
        </Text>
      ) : null}

      <View style={styles.statRow}>
        <StatBlock
          testID={`${idPrefix}-${workout.id}-duration`}
          value={formatCardDuration(workout.durationMinutes)}
          label="Duration"
        />
        <StatBlock
          testID={`${idPrefix}-${workout.id}-exercises`}
          value={String(workout.completedExerciseCount)}
          label={workout.completedExerciseCount === 1 ? 'Exercise' : 'Exercises'}
        />
        <StatBlock
          testID={`${idPrefix}-${workout.id}-sets`}
          value={String(workout.completedSetCount)}
          label="Sets"
        />
      </View>
      <RecentWorkoutTopSets
        testID={`${idPrefix}-${workout.id}-top-sets`}
        topSets={workout.topSets}
        weightUnit={weightUnit}
      />
    </Card>
  );
}
