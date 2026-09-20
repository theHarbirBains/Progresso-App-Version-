import { StyleSheet, TouchableOpacity, View } from 'react-native';
import { Text } from '../design/Text';
import { Feather } from '@expo/vector-icons';
import { colors, fonts, radii, spacing } from '../design/theme';

interface Props {
  testID: string;
  label: string;
  description?: string;
  selected: boolean;
  onPress: () => void;
  /** Defaults to colors.accent -- pass a contextual Workout/Nutrition accent where relevant (same override pattern as SegmentedControl/PrimaryButton). */
  accentColor?: string;
}

/** A single selectable card used for every "pick one" question (onboarding's gender/fitness goal/experience/frequency/training style, and Calorie Estimation's activity level). */
export function OnboardingOptionCard({
  testID,
  label,
  description,
  selected,
  onPress,
  accentColor = colors.accent,
}: Props) {
  return (
    <TouchableOpacity
      testID={testID}
      style={[styles.card, selected && { borderColor: accentColor }]}
      onPress={onPress}
      activeOpacity={0.85}
      accessibilityRole="button"
      accessibilityState={{ selected }}
    >
      <View style={styles.body}>
        <Text style={[styles.label, selected && { color: accentColor }]}>{label}</Text>
        {description ? <Text style={styles.description}>{description}</Text> : null}
      </View>
      {selected ? <Feather name="check-circle" size={20} color={accentColor} /> : null}
    </TouchableOpacity>
  );
}

const styles = StyleSheet.create({
  card: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    backgroundColor: colors.surface,
    borderRadius: radii.md,
    borderWidth: 1,
    borderColor: colors.border,
    padding: spacing.lg,
    marginBottom: spacing.md,
  },
  body: {
    flex: 1,
    marginRight: spacing.md,
  },
  label: {
    color: colors.textPrimary,
    fontFamily: fonts.display,
    fontSize: 15,
  },
  description: {
    color: colors.textSecondary,
    fontSize: 13,
    marginTop: spacing.xs,
  },
});
