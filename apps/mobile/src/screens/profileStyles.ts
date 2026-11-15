import { StyleSheet } from 'react-native';
import { colors, radii, spacing, typeScale, widgetGap } from '../design/theme';

// The You tab's own parts only (screens/ProfileScreen.tsx) -- the profile
// itself is PersonProfilePage's (personProfileStyles.ts). Each part is its own
// AppCard inside one of the page's tabs -- today's calories and macros, your
// training, your records -- following the same per-screen-stylesheet
// convention used throughout the app.
export const profileStyles = StyleSheet.create({
  // Above the page: a profile or a photo that didn't save, lined up with the
  // page's own words.
  notices: {
    paddingHorizontal: spacing.lg,
  },

  errorText: {
    ...typeScale.callout,
    color: colors.destructive,
    marginBottom: spacing.md,
  },

  // Calories & Macros widget, on Overview.
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
});
