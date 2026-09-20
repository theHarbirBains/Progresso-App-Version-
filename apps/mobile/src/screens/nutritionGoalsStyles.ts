import { StyleSheet } from 'react-native';
import { colors, fonts, radii, spacing, typeScale } from '../design/theme';

// NutritionGoalsScreen's own styles -- dark glass, Nutrition GREEN accent
// (always passed in as a prop, never hardcoded here), matching the approved
// calorie-target design reference. Independent of calorieEstimationStyles.ts
// (that screen's own purpose changed too, but its styles stay its own).
export const nutritionGoalsStyles = StyleSheet.create({
  screen: {
    flex: 1,
    // Transparent -- AppBackgroundLayer (mounted once behind the navigator)
    // paints the selected Nutrition background; this screen never hardcodes
    // its own.
    backgroundColor: 'transparent',
  },
  scrollContent: {
    paddingHorizontal: spacing.xxl,
    paddingBottom: spacing.xxxl,
  },
  subtitle: {
    ...typeScale.body,
    color: colors.textSecondary,
    marginBottom: spacing.xl,
  },

  // "Based on your information" hero card.
  infoCard: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: spacing.lg,
  },
  infoIconWrap: {
    width: 44,
    height: 44,
    borderRadius: radii.pill,
    backgroundColor: colors.surfaceRaised,
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: spacing.md,
  },
  infoBody: {
    flex: 1,
  },
  infoSummary: {
    ...typeScale.cardTitle,
    fontSize: 15,
    color: colors.textPrimary,
  },
  infoActivity: {
    ...typeScale.secondary,
    color: colors.textSecondary,
    marginTop: 2,
  },
  infoIncomplete: {
    ...typeScale.secondary,
    color: colors.textMuted,
  },
  editButton: {
    borderWidth: 1,
    borderRadius: radii.md,
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.xs,
  },
  editButtonText: {
    ...typeScale.secondary,
    fontWeight: '700',
  },

  // 2x2 calculated-options grid -- purely informational (no selection
  // state, no press handlers).
  optionsGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: spacing.md,
    marginBottom: spacing.lg,
  },
  optionCard: {
    flexBasis: '47%',
    flexGrow: 1,
  },
  optionIconWrap: {
    width: 40,
    height: 40,
    borderRadius: radii.pill,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: spacing.md,
  },
  optionTitle: {
    ...typeScale.cardTitle,
    fontSize: 15,
    color: colors.textPrimary,
  },
  optionSubtitle: {
    ...typeScale.caption,
    color: colors.textSecondary,
    marginTop: 1,
  },
  optionValue: {
    fontFamily: fonts.monoBold,
    fontSize: 26,
    color: colors.textPrimary,
    marginTop: spacing.md,
  },
  optionValueUnit: {
    ...typeScale.secondary,
    color: colors.textSecondary,
    marginBottom: spacing.sm,
  },
  optionDeltaRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.xs,
  },
  optionDeltaLabel: {
    ...typeScale.caption,
    color: colors.textMuted,
  },

  incompleteProfileCard: {
    marginBottom: spacing.lg,
    alignItems: 'flex-start',
  },
  incompleteProfileTitle: {
    ...typeScale.cardTitle,
    color: colors.textPrimary,
    marginBottom: spacing.xs,
  },
  incompleteProfileBody: {
    ...typeScale.secondary,
    color: colors.textSecondary,
    marginBottom: spacing.md,
  },

  // Custom Calorie Target.
  customCard: {
    marginBottom: spacing.lg,
  },
  customTitle: {
    ...typeScale.cardTitle,
    color: colors.textPrimary,
    marginBottom: spacing.xs,
  },
  customSubtitle: {
    ...typeScale.secondary,
    color: colors.textSecondary,
    marginBottom: spacing.md,
  },
  customInputRow: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: colors.surface,
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: radii.md,
    paddingHorizontal: spacing.md,
  },
  customInput: {
    flex: 1,
    paddingVertical: spacing.md,
    color: colors.textPrimary,
    fontFamily: fonts.monoBold,
    fontSize: 18,
  },
  customInputUnit: {
    ...typeScale.body,
    color: colors.textMuted,
  },

  errorText: {
    ...typeScale.caption,
    color: colors.destructive,
    marginBottom: spacing.md,
  },

  // Primary save action -- a two-line button (bold "Save N Calories" +
  // muted "Set as my daily target"), which PrimaryButton's single-label API
  // doesn't support, so this is its own small pressable rather than forcing
  // that shared component to grow a second variant for one screen.
  saveButton: {
    borderRadius: radii.lg,
    paddingVertical: spacing.md,
    alignItems: 'center',
    marginBottom: spacing.lg,
  },
  saveButtonDisabled: {
    opacity: 0.5,
  },
  saveButtonTitle: {
    ...typeScale.cardTitle,
    fontSize: 16,
  },
  saveButtonSubtitle: {
    ...typeScale.caption,
    marginTop: 2,
  },

  // Important Notes.
  notesCard: {
    marginBottom: spacing.lg,
  },
  notesHeaderRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
    marginBottom: spacing.sm,
  },
  notesTitle: {
    ...typeScale.cardTitle,
    fontSize: 15,
    color: colors.textPrimary,
  },
  notesBullet: {
    ...typeScale.secondary,
    color: colors.textSecondary,
    marginTop: spacing.xs,
    lineHeight: 18,
  },
});
