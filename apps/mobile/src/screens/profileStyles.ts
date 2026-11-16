import { StyleSheet } from 'react-native';
import { colors, spacing, typeScale, widgetGap } from '../design/theme';

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

  // Calories & Macros widget, atop Stats: its four StatBlocks two to a row,
  // like the Stats tab's own figures (personProfileStyles' statGrid).
  nutritionTitle: {
    ...typeScale.cardTitle,
    color: colors.textPrimary,
    marginBottom: spacing.md,
  },
  statBlockGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: widgetGap,
  },
  statBlockCell: {
    width: '48.5%',
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

  // Stats tab -- "Most Trained Muscle Groups": each group and its sets, a
  // plain list (no bars).
  muscleGroupsTitle: {
    ...typeScale.cardTitle,
    color: colors.textPrimary,
    marginBottom: spacing.md,
  },
  muscleGroupRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginBottom: spacing.md,
  },
  muscleGroupLabel: {
    ...typeScale.body,
    color: colors.textPrimary,
  },
  muscleGroupCount: {
    ...typeScale.secondary,
    color: colors.textSecondary,
  },

  // Profile picture BottomSheet (Choose Photo / Remove Photo).
  avatarSheetTitle: {
    ...typeScale.sectionHeading,
    color: colors.textMuted,
    marginBottom: spacing.md,
  },
});
