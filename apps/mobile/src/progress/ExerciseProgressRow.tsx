import { Text, TouchableOpacity, View } from 'react-native';
import { Feather } from '@expo/vector-icons';
import { colors } from '../design/theme';
import { progressStyles as styles } from './progressStyles';

interface Props {
  exerciseName: string;
  currentWeightDisplay: number;
  unit: 'kg' | 'lb';
  /** null when there's only one data point -- nothing to compare yet. */
  deltaDisplay: number | null;
  percent: number | null;
  accentColor: string;
  onPress: () => void;
  showDivider?: boolean;
  testID?: string;
}

function formatWeight(value: number): string {
  return Number.isInteger(value) ? String(value) : value.toFixed(1);
}

/** One row on the Exercises page (and Overview's "Exercises Improving" section). */
export function ExerciseProgressRow({
  exerciseName,
  currentWeightDisplay,
  unit,
  deltaDisplay,
  percent,
  accentColor,
  onPress,
  showDivider,
  testID,
}: Props) {
  const improving = deltaDisplay !== null && deltaDisplay > 0;
  return (
    <TouchableOpacity
      testID={testID}
      style={[styles.exerciseRow, showDivider && styles.exerciseRowDivider]}
      onPress={onPress}
      accessibilityRole="button"
    >
      <View style={styles.exerciseRowBody}>
        <Text style={styles.exerciseRowName}>{exerciseName}</Text>
        {deltaDisplay !== null && percent !== null ? (
          <Text
            style={[
              styles.exerciseRowChange,
              { color: improving ? accentColor : colors.textMuted },
            ]}
          >
            {deltaDisplay >= 0 ? '+' : ''}
            {formatWeight(deltaDisplay)}
            {unit} · {improving ? '↑' : '↓'} {Math.abs(percent).toFixed(1)}%
          </Text>
        ) : (
          <Text style={styles.exerciseRowMeta}>Not enough data yet</Text>
        )}
      </View>
      <View style={styles.exerciseRowTrailing}>
        <Text style={styles.exerciseRowValue}>
          {formatWeight(currentWeightDisplay)}
          {unit}
        </Text>
      </View>
      <Feather name="chevron-right" size={20} color={colors.textMuted} />
    </TouchableOpacity>
  );
}
