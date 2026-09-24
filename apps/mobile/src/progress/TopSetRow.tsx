import { TouchableOpacity, View } from 'react-native';
import { Text } from '../design/Text';
import { Feather } from '@expo/vector-icons';
import { colors } from '../design/theme';
import { progressStyles as styles } from './progressStyles';
import { formatWeight } from '../lib/units';

interface Props {
  exerciseName: string;
  muscleGroupLabel: string;
  weightDisplay: number;
  reps: number;
  unit: 'kg' | 'lb';
  accentColor: string;
  onPress?: () => void;
  testID?: string;
}

/**
 * One row on the Top Sets page: an exercise's single best qualifying set
 * (see topSets.ts) as a plain row -- left side identifies the
 * exercise (name + muscle group), right side is the number that matters
 * (weight x reps) plus the "Top Set" label and a chevron. Deliberately no
 * icon, date, badge, or streak -- clean and data-focused, per the page's
 * own design spec.
 */
export function TopSetRow({
  exerciseName,
  muscleGroupLabel,
  weightDisplay,
  reps,
  unit,
  accentColor,
  onPress,
  testID,
}: Props) {
  return (
    <TouchableOpacity
      testID={testID}
      style={styles.topSetCard}
      onPress={onPress}
      disabled={!onPress}
      activeOpacity={0.7}
      accessibilityRole={onPress ? 'button' : undefined}
      accessibilityLabel={`${exerciseName}, ${muscleGroupLabel}, top set ${formatWeight(weightDisplay)}${unit} times ${reps}`}
    >
      <View style={styles.topSetRowContent}>
        <View style={styles.topSetRowLeft}>
          <Text style={styles.topSetExerciseName} numberOfLines={1}>
            {exerciseName}
          </Text>
          <Text style={styles.topSetMuscleGroup}>{muscleGroupLabel}</Text>
        </View>
        <View style={styles.topSetRowRight}>
          <View style={styles.topSetValueColumn}>
            <Text style={[styles.topSetValue, { color: accentColor }]}>
              {formatWeight(weightDisplay)}
              {unit} × {reps}
            </Text>
            <Text style={styles.topSetCaption}>Top Set</Text>
          </View>
          <Feather name="chevron-right" size={20} color={colors.textMuted} />
        </View>
      </View>
    </TouchableOpacity>
  );
}
