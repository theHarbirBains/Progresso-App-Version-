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
    backgroundColor: colors.background,
  },
  scrollContent: {
    paddingHorizontal: spacing.xxl,
    paddingBottom: spacing.xxxl,
  },

  // WorkoutHeader
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingVertical: spacing.lg,
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

  // WorkoutActionMenu
  menuBackdrop: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    backgroundColor: 'rgba(0, 0, 0, 0.6)',
    justifyContent: 'flex-end',
  },
  menuSheet: {
    backgroundColor: colors.surface,
    borderTopLeftRadius: radii.lg,
    borderTopRightRadius: radii.lg,
    borderWidth: 1,
    borderColor: colors.border,
    padding: spacing.xl,
  },
  menuItem: {
    paddingVertical: spacing.md,
  },
  menuItemText: {
    fontSize: 16,
    fontWeight: '600',
    color: colors.textPrimary,
    textAlign: 'center',
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
});
