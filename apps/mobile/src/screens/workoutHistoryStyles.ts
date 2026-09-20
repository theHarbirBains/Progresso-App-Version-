import { StyleSheet } from 'react-native';
import { colors, radii, spacing, typeScale } from '../design/theme';

// Local to WorkoutHistoryScreen only -- deliberately not merged into
// workoutStyles.ts, which several other screens (ExerciseProgress,
// NutritionGoals/Today, PRHistory, WorkoutDetail) also depend on and are
// out of scope for this migration.
export const workoutHistoryStyles = StyleSheet.create({
  screen: {
    flex: 1,
    // Transparent -- AppBackgroundLayer (mounted once behind the navigator)
    // paints the selected Background Theme; screens no longer hardcode it.
    backgroundColor: 'transparent',
  },
  // Mode toggle, below the shared AppHeader (hamburger + title). Condensed
  // spacing throughout this file (this and the styles below) so the page's
  // widgets sit closer together, without the subtitle line that used to
  // separate the toggle from the header.
  header: {
    paddingHorizontal: spacing.xxl,
    paddingBottom: spacing.sm,
  },
  // Wraps the shared ModeToggle (design/ModeToggle.tsx) -- Workouts is one
  // of the app's primary/root screens, so it keeps this the same way
  // Dashboard does; deeper screens reached from here don't.
  modeToggleWrap: {
    marginTop: spacing.sm,
  },
  section: {
    paddingHorizontal: spacing.xxl,
    marginBottom: spacing.md,
  },
  banner: {
    marginBottom: spacing.sm,
  },
  bannerTitle: {
    color: colors.textPrimary,
    fontSize: 15,
    fontWeight: '700',
    marginBottom: spacing.sm,
  },

  // Calendar legend
  legendRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: spacing.lg,
    marginBottom: spacing.md,
  },
  legendItem: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.xs,
  },
  legendDot: {
    width: 8,
    height: 8,
    borderRadius: 4,
  },
  legendLabel: {
    ...typeScale.secondary,
    color: colors.textMuted,
  },

  // Monthly summary
  summaryRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
  },
  summaryStat: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
  },
  summaryIconCircle: {
    width: 36,
    height: 36,
    borderRadius: radii.pill,
    alignItems: 'center',
    justifyContent: 'center',
  },
  summaryLabel: {
    ...typeScale.caption,
    color: colors.textMuted,
  },
  summaryError: {
    color: colors.destructive,
    fontSize: 13,
  },

  // Selected-day / recent workout cards
  card: {
    borderLeftWidth: 3,
    marginBottom: spacing.md,
  },
  cardRow: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  cardBody: {
    flex: 1,
  },
  cardTitle: {
    ...typeScale.cardTitle,
    color: colors.textPrimary,
  },
  cardMuscles: {
    ...typeScale.secondary,
    color: colors.textMuted,
    marginTop: 2,
  },
  cardMetaRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.md,
    marginTop: spacing.sm,
  },
  cardMetaItem: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
  },
  cardMetaText: {
    ...typeScale.secondary,
    color: colors.textSecondary,
  },

  sectionHeaderRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: spacing.md,
  },

  loadMoreButton: {
    alignItems: 'center',
    paddingVertical: spacing.md,
    marginHorizontal: spacing.xxl,
    marginBottom: spacing.md,
  },
  loadMoreText: {
    color: colors.textSecondary,
    fontSize: 14,
    fontWeight: '600',
  },
});
