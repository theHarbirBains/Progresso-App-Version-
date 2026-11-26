import { StyleSheet } from 'react-native';
import { colors, minTouchTarget, radii, spacing, typeScale, widgetGap } from '../design/theme';

// Shared by the three split screens -- the list (WorkoutSplitsScreen), the
// read-only view (WorkoutSplitViewScreen) and the form (WorkoutSplitForm-
// Screen). The frame (safe area, header, scroll, horizontal padding) is the
// shared `Screen`; a split's days and muscle groups are plain rows and text on
// the screen, so this file only holds what those rows need.
export const workoutSplitStyles = StyleSheet.create({
  errorText: {
    ...typeScale.callout,
    color: colors.destructive,
  },

  // ---- Splits list ---------------------------------------------------------
  // Every split is its own widget (a card), `widgetGap` apart, with the
  // "Create Workout Split" button beneath the last one.
  listContent: {
    gap: widgetGap,
  },
  // A heading after a widget: more room above it than between widgets, so each part of the page
  // (the active split, the rest, finding one) reads as its own.
  sectionGap: {
    marginTop: spacing.lg,
  },
  // Create Workout Split, a little apart from the last split above it.
  createWrap: {
    marginTop: spacing.sm,
  },
  // The Browse Splits tab starts a little below the tabs, as My Splits' first heading does.
  libraryTab: {
    marginTop: spacing.md,
    gap: widgetGap,
  },
  // My Splits' first heading, a little below the tabs.
  firstHeading: {
    marginTop: spacing.md,
  },
  // A section's cards, widgetGap apart.
  cardStack: {
    gap: widgetGap,
  },

  // ---- Split view (read-only) ----------------------------------------------
  dayName: {
    ...typeScale.cardTitle,
    color: colors.textPrimary,
  },
  dayHeader: {
    flexDirection: 'row',
    alignItems: 'baseline',
    justifyContent: 'space-between',
  },
  // The day Start Workout will suggest next, on the active split.
  nextMark: {
    ...typeScale.label,
  },
  // A day's planned exercises, and the way into its plan.
  planLink: {
    minHeight: 44,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginTop: spacing.sm,
  },
  planText: {
    ...typeScale.secondary,
    color: colors.textSecondary,
  },
  planAction: {
    ...typeScale.secondary,
  },
  // A day's muscle groups as plain text in a wrapping line -- no chips or
  // badges: they are read-only information, not controls.
  muscleLine: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    alignItems: 'center',
    columnGap: spacing.sm,
    rowGap: 2,
    marginTop: spacing.xs,
  },
  muscleLabel: {
    ...typeScale.secondary,
    color: colors.textSecondaryBright,
  },
  muscleSeparator: {
    ...typeScale.secondary,
    color: colors.textMuted,
  },
  noGroups: {
    ...typeScale.secondary,
    color: colors.textMuted,
    marginTop: spacing.xs,
  },

  // ---- Split form ----------------------------------------------------------
  formDayName: {
    flex: 1,
  },
  fieldLabel: {
    ...typeScale.label,
    color: colors.textSecondary,
    marginTop: spacing.md,
    marginBottom: spacing.xs,
  },
  // Muscle-group toggles ARE controls (multi-select), so they are chips: a
  // 36pt pill with a 44pt touch area, filled with the mode accent when on.
  chipRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: spacing.sm,
  },
  chip: {
    minHeight: minTouchTarget - spacing.sm,
    justifyContent: 'center',
    paddingHorizontal: spacing.md,
    borderRadius: radii.pill,
    borderWidth: 1,
    borderColor: colors.border,
    backgroundColor: colors.surfaceRaised,
  },
  chipText: {
    ...typeScale.secondary,
    fontFamily: typeScale.label.fontFamily,
    color: colors.textSecondary,
  },
});
