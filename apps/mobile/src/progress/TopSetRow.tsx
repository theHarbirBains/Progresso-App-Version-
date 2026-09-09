import { Text, TouchableOpacity, View } from 'react-native';
import { Feather } from '@expo/vector-icons';
import { withAlpha } from '../theme/accentColor';
import { progressStyles as styles } from './progressStyles';

interface Props {
  exerciseName: string;
  weightDisplay: number;
  reps: number;
  unit: 'kg' | 'lb';
  performedAt: string;
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

/** One row on the Top Sets page: the heaviest weight completed for one exercise within one workout. */
export function TopSetRow({
  exerciseName,
  weightDisplay,
  reps,
  unit,
  performedAt,
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
        <Feather name="trending-up" size={18} color={accentColor} />
      </View>
      <View style={styles.recordRowBody}>
        <Text style={styles.recordRowTitle}>{exerciseName}</Text>
        <Text style={styles.recordRowMeta}>{formatDate(performedAt)}</Text>
      </View>
      <Text style={[styles.recordRowValue, { color: accentColor }]}>
        {formatWeight(weightDisplay)}
        {unit} × {reps}
      </Text>
    </TouchableOpacity>
  );
}
