import { StyleSheet } from 'react-native';
import { colors, radii, spacing, typeScale } from '../design/theme';

export const workoutSplitStyles = StyleSheet.create({
  screen: {
    flex: 1,
    backgroundColor: colors.background,
  },
  scrollContent: {
    paddingHorizontal: spacing.xxl,
    paddingBottom: spacing.xxxl,
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.md,
    paddingBottom: spacing.lg,
  },
  backButton: {
    width: 36,
    height: 36,
    borderRadius: radii.pill,
    backgroundColor: colors.surface,
    borderWidth: 1,
    borderColor: colors.border,
    alignItems: 'center',
    justifyContent: 'center',
  },
  title: {
    ...typeScale.screenTitle,
    color: colors.textPrimary,
  },
  errorText: {
    color: colors.destructive,
    fontSize: 14,
    marginBottom: spacing.md,
  },
  sectionLabel: {
    ...typeScale.sectionHeading,
    color: colors.textMuted,
    marginBottom: spacing.md,
  },
  list: {
    marginBottom: spacing.xl,
    gap: spacing.md,
  },
  splitCard: {
    borderWidth: 1,
  },
  splitCardHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  splitName: {
    ...typeScale.cardTitle,
    color: colors.textPrimary,
  },
  activeBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    paddingHorizontal: spacing.sm,
    paddingVertical: 4,
    borderRadius: radii.pill,
  },
  activeBadgeText: {
    fontSize: 11,
    fontWeight: '700',
    letterSpacing: 0.5,
  },
  activateBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    paddingHorizontal: spacing.sm,
    paddingVertical: 4,
    borderRadius: radii.pill,
    borderWidth: 1,
    borderColor: colors.border,
  },
  activateBadgeText: {
    fontSize: 11,
    fontWeight: '700',
    letterSpacing: 0.5,
    color: colors.textMuted,
  },
  splitMeta: {
    color: colors.textSecondary,
    fontSize: 13,
    marginTop: 2,
  },
  splitActionsRow: {
    flexDirection: 'row',
    gap: spacing.lg,
    marginTop: spacing.md,
    paddingTop: spacing.md,
    borderTopWidth: 1,
    borderTopColor: colors.divider,
  },
  actionText: {
    color: colors.textSecondary,
    fontSize: 13,
    fontWeight: '600',
  },
  deleteActionText: {
    color: colors.destructive,
    fontSize: 13,
    fontWeight: '600',
  },
  createButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: spacing.sm,
    borderRadius: radii.lg,
    paddingVertical: spacing.md + 2,
  },
  createButtonText: {
    fontSize: 16,
    fontWeight: '700',
  },

  // Form screen
  label: {
    color: colors.textSecondary,
    fontSize: 13,
    marginTop: spacing.md,
    marginBottom: spacing.xs,
  },
  input: {
    backgroundColor: colors.surface,
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: radii.md,
    paddingHorizontal: spacing.md,
    paddingVertical: 10,
    color: colors.textPrimary,
    fontSize: 16,
  },
  dayCard: {
    marginBottom: spacing.md,
  },
  dayName: {
    ...typeScale.cardTitle,
    color: colors.textPrimary,
    marginBottom: spacing.sm,
  },
  dayHeaderRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
    marginBottom: spacing.sm,
  },
  dayInput: {
    flex: 1,
    backgroundColor: colors.surface,
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: radii.md,
    paddingHorizontal: spacing.md,
    paddingVertical: 8,
    color: colors.textPrimary,
    fontSize: 15,
    fontWeight: '600',
  },
  dayReorderButton: {
    width: 32,
    height: 32,
    alignItems: 'center',
    justifyContent: 'center',
  },
  muscleChipRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: spacing.xs,
  },
  muscleChip: {
    paddingHorizontal: spacing.md,
    paddingVertical: 6,
    borderRadius: radii.pill,
    borderWidth: 1,
    borderColor: colors.border,
    backgroundColor: colors.surfaceRaised,
  },
  muscleChipText: {
    fontSize: 12,
    fontWeight: '600',
    color: colors.textSecondary,
  },
  addDayButton: {
    alignItems: 'center',
    paddingVertical: spacing.md,
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: radii.md,
    borderStyle: 'dashed',
    marginTop: spacing.sm,
  },
  addDayButtonText: {
    fontSize: 14,
    fontWeight: '600',
    color: colors.textSecondary,
  },

  // Choose Your Workout Split
  introText: {
    color: colors.textSecondary,
    fontSize: 14,
    marginBottom: spacing.xl,
  },
  presetDayRow: {
    marginTop: spacing.xs,
  },
  presetDayName: {
    color: colors.textPrimary,
    fontSize: 13,
    fontWeight: '700',
  },
  presetDayMuscles: {
    color: colors.textMuted,
    fontSize: 12,
    marginTop: 1,
  },
});
