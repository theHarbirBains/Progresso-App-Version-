import { TouchableOpacity, View } from 'react-native';
import { Text } from '../design/Text';
import { Feather } from '@expo/vector-icons';
import { colors } from '../design/theme';
import { PROGRESS_LEVEL_LABELS, type ProgressLevel } from './strengthProgress';
import { progressStyles as styles } from './progressStyles';
import { formatWeight } from '../lib/units';

interface Props {
  testID?: string;
  exerciseName: string;
  muscleGroupLabel: string;
  deltaDisplay: number;
  unit: 'kg' | 'lb';
  level: Exclude<ProgressLevel, 'none'>;
  accentColor: string;
  onPress: () => void;
  showDivider?: boolean;
}

/** One row in the "other exercises" list below the featured Strength Progress card -- only ever a real, meaningful gain (never a zero/negative row, see strengthProgress.ts). */
export function StrengthProgressRow({
  testID,
  exerciseName,
  muscleGroupLabel,
  deltaDisplay,
  unit,
  level,
  accentColor,
  onPress,
  showDivider,
}: Props) {
  return (
    <TouchableOpacity
      testID={testID}
      style={[styles.strengthListRow, showDivider && styles.strengthListRowDivider]}
      onPress={onPress}
      accessibilityRole="button"
    >
      <View style={styles.strengthListRowBody}>
        <Text style={styles.strengthListRowName}>{exerciseName}</Text>
        <Text style={styles.strengthListRowMeta}>{muscleGroupLabel}</Text>
      </View>
      <View style={styles.strengthListRowTrailing}>
        <Text style={[styles.strengthListRowDelta, { color: accentColor }]}>
          +{formatWeight(deltaDisplay)}
          {unit}
        </Text>
        <Text style={styles.strengthListRowLevel}>{PROGRESS_LEVEL_LABELS[level]}</Text>
      </View>
      <Feather name="chevron-right" size={20} color={colors.textMuted} />
    </TouchableOpacity>
  );
}
