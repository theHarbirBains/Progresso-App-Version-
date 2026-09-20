import { StyleSheet } from 'react-native';
import { colors, radii, spacing, typeScale } from '../design/theme';

// Shared styles for the Start Workout / Live Workout experience
// (NewWorkoutScreen + ActiveWorkoutScreen and their shared components).
// Built on the same design/theme.ts tokens as the rest of the app -- no
// hardcoded colors, no second style system. Accent color is always passed
// in as a prop by the screen (the user's Workout Mode color), never
// hardcoded here.
export const liveWorkoutStyles = StyleSheet.create({
  screen: {
    flex: 1,
    // Transparent -- AppBackgroundLayer (mounted once behind the navigator)
    // paints the selected Background Theme; screens no longer hardcode it.
    backgroundColor: 'transparent',
  },
  scrollContent: {
    paddingHorizontal: spacing.xxl,
    paddingBottom: spacing.xxxl,
  },
  // ActiveWorkoutScreen only: makes short content (or the empty state) sit
  // vertically centered in the space between the header and the Cancel
  // Workout footer, instead of collapsing to the top -- a plain ScrollView
  // contentContainerStyle has no height of its own beyond its children, so
  // flexGrow: 1 lets it claim the full available height first, and
  // justifyContent: 'center' only takes effect on the leftover space,
  // exactly like React Native's standard "centered-if-short,
  // scrolls-normally-if-long" pattern (has no effect once content already
  // exceeds the available height).
  activeWorkoutContent: {
    flexGrow: 1,
    justifyContent: 'center',
  },
  cancelWorkoutFooter: {
    paddingHorizontal: spacing.xxl,
    paddingTop: spacing.md,
  },
  footerButtonGap: {
    marginBottom: spacing.sm,
  },

  // WorkoutHeader (ActiveWorkoutScreen's own header row -- title + close/back
  // + options). Also reused as-is by ExercisePickerModal and
  // ExerciseFormScreen's sheet presentation for their own title+close-button
  // rows, so this stays a plain row; ActiveWorkoutScreen's now-buttonless
  // header uses workoutHeaderCentered below instead of this one.
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingVertical: spacing.lg,
  },
  // ActiveWorkoutScreen only: no back arrow or options button anymore, just
  // a centered title. paddingTop is supplied by the caller (insets.top +
  // spacing.sm) since the safe-area inset isn't known here.
  workoutHeaderCentered: {
    alignItems: 'center',
    paddingBottom: spacing.md,
  },
  headerIconButton: {
    width: 40,
    height: 40,
    borderRadius: radii.pill,
    backgroundColor: colors.surface,
    borderWidth: 1,
    borderColor: colors.border,
    alignItems: 'center',
    justifyContent: 'center',
  },
  headerTitle: {
    ...typeScale.cardTitle,
    color: colors.textPrimary,
  },

  // WorkoutSummaryCard
  summaryTop: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    justifyContent: 'space-between',
  },
  summaryName: {
    ...typeScale.screenTitle,
    fontSize: 20,
    color: colors.textPrimary,
  },
  summaryMuscles: {
    color: colors.textSecondary,
    fontSize: 13,
    marginTop: 2,
  },
  summaryChangeLink: {
    fontSize: 13,
    fontWeight: '700',
  },
  summaryStatsRow: {
    flexDirection: 'row',
    marginTop: spacing.lg,
    paddingTop: spacing.lg,
    borderTopWidth: 1,
    borderTopColor: colors.border,
  },
  summaryStat: {
    flex: 1,
    alignItems: 'center',
  },
  summaryStatValue: {
    ...typeScale.statMedium,
    color: colors.textPrimary,
  },
  summaryStatLabel: {
    ...typeScale.caption,
    color: colors.textMuted,
    marginTop: 2,
  },

  // Start Workout CTA
  startButton: {
    borderRadius: radii.lg,
    paddingVertical: spacing.lg,
    alignItems: 'center',
    marginTop: spacing.xl,
  },
  startButtonText: {
    fontSize: 16,
    fontWeight: '700',
  },
  startButtonDisabled: {
    opacity: 0.5,
  },

  // Add Exercise / Create Custom row
  addExerciseRow: {
    flexDirection: 'row',
    gap: spacing.md,
    marginTop: spacing.xl,
    marginBottom: spacing.lg,
  },
  addExerciseButton: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: spacing.xs,
    paddingVertical: spacing.md,
    borderRadius: radii.md,
    borderWidth: 1,
    borderColor: colors.border,
    backgroundColor: colors.surface,
  },
  addExerciseButtonText: {
    color: colors.textPrimary,
    fontSize: 14,
    fontWeight: '600',
  },

  // ExerciseCard
  exerciseCard: {
    marginBottom: spacing.lg,
  },
  exerciseCardHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.md,
  },
  exerciseIconBox: {
    width: 40,
    height: 40,
    borderRadius: radii.md,
    backgroundColor: colors.surfaceRaised,
    alignItems: 'center',
    justifyContent: 'center',
  },
  exerciseTitleBlock: {
    flex: 1,
  },
  exerciseName: {
    ...typeScale.cardTitle,
    color: colors.textPrimary,
  },
  exerciseHeaderActions: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
  },
  exerciseIconAction: {
    width: 32,
    height: 32,
    alignItems: 'center',
    justifyContent: 'center',
  },
  exerciseMuscleBadge: {
    marginTop: spacing.sm,
  },
  // Explicit "weight is per side" note for a unilateral exercise (see
  // ExerciseCard.tsx) -- makes the per-side convention obvious rather than
  // relying on the reader to infer it from the Left/Right labels alone.
  perSideNote: {
    ...typeScale.caption,
    color: colors.textMuted,
    marginTop: spacing.xs,
  },

  // "Last Workout" -- every set from the user's last completed session with
  // this exercise, shown only when it's being logged again in the current
  // workout (see ActiveWorkoutScreen's previousPerformance).
  previousSession: {
    marginTop: spacing.md,
    paddingTop: spacing.sm,
    borderTopWidth: 1,
    borderTopColor: colors.divider,
  },
  previousSessionHeaderRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  previousSessionTitleRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.xs,
  },
  previousSessionTitle: {
    fontSize: 15,
    fontWeight: '700',
    color: colors.textPrimary,
  },
  previousSessionDate: {
    ...typeScale.caption,
    color: colors.textMuted,
    marginTop: 2,
  },
  previousSessionViewHistory: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 2,
  },
  previousSessionViewHistoryText: {
    ...typeScale.secondary,
    fontWeight: '600',
  },
  previousSessionCardsScroll: {
    flexGrow: 0,
    marginTop: spacing.sm,
  },
  previousSessionCardsRow: {
    flexDirection: 'row',
    gap: spacing.sm,
    paddingRight: spacing.xxl,
  },
  previousSessionCard: {
    minWidth: 128,
    backgroundColor: colors.surfaceRaised,
    borderRadius: radii.md,
    padding: spacing.md,
  },
  previousSessionBadge: {
    width: 22,
    height: 22,
    borderRadius: 11,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: spacing.sm,
  },
  previousSessionBadgeText: {
    fontSize: 12,
    fontWeight: '700',
  },
  previousSessionCardWeight: {
    fontSize: 18,
    fontWeight: '700',
    color: colors.textPrimary,
  },
  previousSessionCardReps: {
    ...typeScale.caption,
    color: colors.textMuted,
    marginTop: 2,
    marginBottom: spacing.sm,
  },
  previousSessionBarTrack: {
    height: 3,
    borderRadius: 2,
    backgroundColor: colors.divider,
    overflow: 'hidden',
  },
  previousSessionBarFill: {
    height: '100%',
    borderRadius: 2,
  },

  // Set rows
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
    width: 44,
  },
  setRow: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: spacing.xs,
  },
  setIndex: {
    width: 28,
    color: colors.textSecondary,
    fontSize: 15,
    fontWeight: '700',
  },
  setInput: {
    flex: 1,
    marginHorizontal: spacing.xs,
    height: 44,
    borderRadius: radii.sm,
    borderWidth: 1,
    borderColor: colors.border,
    backgroundColor: colors.surfaceRaised,
    color: colors.textPrimary,
    fontSize: 16,
    textAlign: 'center',
  },
  setInputCompleted: {
    borderColor: colors.borderHero,
    backgroundColor: colors.surfaceHero,
  },
  setCompleteButton: {
    width: 44,
    height: 44,
    borderRadius: radii.pill,
    borderWidth: 2,
    alignItems: 'center',
    justifyContent: 'center',
  },

  // UnilateralSetRow -- a logical set with a Left and a Right row (each
  // reusing setInput/setInputCompleted above) plus one shared complete
  // button, rather than SetRow's single weight/reps pair. See
  // UnilateralSetRow.tsx.
  unilateralSetRow: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: spacing.xs,
    gap: spacing.xs,
  },
  unilateralSetIndex: {
    width: 28,
    color: colors.textSecondary,
    fontSize: 15,
    fontWeight: '700',
  },
  unilateralSideRows: {
    flex: 1,
    gap: spacing.xs,
  },
  unilateralSideRow: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  // "L"/"R" -- makes explicit that each row's weight is that side's own
  // weight, never a combined total (see UnilateralSetRow.tsx's own comment).
  unilateralSideLabel: {
    width: 20,
    textAlign: 'center',
    ...typeScale.caption,
    color: colors.textMuted,
  },

  // Add Set
  addSetButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: spacing.xs,
    paddingVertical: spacing.md,
    marginTop: spacing.sm,
    borderRadius: radii.sm,
    borderWidth: 1,
    borderColor: colors.border,
    borderStyle: 'dashed',
  },
  addSetButtonText: {
    color: colors.textSecondary,
    fontSize: 14,
    fontWeight: '600',
  },

  errorText: {
    color: colors.destructive,
    fontSize: 14,
    marginBottom: spacing.md,
  },
  sectionTitle: {
    marginTop: spacing.xl,
  },
  emptyExercisesWrap: {
    marginTop: spacing.lg,
  },

  // ExercisePickerModal
  searchInput: {
    height: 44,
    borderRadius: radii.md,
    borderWidth: 1,
    borderColor: colors.border,
    backgroundColor: colors.surface,
    color: colors.textPrimary,
    paddingHorizontal: spacing.md,
    marginBottom: spacing.md,
  },
  // Extra vertical breathing room around the muscle-group filter row --
  // without this it sits flush against the search input above and the
  // "Create Custom Exercise" card below (their own margins only add space on
  // one side each, not both), reading as visually cramped top-to-bottom.
  muscleGroupChipsWrap: {
    marginVertical: spacing.sm,
  },
  pickerItem: {
    paddingVertical: spacing.md,
    borderBottomWidth: 1,
    borderBottomColor: colors.divider,
  },
  pickerItemTitle: {
    color: colors.textPrimary,
    fontSize: 15,
    fontWeight: '600',
  },
  pickerItemMeta: {
    color: colors.textSecondary,
    fontSize: 13,
    marginTop: 2,
  },
  pickerEmptyText: {
    color: colors.textMuted,
    fontSize: 14,
    textAlign: 'center',
    marginTop: spacing.xl,
  },

  // ExercisePickerModal's "Create Custom Exercise" row -- prominent (accent
  // border) but a single plain row like everything else here, not a second
  // visual language.
  createCustomCard: {
    borderWidth: 1.5,
    marginBottom: spacing.md,
  },
  createCustomRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.md,
  },
  createCustomIconCircle: {
    width: 36,
    height: 36,
    borderRadius: radii.pill,
    alignItems: 'center',
    justifyContent: 'center',
  },
  createCustomTextBlock: {
    flex: 1,
  },
  createCustomTitle: {
    ...typeScale.cardTitle,
    color: colors.textPrimary,
  },
  createCustomSubtitle: {
    ...typeScale.secondary,
    color: colors.textSecondary,
    marginTop: 2,
  },
});
