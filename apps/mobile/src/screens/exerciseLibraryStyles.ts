import { StyleSheet } from 'react-native';
import { colors, radii, spacing, typeScale } from '../design/theme';

// Local to ExerciseLibraryScreen's list/browse view only -- deliberately not
// the legacy exerciseStyles.ts, which ExerciseFormScreen (create/edit, out
// of scope for this pass) still relies on unchanged. Every color here comes
// from the shared theme tokens, not the old hardcoded hex palette.
export const exerciseLibraryStyles = StyleSheet.create({
  screen: {
    flex: 1,
    // Transparent -- AppBackgroundLayer (mounted once behind the navigator)
    // paints the selected Workout background; this screen never hardcodes
    // its own.
    backgroundColor: 'transparent',
  },
  listContent: {
    paddingHorizontal: spacing.xxl,
    paddingTop: spacing.md,
    // Generous bottom padding so the last row clears the persistent global
    // BottomNavBar (mounted in App.tsx, outside this screen) -- same
    // convention as ProfileScreen's own scroll content.
    paddingBottom: spacing.xxxl,
  },

  searchWrap: {
    marginBottom: spacing.md,
  },

  // Extra vertical breathing room around the muscle-group filter row --
  // matches the existing regression guard (ExerciseLibraryScreen.test.tsx)
  // that this must stay positive.
  chipsWrap: {
    marginVertical: spacing.sm,
  },

  // "All / Built-in / Mine" category cards.
  categoryRow: {
    flexDirection: 'row',
    gap: spacing.sm,
    marginBottom: spacing.lg,
  },
  categoryCard: {
    flex: 1,
    alignItems: 'center',
    padding: spacing.sm,
  },
  categoryCardIcon: {
    marginBottom: spacing.xs,
  },
  categoryCardLabel: {
    ...typeScale.secondary,
    fontWeight: '700',
    color: colors.textPrimary,
  },
  categoryCardCount: {
    color: colors.textSecondary,
    fontSize: 11,
    marginTop: 2,
  },

  countSortRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: spacing.sm,
  },
  countText: {
    color: colors.textSecondary,
    fontSize: 13,
  },
  sortButton: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.xs,
  },
  sortButtonText: {
    color: colors.textSecondary,
    fontSize: 13,
    fontWeight: '600',
  },

  // Exercise rows -- each its own dark glass card (AppCard), not a plain
  // divided list, matching the reference's clearly-separated row treatment.
  exerciseRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: spacing.sm,
  },
  exerciseRowLeft: {
    flex: 1,
    paddingRight: spacing.sm,
  },
  exerciseName: {
    ...typeScale.cardTitle,
    color: colors.textPrimary,
    marginBottom: spacing.xs,
  },
  exerciseTagsRow: {
    flexDirection: 'row',
    gap: spacing.xs,
  },
  exerciseTag: {
    backgroundColor: colors.surfaceRaised,
    borderRadius: radii.sm,
    paddingHorizontal: spacing.sm,
    paddingVertical: 3,
  },
  exerciseTagText: {
    color: colors.textSecondary,
    fontSize: 11,
    fontWeight: '600',
  },
  exerciseRowRight: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
  },
  sourceBadge: {
    borderRadius: radii.sm,
    borderWidth: 1,
    paddingHorizontal: spacing.sm,
    paddingVertical: 3,
  },
  sourceBadgeText: {
    fontSize: 11,
    fontWeight: '700',
  },

  emptyText: {
    color: colors.textSecondary,
    fontSize: 14,
    textAlign: 'center',
    marginTop: spacing.xxxl,
  },
  errorText: {
    color: colors.destructive,
    fontSize: 14,
    marginBottom: spacing.md,
  },
  loadMoreButton: {
    alignItems: 'center',
    paddingVertical: spacing.md,
  },
  loadMoreText: {
    color: colors.textSecondary,
    fontSize: 13,
    fontWeight: '600',
  },
});
