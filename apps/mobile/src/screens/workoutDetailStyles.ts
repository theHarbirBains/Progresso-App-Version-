import { StyleSheet } from 'react-native';
import { colors, fonts, minTouchTarget, radii, spacing, typeScale, widgetGap } from '../design/theme';

// WorkoutDetailScreen -- a completed workout as a stack of widgets: one summary
// card, then one card per exercise. Token-only. Widgets are separated by exactly
// `widgetGap` (6px), the same rhythm as the Dashboard.
export const workoutDetailStyles = StyleSheet.create({
  content: {
    gap: widgetGap,
    paddingBottom: spacing.xxl,
  },
  errorText: {
    ...typeScale.callout,
    color: colors.destructive,
  },

  // ---- Summary widget -------------------------------------------------------
  eyebrow: {
    ...typeScale.sectionHeading,
    color: colors.textSecondary,
    marginBottom: spacing.md,
  },
  statGrid: {
    gap: widgetGap,
  },
  statRow: {
    flexDirection: 'row',
    gap: widgetGap,
  },

  // ---- Exercise widget ------------------------------------------------------
  exerciseTitleRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: spacing.md,
    minHeight: minTouchTarget,
  },
  exerciseTitleBody: {
    flex: 1,
  },
  exerciseTitle: {
    ...typeScale.cardTitle,
    color: colors.textPrimary,
  },
  exerciseMuscle: {
    ...typeScale.caption,
    color: colors.textSecondary,
    marginTop: 2,
  },
  // The heaviest logged set, called out on its own raised block above the list.
  topSetBlock: {
    marginTop: spacing.sm,
    paddingVertical: spacing.sm,
    paddingHorizontal: spacing.md,
    backgroundColor: colors.surfaceLift,
    borderRadius: radii.md,
  },
  topSet: {
    ...typeScale.statSmall,
  },

  sets: {
    marginTop: spacing.sm,
  },
  setRow: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: spacing.sm,
    borderTopWidth: StyleSheet.hairlineWidth,
    borderTopColor: colors.divider,
  },
  // A warm-up: shown, a little quieter, never counted.
  warmupRow: {
    opacity: 0.6,
  },
  // A drop set: tucked in under the set it drops from, with no line between them.
  dropRow: {
    paddingLeft: spacing.md,
    paddingTop: 0,
    borderTopWidth: 0,
  },
  setLabel: {
    ...typeScale.caption,
    color: colors.textMuted,
    width: 48,
  },
  setValue: {
    ...typeScale.statSmall,
    color: colors.textPrimary,
    flex: 1,
  },
  // Where it was done, at the foot of the summary: a pin in the accent, the gym, its address --
  // a 44pt tap opening the gym picker. Your own workouts only.
  gymLine: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.xs,
    minHeight: 44,
    marginTop: spacing.sm,
    paddingTop: spacing.sm,
    borderTopWidth: StyleSheet.hairlineWidth,
    borderTopColor: colors.divider,
  },
  gymName: {
    ...typeScale.callout,
    fontFamily: fonts.semibold,
    color: colors.textPrimary,
    flexShrink: 1,
  },
  gymAddress: {
    ...typeScale.secondary,
    color: colors.textSecondary,
    flex: 1,
  },
});
