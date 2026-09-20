import { StyleSheet } from 'react-native';
import { colors, spacing, typeScale } from '../design/theme';

// Shared by ExerciseProgressScreen and PRHistoryScreen -- the two
// single-exercise performance screens. Token-only. The frame is the shared
// `Screen`, sections are `Section`s and PR/best-performance lines are
// `ListRow`s, so this holds only what those don't cover.
export const exerciseProgressStyles = StyleSheet.create({
  // Vertical rhythm between the screen's sections.
  content: {
    gap: spacing.xxl,
  },
  errorText: {
    ...typeScale.callout,
    color: colors.destructive,
  },
  loading: {
    paddingVertical: spacing.xxl,
  },
  emptyText: {
    ...typeScale.secondary,
    color: colors.textMuted,
  },

  // Chart caption: the range of the plotted values, as a mono readout.
  chartCaption: {
    ...typeScale.statSmall,
    color: colors.textSecondary,
    marginTop: spacing.sm,
  },
  consistencyText: {
    ...typeScale.callout,
    color: colors.textSecondary,
  },

  // The true 1RM: the one number that matters most on PR History, so it is
  // the one large accent-coloured readout (colour supplied per render).
  oneRepMaxValue: {
    ...typeScale.statLarge,
  },
  oneRepMaxDate: {
    ...typeScale.secondary,
    color: colors.textMuted,
    marginTop: spacing.xs,
  },
});
