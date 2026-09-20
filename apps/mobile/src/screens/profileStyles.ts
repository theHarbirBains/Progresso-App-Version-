import { StyleSheet } from 'react-native';
import { colors, radii, spacing, typeScale } from '../design/theme';

// Profile-specific layout only -- everything reusable (cards, buttons,
// section headers, stat values, segmented control) comes from src/design/
// and src/progress/. This file exists for the handful of things unique to
// this screen's composition, following the same per-screen-stylesheet
// convention as dashboardStyles.ts/workoutHistoryStyles.ts.
export const profileStyles = StyleSheet.create({
  screen: {
    flex: 1,
    // Transparent -- AppBackgroundLayer (mounted once behind the navigator)
    // paints the selected Background Theme; screens no longer hardcode it.
    backgroundColor: 'transparent',
  },
  scrollContent: {
    paddingHorizontal: spacing.xxl,
    paddingTop: spacing.lg,
    // The persistent bottom nav (App.tsx) is a normal in-flow sibling now,
    // not an overlay this screen has to leave room for -- this is just
    // ordinary breathing room at the end of the scroll content.
    paddingBottom: spacing.xxl,
  },

  errorText: {
    color: colors.destructive,
    fontSize: 14,
    marginBottom: spacing.md,
  },

  headerRow: {
    flexDirection: 'row',
    justifyContent: 'flex-end',
    marginBottom: spacing.md,
  },
  // Wraps the shared ModeToggle (design/ModeToggle.tsx) -- Profile is one
  // of the app's primary/root screens, so it keeps this the same way
  // Dashboard does; deeper screens reached from here don't.
  modeToggleWrap: {
    marginBottom: spacing.lg,
  },
  iconButton: {
    width: 36,
    height: 36,
    borderRadius: radii.pill,
    backgroundColor: colors.surface,
    borderWidth: 1,
    borderColor: colors.border,
    alignItems: 'center',
    justifyContent: 'center',
  },

  identityRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.lg,
    marginBottom: spacing.xl,
  },
  avatarWrap: {
    position: 'relative',
  },
  avatar: {
    width: 72,
    height: 72,
    borderRadius: radii.pill,
    alignItems: 'center',
    justifyContent: 'center',
    overflow: 'hidden',
  },
  avatarInitial: {
    ...typeScale.display,
    fontSize: 28,
  },
  // Minimal camera badge signaling the avatar above is tappable -- the one
  // small edit indicator DESIGN.md's icon system already supports (Feather,
  // no new icon set), sized/positioned to sit just inside the avatar's own
  // circle rather than a separate floating element.
  avatarEditBadge: {
    position: 'absolute',
    right: -2,
    bottom: -2,
    width: 24,
    height: 24,
    borderRadius: radii.pill,
    borderWidth: 2,
    borderColor: colors.background,
    alignItems: 'center',
    justifyContent: 'center',
  },
  identityBlock: {
    flex: 1,
  },
  displayName: {
    ...typeScale.screenTitle,
    color: colors.textPrimary,
  },
  username: {
    color: colors.textSecondary,
    fontSize: 14,
    marginTop: 2,
  },

  editProfileButton: {
    borderRadius: radii.lg,
    borderWidth: 1,
    borderColor: colors.border,
    paddingVertical: spacing.md,
    alignItems: 'center',
    marginBottom: spacing.xl,
  },
  editProfileButtonText: {
    color: colors.textPrimary,
    fontSize: 15,
    fontWeight: '600',
  },

  statsRow: {
    flexDirection: 'row',
    marginBottom: spacing.xl,
  },
  statBlock: {
    flex: 1,
    alignItems: 'center',
  },
  statLabel: {
    ...typeScale.caption,
    color: colors.textMuted,
    marginTop: spacing.xs,
    textAlign: 'center',
  },

  section: {
    marginBottom: spacing.xl,
  },

  tabsWrap: {
    marginBottom: spacing.lg,
  },
  tabContent: {
    minHeight: 120,
  },

  emptyWrap: {
    paddingVertical: spacing.lg,
  },
  emptyText: {
    ...typeScale.secondary,
    color: colors.textMuted,
  },
  viewAllRow: {
    alignItems: 'center',
    paddingVertical: spacing.md,
  },
  viewAllText: {
    fontSize: 14,
    fontWeight: '600',
  },

  // StatTile (progress/StatTile.tsx) already sizes itself (flexBasis: 47%,
  // flexGrow: 1) to sit directly in a wrapping row like this one -- no
  // extra per-item wrapper needed.
  statTileGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: spacing.sm,
    marginBottom: spacing.xl,
  },

  // Workouts tab -- ProfileWorkoutRow (ProfileScreen.tsx). Deliberately its
  // own layout rather than reusing WorkoutHistoryScreen's WorkoutCard
  // verbatim: this design calls for a sets/volume summary row WorkoutCard
  // doesn't have, and that screen is out of scope for this change.
  workoutCard: {
    marginBottom: spacing.md,
  },
  workoutTitle: {
    ...typeScale.cardTitle,
    color: colors.textPrimary,
  },
  workoutMeta: {
    ...typeScale.secondary,
    color: colors.textSecondary,
    marginTop: 2,
  },
  workoutMuscleGroups: {
    ...typeScale.secondary,
    color: colors.textMuted,
    marginTop: 2,
  },
  workoutStatsRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginTop: spacing.sm,
    paddingTop: spacing.sm,
    borderTopWidth: 1,
    borderTopColor: colors.divider,
  },
  workoutStatsText: {
    ...typeScale.secondary,
    color: colors.textSecondary,
  },
  workoutStatsValue: {
    ...typeScale.cardTitle,
  },

  // Stats tab -- "Most Trained Muscle Groups" bar list, same recipe
  // StrengthSection's own muscle-group bars use (progressStyles.ts),
  // kept here rather than a cross-screen import per the established
  // per-screen-stylesheet convention.
  muscleGroupsTitle: {
    ...typeScale.cardTitle,
    color: colors.textPrimary,
    marginBottom: spacing.md,
  },
  muscleGroupRow: {
    marginBottom: spacing.md,
  },
  muscleGroupLabelRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginBottom: spacing.xs,
  },
  muscleGroupLabel: {
    ...typeScale.body,
    color: colors.textPrimary,
  },
  muscleGroupCount: {
    ...typeScale.secondary,
    color: colors.textSecondary,
  },
  muscleGroupBarTrack: {
    height: 6,
    borderRadius: radii.sm,
    backgroundColor: colors.surfaceRaised,
    overflow: 'hidden',
  },
  muscleGroupBarFill: {
    height: '100%',
    borderRadius: radii.sm,
  },

  // Profile picture BottomSheet (Choose Photo / Remove Photo) -- same
  // title+action-row shape as QuickActionMenu's own sheet content.
  avatarSheetTitle: {
    ...typeScale.sectionHeading,
    color: colors.textMuted,
    marginBottom: spacing.md,
  },
  avatarSheetAction: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.md,
    paddingVertical: spacing.md,
  },
  avatarSheetActionLabel: {
    color: colors.textPrimary,
    fontSize: 16,
    fontWeight: '600',
  },
  avatarSheetActionDestructive: {
    color: colors.destructive,
  },
});
