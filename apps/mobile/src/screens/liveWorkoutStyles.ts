import { StyleSheet } from 'react-native';
import { colors, minTouchTarget, radii, spacing, typeScale, widgetGap } from '../design/theme';

// Shared styles for the Live Workout experience: ActiveWorkoutScreen, its
// stats strip, exercise blocks and set rows, and the Add Exercise picker.
// Token-only -- no hardcoded colors or font sizes. The user's Workout accent
// is always passed in by the screen as a prop, never referenced here.
//
// Design intent: this is the screen used mid-set, one-handed, between sets.
// So: big numeric inputs (48pt tall, mono readout), a 44pt complete button
// per set, and exactly one filled button (Finish Workout). Each exercise is its
// own widget (a `Card`): its photo, its records (All-Time Best, Last Time),
// last session's sets in a carousel, then today's sets.
export const liveWorkoutStyles = StyleSheet.create({
  // ---- Frame ---------------------------------------------------------------
  // The scrolling body: exercise blocks, then the add-exercise actions.
  flex: {
    flex: 1,
  },
  // The exercise widgets, `widgetGap` apart.
  content: {
    paddingHorizontal: spacing.xxl,
    paddingTop: spacing.xs,
    paddingBottom: spacing.xxl,
    gap: widgetGap,
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
  // The duration, set count and exercise count, three neutral mono readouts in a row.
  statsBar: {
    flexDirection: 'row',
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
  // Pinned under the header: the workout's widget -- its stats and the person's rep range --
  // stays in view while the exercises scroll.
  heroWrap: {
    paddingHorizontal: spacing.xxl,
    paddingBottom: spacing.sm,
  },
  rangeRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
    marginTop: spacing.md,
    paddingTop: spacing.xs,
    borderTopWidth: StyleSheet.hairlineWidth,
    borderTopColor: colors.divider,
  },
  rangeBody: {
    flex: 1,
  },
  rangeText: {
    ...typeScale.callout,
    color: colors.textSecondary,
  },
  rangeValue: {
    ...typeScale.statSmall,
    color: colors.textPrimary,
  },
  rangeNote: {
    ...typeScale.caption,
    color: colors.textMuted,
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

  // ---- Exercise widget ------------------------------------------------------
  exerciseHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.md,
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
  // Only an exercise with a rep range of its own says so, in the accent.
  ownRange: {
    ...typeScale.caption,
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
  // Edit Workout's and Log a Past Workout's reorder/remove glyphs, side by side.
  exerciseActions: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  // A bare glyph (the "more" glyph, reorder, remove), but a full 44pt target.
  exerciseAction: {
    width: 40,
    height: minTouchTarget,
    alignItems: 'center',
    justifyContent: 'center',
  },
  // The exercise's actions, opened from its "more" glyph: a row of glyph-over-label targets.
  menuRow: {
    flexDirection: 'row',
    marginTop: spacing.sm,
    paddingVertical: spacing.xs,
    borderRadius: radii.md,
    backgroundColor: colors.surfaceLift,
  },
  menuAction: {
    flex: 1,
    minHeight: minTouchTarget,
    alignItems: 'center',
    justifyContent: 'center',
    gap: 2,
  },
  menuActionLabel: {
    ...typeScale.caption,
  },

  // All-Time Best and Last Time, side by side, `widgetGap` apart like StatBlocks.
  recordTiles: {
    flexDirection: 'row',
    gap: widgetGap,
    marginTop: spacing.md,
  },
  recordTile: {
    flex: 1,
    paddingVertical: spacing.sm,
    paddingHorizontal: spacing.md,
    borderRadius: radii.md,
    backgroundColor: colors.surfaceLift,
  },
  recordLabel: {
    ...typeScale.caption,
    color: colors.textSecondary,
  },
  recordValue: {
    ...typeScale.statSmall,
    color: colors.textPrimary,
    marginTop: 2,
  },
  recordMeta: {
    ...typeScale.caption,
    color: colors.textMuted,
    marginTop: 2,
  },

  // ---- Last Time's sets --------------------------------------------------------
  // Every set from the last session with this exercise, one at a time in a carousel that
  // moves on by itself and can be swiped to any set.
  previousSession: {
    marginTop: spacing.lg,
  },
  previousHeaderRow: {
    flexDirection: 'row',
    alignItems: 'baseline',
    justifyContent: 'space-between',
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
  slide: {
    alignItems: 'center',
    paddingVertical: spacing.sm,
  },
  slideLabel: {
    ...typeScale.caption,
    color: colors.textMuted,
  },
  slideValue: {
    ...typeScale.statLarge,
    color: colors.textPrimary,
    marginTop: spacing.xs,
  },
  slideTag: {
    ...typeScale.caption,
    marginTop: spacing.xs,
  },
  // On a set that reached the top of the range: an accent alert glyph and one short line.
  slideFlag: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.xs,
    marginTop: spacing.sm,
  },
  slideFlagText: {
    ...typeScale.callout,
    fontFamily: typeScale.label.fontFamily,
  },
  // Today's sets, under their own heading.
  today: {
    marginTop: spacing.lg,
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
  // A timed set's one time field, across both columns.
  setInputWide: {
    flex: 2,
  },
  // A bodyweight set's weight column: "BW", no field -- the exercise records reps only.
  setBodyweightCell: {
    flex: 1,
    marginHorizontal: spacing.xs,
    height: minTouchTarget + spacing.xs,
    alignItems: 'center',
    justifyContent: 'center',
  },
  setBodyweightText: {
    ...typeScale.label,
    color: colors.textMuted,
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
  // A quiet remove action beside the complete button -- only shown where
  // removing a set mid-workout is actually offered (see SetRow/
  // UnilateralSetRow's own onRemove prop), so it never widens a row where
  // it isn't.
  setRemoveButton: {
    width: 40,
    height: minTouchTarget,
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

  // ---- Progression (workouts/progression.ts) ---------------------------------
  // Quiet text, never a card or a badge: the one accent is the small glyph.
  sessionCue: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
    marginTop: spacing.sm,
  },
  sessionCueText: {
    ...typeScale.callout,
    color: colors.textSecondary,
    flex: 1,
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
