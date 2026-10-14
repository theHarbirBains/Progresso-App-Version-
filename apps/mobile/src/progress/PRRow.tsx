import { TouchableOpacity, View } from 'react-native';
import { Text } from '../design/Text';
import { Feather } from '@expo/vector-icons';
import { ExercisePhoto } from '../exercises/ExercisePhoto';
import { withAlpha } from '../theme/accentColor';
import { progressStyles as styles } from './progressStyles';
import { formatWeight } from '../lib/units';
import { formatMonthDay } from '../workouts/workoutFormat';

interface Props {
  exerciseName: string;
  /** The exercise's machine photo -- shown in place of the ribbon, and opens full-screen when tapped. */
  photoUrl?: string | null;
  weightDisplay: number;
  /** null for a true-1RM record (a 1RM isn't described by a rep count the way a rep-count PR is). */
  reps: number | null;
  unit: 'kg' | 'lb';
  achievedAt: string;
  /** "1RM" or "N-Rep PR" -- the record-type distinction the spec asks for, exactly as the data supports it. */
  recordType: string;
  accentColor: string;
  onPress?: () => void;
  showDivider?: boolean;
  testID?: string;
}

/** One row on the PRs page -- a rep-count PR or a true 1RM, both real database-maintained records. */
export function PRRow({
  exerciseName,
  photoUrl,
  weightDisplay,
  reps,
  unit,
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
        {formatWeight(weightDisplay)}
        {unit}
        {reps !== null ? ` × ${reps}` : ''}
      </Text>
    </TouchableOpacity>
  );
}
