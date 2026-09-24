import { StyleSheet } from 'react-native';
import { colors, radii, spacing, typeScale } from '../design/theme';

// Local to WorkoutSplitPresetPicker only -- mirrors chooseWorkoutSplitStyles
// (same card/chip/button visual language) without touching workoutSplitStyles.ts,
// which WorkoutSplitsScreen/WorkoutSplitFormScreen also depend on.
export const workoutSplitPresetPickerStyles = StyleSheet.create({
  errorText: {
    ...typeScale.callout,
    color: colors.destructive,
    marginBottom: spacing.lg,
  },
  presetList: {
    marginBottom: spacing.lg,
  },
  presetCard: {
    marginBottom: spacing.lg,
  },
  cardTopRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.md,
    marginBottom: spacing.sm,
  },
  iconCircle: {
    width: 40,
    height: 40,
    borderRadius: radii.pill,
    backgroundColor: colors.surfaceRaised,
    borderWidth: 1,
    borderColor: colors.border,
    alignItems: 'center',
    justifyContent: 'center',
  },
  presetName: {
    ...typeScale.cardTitle,
    color: colors.textPrimary,
    flex: 1,
  },
  presetDescription: {
    ...typeScale.secondary,
    color: colors.textSecondary,
    marginBottom: spacing.md,
  },
  chipRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: spacing.sm,
  },
  createSplitButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: spacing.sm,
    borderRadius: radii.md,
    paddingVertical: spacing.md + 2,
    marginTop: spacing.sm,
  },
  createSplitButtonText: {
    ...typeScale.cardTitle,
    fontFamily: 'Manrope_700Bold',
  },
});
