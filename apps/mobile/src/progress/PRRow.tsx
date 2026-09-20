import { TouchableOpacity, View } from 'react-native';
import { Text } from '../design/Text';
import { Feather } from '@expo/vector-icons';
import { withAlpha } from '../theme/accentColor';
import { progressStyles as styles } from './progressStyles';

interface Props {
  exerciseName: string;
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

function formatWeight(value: number): string {
  return Number.isInteger(value) ? String(value) : value.toFixed(1);
}

function formatDate(iso: string): string {
  return new Date(iso).toLocaleDateString(undefined, { month: 'short', day: 'numeric' });
}

/** One row on the PRs page -- a rep-count PR or a true 1RM, both real database-maintained records. */
export function PRRow({
  exerciseName,
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
      <View style={[styles.recordRowIcon, { backgroundColor: withAlpha(accentColor, 0.14) }]}>
        <Feather name="award" size={18} color={accentColor} />
      </View>
      <View style={styles.recordRowBody}>
        <Text style={styles.recordRowTitle}>{exerciseName}</Text>
        <Text style={styles.recordRowMeta}>
          {recordType} · {formatDate(achievedAt)}
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
