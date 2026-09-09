import { StyleSheet, Text, TouchableOpacity, View } from 'react-native';
import { Feather } from '@expo/vector-icons';
import { colors, fonts, radii, spacing } from '../design/theme';

interface Props {
  testID: string;
  label: string;
  description?: string;
  selected: boolean;
  onPress: () => void;
}

/** A single selectable card used for every "pick one" onboarding question (gender, fitness goal, experience, frequency, training style). */
export function OnboardingOptionCard({ testID, label, description, selected, onPress }: Props) {
  return (
    <TouchableOpacity
      testID={testID}
      style={[styles.card, selected && styles.cardSelected]}
      onPress={onPress}
      activeOpacity={0.85}
      accessibilityRole="button"
      accessibilityState={{ selected }}
    >
      <View style={styles.body}>
        <Text style={[styles.label, selected && styles.labelSelected]}>{label}</Text>
        {description ? <Text style={styles.description}>{description}</Text> : null}
      </View>
      {selected ? <Feather name="check-circle" size={20} color={colors.accent} /> : null}
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
  cardSelected: {
    borderColor: colors.accent,
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
  labelSelected: {
    color: colors.accent,
  },
  description: {
    color: colors.textSecondary,
    fontSize: 13,
    marginTop: spacing.xs,
  },
});
