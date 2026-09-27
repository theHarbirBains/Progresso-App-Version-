import { StyleSheet } from 'react-native';
import { colors, spacing, typeScale, widgetGap } from '../design/theme';

// NutritionHistoryScreen. Token-only. The frame (safe area, fixed header,
// scrolling body) is the shared Screen; the page is a stack of widgets --
// the calendar with its month summary, then the selected day -- widgetGap
// apart, the same rhythm as Workout History's own calendar screen.
export const nutritionHistoryStyles = StyleSheet.create({
  content: {
    gap: widgetGap,
  },
  legendRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: spacing.lg,
    marginVertical: spacing.md,
  },
  legendItem: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.xs,
  },
  legendDot: {
    width: 8,
    height: 8,
    borderRadius: 4,
  },
  legendLabel: {
    ...typeScale.secondary,
    color: colors.textMuted,
  },
  summaryRow: {
    flexDirection: 'row',
    gap: widgetGap,
  },
  errorText: {
    ...typeScale.callout,
    color: colors.destructive,
  },
  loading: {
    paddingVertical: spacing.xl,
    alignItems: 'center',
  },
  logRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
    paddingVertical: spacing.md,
  },
  logRowDivider: {
    borderTopWidth: StyleSheet.hairlineWidth,
    borderTopColor: colors.divider,
  },
  logInfo: {
    flex: 1,
  },
  logName: {
    ...typeScale.cardTitle,
    color: colors.textPrimary,
  },
  logMeta: {
    ...typeScale.secondary,
    color: colors.textSecondary,
    marginTop: 2,
  },
});
