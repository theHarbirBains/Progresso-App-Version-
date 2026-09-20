import { StyleSheet } from 'react-native';
import { colors, radii, spacing, typeScale } from '../design/theme';

// Local to the new Start Workout screen (day-selection only -- see
// NewWorkoutScreen.tsx). Deliberately not merged into liveWorkoutStyles.ts,
// which ActiveWorkoutScreen still depends on for its own, unrelated
// exercise/set-tracking styles.
export const startWorkoutStyles = StyleSheet.create({
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
  section: {
    marginBottom: spacing.xxl,
  },
  errorText: {
    color: colors.destructive,
    fontSize: 14,
    marginBottom: spacing.lg,
  },

  // Next Workout hero
  heroTopRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.md,
  },
  heroIconChip: {
    width: 44,
    height: 44,
    borderRadius: radii.md,
    alignItems: 'center',
    justifyContent: 'center',
  },
  heroTextBlock: {
    flex: 1,
  },
  heroEyebrow: {
    fontSize: 12.5,
    fontWeight: '600',
    marginBottom: 2,
  },
  heroDayName: {
    ...typeScale.screenTitle,
    color: colors.textPrimary,
  },
  heroMuscles: {
    ...typeScale.secondary,
    color: colors.textSecondary,
    marginTop: 2,
  },
  heroChevronCircle: {
    width: 32,
    height: 32,
    borderRadius: radii.pill,
    alignItems: 'center',
    justifyContent: 'center',
  },
  heroMetaRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.xs,
    marginTop: spacing.md,
  },
  heroMetaText: {
    ...typeScale.secondary,
    color: colors.textSecondary,
  },

  // Plain day rows (All Workout Days / Do a Different Workout)
  dayRow: {
    marginBottom: spacing.sm,
  },
  dayRowInner: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.md,
  },
  dayIconCircle: {
    width: 40,
    height: 40,
    borderRadius: radii.pill,
    backgroundColor: colors.surfaceRaised,
    alignItems: 'center',
    justifyContent: 'center',
  },
  dayTextBlock: {
    flex: 1,
  },
  dayName: {
    ...typeScale.cardTitle,
    color: colors.textPrimary,
  },
  dayMuscles: {
    ...typeScale.secondary,
    color: colors.textSecondary,
    marginTop: 2,
  },
  dayRowDisabled: {
    opacity: 0.5,
  },

  // "Do a Different Workout" naming sheet
  sheetTitle: {
    ...typeScale.cardTitle,
    color: colors.textPrimary,
    marginBottom: spacing.xs,
  },
  sheetSubtitle: {
    ...typeScale.secondary,
    color: colors.textSecondary,
    marginBottom: spacing.lg,
  },
  sheetButtonRow: {
    marginTop: spacing.lg,
    marginBottom: spacing.sm,
  },

  emptyWrap: {
    paddingVertical: spacing.xxxl,
  },
});
