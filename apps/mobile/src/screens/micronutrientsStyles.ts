import { StyleSheet } from 'react-native';
import { colors, spacing, typeScale, widgetGap } from '../design/theme';

// MicronutrientsScreen and NutrientDetailScreen. Token-only; the frame is the shared `Screen`,
// the widgets `AppCard`s, the bars `AnimatedBar`. The Nutrition accent is passed in by the screen.
export const micronutrientsStyles = StyleSheet.create({
  // The widgets, `widgetGap` apart.
  content: {
    gap: widgetGap,
    paddingBottom: spacing.xxl,
  },

  // The day (or week) shown, with a step either way.
  dateRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: spacing.sm,
    marginTop: spacing.md,
  },
  dateText: {
    flex: 1,
    alignItems: 'center',
  },
  dateCaption: {
    ...typeScale.caption,
    color: colors.textMuted,
    textAlign: 'center',
  },
  dateTitle: {
    ...typeScale.cardTitle,
    color: colors.textPrimary,
    textAlign: 'center',
  },
  coverage: {
    ...typeScale.secondary,
    color: colors.textSecondary,
    textAlign: 'center',
  },

  // A nutrient's row: its name and figures, its bar, what the figure is of.
  row: {
    paddingVertical: spacing.md,
    gap: spacing.xs,
  },
  rowDivider: {
    borderTopWidth: StyleSheet.hairlineWidth,
    borderTopColor: colors.divider,
  },
  rowTop: {
    flexDirection: 'row',
    alignItems: 'baseline',
    justifyContent: 'space-between',
    gap: spacing.sm,
  },
  rowName: {
    ...typeScale.body,
    color: colors.textPrimary,
    flexShrink: 1,
  },
  rowRight: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.xs,
  },
  rowFigure: {
    ...typeScale.callout,
    fontFamily: typeScale.statSmall.fontFamily,
    color: colors.textPrimary,
  },
  rowCaption: {
    ...typeScale.secondary,
    color: colors.textSecondary,
  },
  rowQuiet: {
    ...typeScale.secondary,
    color: colors.textMuted,
  },

  errorText: {
    ...typeScale.callout,
    color: colors.textSecondary,
    marginTop: spacing.md,
  },

  // Notes and plain words.
  body: {
    ...typeScale.callout,
    color: colors.textSecondary,
  },
  quiet: {
    ...typeScale.secondary,
    color: colors.textMuted,
  },
  cardTitle: {
    ...typeScale.cardTitle,
    color: colors.textPrimary,
  },
  sectionGap: {
    gap: spacing.sm,
  },

  // The detail page's figure: the amount, large, and what it's of.
  figureRow: {
    flexDirection: 'row',
    alignItems: 'baseline',
    gap: spacing.sm,
  },
  figureValue: {
    ...typeScale.statLarge,
    color: colors.textPrimary,
  },
  figureOf: {
    ...typeScale.callout,
    color: colors.textSecondary,
  },
  limitValue: {
    ...typeScale.statMedium,
    color: colors.textPrimary,
  },

  // A food's part in the day's total.
  foodRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    gap: spacing.sm,
    paddingVertical: spacing.xs,
  },
  foodName: {
    ...typeScale.secondary,
    color: colors.textSecondary,
    flexShrink: 1,
  },
  foodAmount: {
    ...typeScale.secondary,
    fontFamily: typeScale.statSmall.fontFamily,
    color: colors.textPrimary,
  },

  spacedTop: {
    marginTop: spacing.sm,
  },

  // A source: its title as a link, and who published it.
  source: {
    paddingVertical: spacing.xs,
    gap: 2,
  },
  sourceTitle: {
    ...typeScale.callout,
    color: colors.textPrimary,
    textDecorationLine: 'underline',
  },
  sourceMeta: {
    ...typeScale.caption,
    color: colors.textMuted,
  },

  // The sheet that sets which reference values apply.
  sheetBody: {
    gap: spacing.md,
  },
});
