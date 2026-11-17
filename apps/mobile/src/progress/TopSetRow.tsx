import { TouchableOpacity, View } from 'react-native';
import { Text } from '../design/Text';
import { Feather } from '@expo/vector-icons';
import { colors, minTouchTarget } from '../design/theme';
import { ExercisePhoto } from '../exercises/ExercisePhoto';
import { machineLine, type MachineDetails } from '../exercises/machineDetails';
import { progressStyles as styles } from './progressStyles';
import { formatWeight } from '../lib/units';

interface Props extends MachineDetails {
  exerciseName: string;
  muscleGroupLabel: string;
  weightDisplay: number;
  reps: number;
  unit: 'kg' | 'lb';
  accentColor: string;
  onPress?: () => void;
  /** Opens the top set to fix it, when it was logged wrong: a pencil beside the figure. */
  onEdit?: () => void;
  testID?: string;
}

/**
 * One row on the Top Sets page: an exercise's single best qualifying set
 * (see topSets.ts) as a plain row -- left side identifies the exercise as
 * the Exercise Library does (its photo, which opens full size on a tap, or
 * its first letter; its name; "Muscle · Gym · Handle"), right side is the
 * number that matters (weight x reps) plus the "Top Set" label and a
 * chevron. Deliberately no date, badge, or streak -- clean and data-focused,
 * per the page's own design spec.
 */
export function TopSetRow({
  exerciseName,
  muscleGroupLabel,
  photoUrl,
  gym,
  grip,
  attachment,
  weightDisplay,
  reps,
  unit,
  accentColor,
  onPress,
  onEdit,
  testID,
}: Props) {
  const line = machineLine({ gym, grip, attachment }, muscleGroupLabel);
  return (
    <TouchableOpacity
      testID={testID}
      style={styles.topSetCard}
      onPress={onPress}
      disabled={!onPress}
      activeOpacity={0.7}
      accessibilityRole={onPress ? 'button' : undefined}
      accessibilityLabel={`${exerciseName}, ${line}, top set ${formatWeight(weightDisplay)}${unit} times ${reps}`}
    >
      <View style={styles.topSetRowContent}>
        <ExercisePhoto
          testID={testID ? `${testID}-photo` : undefined}
          uri={photoUrl}
          name={exerciseName}
          size={40}
        />
        <View style={styles.topSetRowLeft}>
          <Text style={styles.topSetExerciseName} numberOfLines={1}>
            {exerciseName}
          </Text>
          <Text testID={testID ? `${testID}-line` : undefined} style={styles.topSetMuscleGroup}>
            {line}
          </Text>
        </View>
        <View style={styles.topSetRowRight}>
          <View style={styles.topSetValueColumn}>
            <Text style={[styles.topSetValue, { color: accentColor }]}>
              {formatWeight(weightDisplay)}
              {unit} × {reps}
            </Text>
            <Text style={styles.topSetCaption}>Top Set</Text>
          </View>
          {onEdit ? (
            <TouchableOpacity
              testID={testID ? `${testID}-edit` : undefined}
              onPress={onEdit}
              style={{
                minWidth: minTouchTarget,
                minHeight: minTouchTarget,
                alignItems: 'center',
                justifyContent: 'center',
              }}
              accessibilityRole="button"
              accessibilityLabel={`Edit ${exerciseName}'s top set`}
            >
              <Feather name="edit-2" size={16} color={colors.textSecondary} />
            </TouchableOpacity>
          ) : null}
          {onPress ? <Feather name="chevron-right" size={20} color={colors.textMuted} /> : null}
        </View>
      </View>
    </TouchableOpacity>
  );
}
