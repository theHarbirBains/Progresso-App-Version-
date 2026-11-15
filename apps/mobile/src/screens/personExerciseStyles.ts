import { StyleSheet } from 'react-native';
import { colors, minTouchTarget, spacing, typeScale, widgetGap } from '../design/theme';

// PersonExerciseScreen. Token-only: a summary card, the records card and the top sets card,
// each a list of divided rows -- what it is on the left, its figure in the accent on the right.
export const personExerciseStyles = StyleSheet.create({
  content: {
    gap: widgetGap,
    paddingBottom: spacing.xxl,
  },
  summary: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.md,
  },
  summaryText: {
    flex: 1,
    gap: 2,
  },
  name: {
    ...typeScale.cardTitle,
    color: colors.textPrimary,
  },
  machine: {
    ...typeScale.caption,
    color: colors.textMuted,
  },
  count: {
    ...typeScale.secondary,
    color: colors.textSecondary,
  },
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.md,
    minHeight: minTouchTarget,
    paddingVertical: spacing.sm,
  },
  rowDivider: {
    borderTopWidth: 1,
    borderTopColor: colors.divider,
  },
  rowText: {
    flex: 1,
  },
  rowLabel: {
    ...typeScale.callout,
    color: colors.textPrimary,
    flex: 1,
  },
  rowDate: {
    ...typeScale.caption,
    color: colors.textMuted,
  },
  rowValue: {
    ...typeScale.statSmall,
  },
  empty: {
    ...typeScale.secondary,
    color: colors.textMuted,
  },
});
