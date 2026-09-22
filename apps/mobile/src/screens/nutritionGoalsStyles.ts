import { StyleSheet } from 'react-native';
import { colors, spacing, typeScale, widgetGap } from '../design/theme';

// NutritionGoalsScreen. Token-only; the frame is the shared `Screen`, groups
// are `Section`s and the custom target is the shared `TextInput`. The Nutrition
// accent is only ever passed in by the screen (on the Save button).
export const nutritionGoalsStyles = StyleSheet.create({
  // The widgets, `widgetGap` apart.
  content: {
    gap: widgetGap,
    paddingBottom: spacing.xxl,
  },

  // "Based on your information": a plain line with Edit on its right.
  infoRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: spacing.md,
  },
  infoBody: {
    flex: 1,
  },
  infoSummary: {
    ...typeScale.callout,
    fontFamily: typeScale.cardTitle.fontFamily,
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

  // The four estimates.
  optionRow: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: spacing.md,
  },
  optionDivider: {
    borderTopWidth: StyleSheet.hairlineWidth,
    borderTopColor: colors.divider,
  },
  optionBody: {
    flex: 1,
  },
  optionTitle: {
    ...typeScale.cardTitle,
    color: colors.textPrimary,
  },
  optionMeta: {
    ...typeScale.secondary,
    color: colors.textSecondary,
    marginTop: 2,
  },
  optionValueBlock: {
    alignItems: 'flex-end',
  },
  optionValue: {
    ...typeScale.statMedium,
    color: colors.textPrimary,
  },
  optionUnit: {
    ...typeScale.caption,
    color: colors.textMuted,
    marginTop: 2,
  },

  incomplete: {
    gap: spacing.sm,
  },
  incompleteTitle: {
    ...typeScale.cardTitle,
    color: colors.textPrimary,
  },
  incompleteBody: {
    ...typeScale.secondary,
    color: colors.textSecondary,
    marginBottom: spacing.sm,
  },

  inputUnit: {
    ...typeScale.secondary,
    color: colors.textMuted,
  },
  actions: {
    gap: spacing.sm,
    marginTop: spacing.lg,
  },
  errorText: {
    ...typeScale.callout,
    color: colors.destructive,
  },
  savedText: {
    ...typeScale.callout,
    color: colors.textSecondary,
  },
  note: {
    ...typeScale.secondary,
    color: colors.textSecondary,
    marginTop: spacing.xs,
    lineHeight: 18,
  },
});
