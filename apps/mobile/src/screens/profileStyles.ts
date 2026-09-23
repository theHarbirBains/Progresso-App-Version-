import { StyleSheet } from 'react-native';
import { colors, fonts, radii, spacing, typeScale, widgetGap } from '../design/theme';

// Profile-specific layout only -- everything reusable (cards, buttons,
// section headers, stat blocks, segmented control) comes from src/design/
// and src/progress/. This file exists for the handful of things unique to
// this screen's composition, following the same per-screen-stylesheet
// convention used throughout the app. The screen is a stack of widgets
// (AppCards) `widgetGap` apart, same rhythm as the workout/nutrition tabs.
export const profileStyles = StyleSheet.create({
  screen: {
    flex: 1,
    // Transparent -- AppBackgroundLayer (mounted once behind the navigator)
    // paints the selected Background Theme; screens no longer hardcode it.
    backgroundColor: 'transparent',
  },
  scrollContent: {
    paddingTop: spacing.sm,
    gap: widgetGap,
    // The persistent bottom nav (App.tsx) is a normal in-flow sibling now,
    // not an overlay this screen has to leave room for -- this is just
    // ordinary breathing room at the end of the scroll content.
    paddingBottom: spacing.xxl,
  },

  errorText: {
    ...typeScale.callout,
    color: colors.destructive,
    marginBottom: spacing.md,
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
  // "N workouts" under the display name -- Strava's own "3 activities" line,
  // between the name and the (optional) @username.
  activityCount: {
    ...typeScale.secondary,
    color: colors.textSecondary,
    marginTop: 2,
  },
  username: {
    ...typeScale.callout,
    color: colors.textSecondary,
    marginTop: 2,
  },

  editProfileWrap: {
    marginBottom: spacing.xl,
  },

  statsRow: {
    flexDirection: 'row',
    gap: widgetGap,
  },

  // Calories & Macros widget (always visible, above the tabs -- not gated
  // behind a tab, same prominence as the lifetime stats card above it).
  nutritionTitle: {
    ...typeScale.cardTitle,
    color: colors.textPrimary,
    marginBottom: spacing.md,
  },

  // Stats tab's "This Week" row, above the lifetime StatTile grid.
  thisWeekTitle: {
    ...typeScale.cardTitle,
    color: colors.textPrimary,
    marginBottom: spacing.md,
  },
  thisWeekRow: {
    flexDirection: 'row',
    gap: widgetGap,
    marginBottom: spacing.xl,
  },

  section: {
    marginBottom: spacing.xl,
  },

  tabsWrap: {
    marginBottom: spacing.xs,
  },

  emptyText: {
    ...typeScale.secondary,
    color: colors.textMuted,
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

  // Profile picture BottomSheet (Choose Photo / Remove Photo).
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
    ...typeScale.cardTitle,
    fontFamily: fonts.semibold,
    color: colors.textPrimary,
  },
  avatarSheetActionDestructive: {
    color: colors.destructive,
  },
});
