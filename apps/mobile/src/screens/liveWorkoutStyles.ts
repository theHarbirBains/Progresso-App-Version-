import { StyleSheet } from 'react-native';
import { colors, minTouchTarget, radii, spacing, typeScale } from '../design/theme';

// Shared styles for the Live Workout experience: ActiveWorkoutScreen, its
// stats strip, exercise blocks and set rows, and the Add Exercise picker.
// Token-only -- no hardcoded colors or font sizes. The user's Workout accent
// is always passed in by the screen as a prop, never referenced here.
//
// Design intent: this is the screen used mid-set, one-handed, between sets.
// So: big numeric inputs (48pt tall, mono readout), a 44pt complete button
// per set, the previous session's numbers printed right above the sets they
// are meant to be compared with, and exactly one filled button (Finish
// Workout). Exercises are plain blocks separated by hairlines, not cards.
export const liveWorkoutStyles = StyleSheet.create({
  // ---- Frame ---------------------------------------------------------------
  // The scrolling body: exercise blocks, then the add-exercise actions.
  flex: {
    flex: 1,
  },
  content: {
    paddingHorizontal: spacing.xxl,
    paddingBottom: spacing.xxl,
  },
  errorText: {
    ...typeScale.callout,
    color: colors.destructive,
    marginTop: spacing.md,
  },
  emptyWrap: {
    paddingTop: spacing.xl,
  },
  // Add Exercise / Create Custom / Cancel Workout, after the last exercise.
  endActions: {
    paddingTop: spacing.xl,
    gap: spacing.xs,
  },
  // Pinned under the header so the timer, set count and volume stay in view
  // while the list scrolls.
  statsBar: {
    flexDirection: 'row',
    paddingHorizontal: spacing.xxl,
    paddingBottom: spacing.md,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: colors.divider,
  },
  statCell: {
    flex: 1,
    alignItems: 'center',
  },
  statValue: {
    ...typeScale.statMedium,
    color: colors.textPrimary,
  },
  statLabel: {
    ...typeScale.caption,
    color: colors.textMuted,
    marginTop: 2,
  },
  // Pinned above the bottom navigation: the one primary action. The bottom
  // navigation pads for the device inset itself, so this adds none.
  footer: {
    paddingHorizontal: spacing.xxl,
    paddingTop: spacing.md,
    paddingBottom: spacing.md,
    borderTopWidth: StyleSheet.hairlineWidth,
    borderTopColor: colors.divider,
  },

  // ---- Exercise block --------------------------------------------------------
  exerciseBlock: {
    paddingVertical: spacing.xl,
  },
  exerciseDivider: {
    borderTopWidth: StyleSheet.hairlineWidth,
    borderTopColor: colors.divider,
  },
  exerciseHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
  },
  exerciseTitleBlock: {
    flex: 1,
  },
  exerciseName: {
    ...typeScale.cardTitle,
    color: colors.textPrimary,
  },
  exerciseMuscle: {
    ...typeScale.secondary,
    color: colors.textSecondary,
    marginTop: 2,
  },
  // Explicit "weight is per side" note for a unilateral exercise -- makes the
  // per-side convention obvious rather than leaving it to the Left/Right
  // labels alone.
  perSideNote: {
    ...typeScale.caption,
    color: colors.textMuted,
    marginTop: 2,
  },
  exerciseActions: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  // Reorder / remove: a bare glyph, but a full 44pt target.
  exerciseAction: {
    width: 40,
    height: minTouchTarget,
    alignItems: 'center',
    justifyContent: 'center',
  },

  // ---- Last Workout ----------------------------------------------------------
  // Every set from the user's last completed session with this exercise, as a
  // wrapping list of plain numbers directly above today's sets -- all visible
  // at once (nothing hides behind a horizontal scroll) so they can be read
  // while typing.
  previousSession: {
    marginTop: spacing.md,
  },
  previousHeaderRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  previousTitleRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.xs,
  },
  previousTitle: {
    ...typeScale.label,
    color: colors.textSecondary,
  },
  previousDate: {
    ...typeScale.caption,
    color: colors.textMuted,
    marginTop: 2,
  },
  viewHistory: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 2,
  },
  viewHistoryText: {
    ...typeScale.secondary,
    fontFamily: typeScale.label.fontFamily,
  },
  previousSets: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    columnGap: spacing.lg,
    rowGap: spacing.xs,
    marginTop: spacing.sm,
  },
  previousSet: {
    flexDirection: 'row',
    alignItems: 'baseline',
    gap: spacing.xs,
  },
  previousSetNumber: {
    ...typeScale.caption,
    color: colors.textMuted,
  },
  previousSetValue: {
    ...typeScale.statSmall,
    color: colors.textSecondary,
  },

  // ---- Set rows --------------------------------------------------------------
  setHeaderRow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginTop: spacing.lg,
    paddingBottom: spacing.xs,
  },
  setHeaderIndex: {
    width: 28,
    ...typeScale.caption,
    color: colors.textMuted,
  },
  setHeaderInput: {
    flex: 1,
    ...typeScale.caption,
    color: colors.textMuted,
    textAlign: 'center',
  },
  setHeaderComplete: {
    width: minTouchTarget,
  },
  setRow: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: spacing.xs,
  },
  setIndex: {
    width: 28,
    ...typeScale.statSmall,
    color: colors.textSecondary,
  },
  // The number being logged is the hero of the row: a 48pt-tall field with a
  // large mono readout.
  setInput: {
    flex: 1,
    marginHorizontal: spacing.xs,
    height: minTouchTarget + spacing.xs,
    borderRadius: radii.md,
    borderWidth: 1,
    borderColor: colors.border,
    backgroundColor: colors.surfaceRaised,
    color: colors.textPrimary,
    ...typeScale.statMedium,
    textAlign: 'center',
  },
  setInputCompleted: {
    borderColor: colors.borderHero,
    backgroundColor: colors.surfaceHero,
  },
  setCompleteButton: {
    width: minTouchTarget,
    height: minTouchTarget,
    borderRadius: radii.pill,
    borderWidth: 2,
    alignItems: 'center',
    justifyContent: 'center',
  },

  // A logical unilateral set: a Left and a Right row sharing one set number
  // and one complete button.
  unilateralSetRow: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: spacing.xs,
    gap: spacing.xs,
  },
  unilateralSideRows: {
    flex: 1,
    gap: spacing.xs,
  },
  unilateralSideRow: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  // "L"/"R" -- each row's weight is that side's own, never a combined total.
  unilateralSideLabel: {
    width: 24,
    textAlign: 'center',
    ...typeScale.label,
    color: colors.textSecondary,
  },
  addSet: {
    marginTop: spacing.sm,
  },

  // ---- Add Exercise picker ---------------------------------------------------
  pickerBody: {
    flex: 1,
    paddingHorizontal: spacing.xxl,
  },
  // Vertical breathing room around the muscle-group filter row, so it does
  // not sit flush against the search field or the first row.
  muscleGroupChipsWrap: {
    marginVertical: spacing.sm,
  },
  pickerLoading: {
    paddingVertical: spacing.lg,
  },
  pickerEmptyText: {
    ...typeScale.callout,
    color: colors.textMuted,
    textAlign: 'center',
    marginTop: spacing.xl,
  },
});
