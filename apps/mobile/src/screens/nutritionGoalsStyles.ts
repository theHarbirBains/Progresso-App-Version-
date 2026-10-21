import { StyleSheet } from 'react-native';
import { colors, radii, spacing, typeScale, widgetGap } from '../design/theme';

// NutritionGoalsScreen. Token-only; the frame is the shared `Screen`, the estimates are
// `ChoiceTile`s and the macros are TargetsEditor's `MacroTargets`. The Nutrition accent is only
// ever passed in by the screen.
export const nutritionGoalsStyles = StyleSheet.create({
  // The widgets, `widgetGap` apart.
  content: {
    gap: widgetGap,
    paddingBottom: spacing.xxl,
  },

  // Your Details: a title with Edit, then four tiles and the activity level.
  infoHead: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  infoTitle: {
    ...typeScale.cardTitle,
    color: colors.textPrimary,
  },
  detailGrid: {
    flexDirection: 'row',
    gap: widgetGap,
  },
  detailTile: {
    flex: 1,
    paddingVertical: spacing.sm,
    paddingHorizontal: spacing.sm,
    backgroundColor: colors.surfaceLift,
    borderRadius: radii.md,
  },
  detailValue: {
    ...typeScale.callout,
    fontFamily: typeScale.cardTitle.fontFamily,
    color: colors.textPrimary,
  },
  detailLabel: {
    ...typeScale.caption,
    color: colors.textSecondary,
    marginTop: 2,
  },
  activityRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.xs,
    marginTop: spacing.md,
  },
  activityText: {
    ...typeScale.secondary,
    color: colors.textSecondary,
  },
  infoIncomplete: {
    ...typeScale.secondary,
    color: colors.textMuted,
  },

  // A numbered step's heading.
  stepHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.md,
    marginBottom: spacing.md,
  },
  stepBadge: {
    width: 28,
    height: 28,
    borderRadius: radii.pill,
    alignItems: 'center',
    justifyContent: 'center',
  },
  stepNumber: {
    ...typeScale.statSmall,
  },
  stepBody: {
    flex: 1,
  },
  stepTitle: {
    ...typeScale.cardTitle,
    color: colors.textPrimary,
  },
  stepDetail: {
    ...typeScale.secondary,
    color: colors.textSecondary,
    marginTop: 2,
  },

  // The four estimates, two by two.
  grid: {
    gap: widgetGap,
  },
  gridRow: {
    flexDirection: 'row',
    gap: widgetGap,
  },
  gridCell: {
    flex: 1,
  },
  optionTitle: {
    ...typeScale.callout,
    fontFamily: typeScale.cardTitle.fontFamily,
    color: colors.textPrimary,
    marginTop: spacing.sm,
  },
  optionValue: {
    ...typeScale.statMedium,
    color: colors.textPrimary,
    marginTop: spacing.xs,
  },
  optionMeta: {
    ...typeScale.caption,
    color: colors.textSecondary,
    marginTop: 2,
  },
  customField: {
    marginTop: spacing.lg,
  },

  incomplete: {
    alignItems: 'stretch',
    gap: spacing.md,
  },

  // Step 3.
  summary: {
    gap: widgetGap,
  },
  summaryRow: {
    flexDirection: 'row',
    gap: widgetGap,
  },
  actions: {
    gap: spacing.sm,
    marginTop: spacing.lg,
  },
  errorText: {
    ...typeScale.callout,
    color: colors.destructive,
  },
  savedRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: spacing.xs,
  },
  savedText: {
    ...typeScale.callout,
    color: colors.textSecondary,
  },
  phaseNote: {
    marginTop: spacing.sm,
  },
  note: {
    ...typeScale.secondary,
    color: colors.textSecondary,
    marginTop: spacing.sm,
    lineHeight: 18,
  },
});
