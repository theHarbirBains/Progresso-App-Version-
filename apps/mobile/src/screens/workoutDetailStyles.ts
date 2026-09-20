import { StyleSheet } from 'react-native';
import { colors, spacing, typeScale } from '../design/theme';

// WorkoutDetailScreen -- a completed workout's exercises and sets. Token-only.
// The frame is the shared `Screen`; each exercise is a plain block separated
// from the next by a hairline, with its sets as compact rows.
export const workoutDetailStyles = StyleSheet.create({
  content: {
    paddingBottom: spacing.xxl,
  },
  errorText: {
    ...typeScale.callout,
    color: colors.destructive,
  },
  loading: {
    paddingVertical: spacing.xxl,
  },

  exerciseBlock: {
    paddingVertical: spacing.xl,
  },
  exerciseDivider: {
    borderTopWidth: StyleSheet.hairlineWidth,
    borderTopColor: colors.divider,
  },
  // Exercise name (opens its PR history) + chevron.
  exerciseTitleRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    minHeight: 44,
  },
  exerciseTitle: {
    ...typeScale.cardTitle,
    color: colors.textPrimary,
    flex: 1,
  },
  topSet: {
    ...typeScale.callout,
    color: colors.textSecondary,
  },

  setRow: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: spacing.sm,
  },
  setLabel: {
    ...typeScale.caption,
    color: colors.textMuted,
    width: 44,
  },
  setValue: {
    ...typeScale.statSmall,
    color: colors.textPrimary,
    flex: 1,
  },
  // "PR" / "1RM": only while the set is still the live record. A quiet
  // uppercase word in the mode accent (colour supplied per render), not a badge.
  prTag: {
    ...typeScale.caption,
    letterSpacing: 1,
  },
});
