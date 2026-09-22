import { StyleSheet } from 'react-native';
import { colors, minTouchTarget, radii, spacing, typeScale, widgetGap } from '../design/theme';

// Shared by the three split screens -- the list (WorkoutSplitsScreen), the
// read-only view (WorkoutSplitViewScreen) and the form (WorkoutSplitForm-
// Screen). The frame (safe area, header, scroll, horizontal padding) is the
// shared `Screen`; a split's days and muscle groups are plain rows and text on
// the screen, so this file only holds what those rows need.
export const workoutSplitStyles = StyleSheet.create({
  // Vertical rhythm between a screen's groups.
  content: {
    gap: spacing.xxl,
  },
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
  // Edit / Duplicate / Delete, beneath a split's row inside its widget.
  splitActions: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.xl,
  },
  // The "this is your active split" marker. Uppercase caption, in the mode
  // accent (colour supplied per render).
  activeLabel: {
    ...typeScale.caption,
    letterSpacing: 1,
  },

  // ---- Split view (read-only) ----------------------------------------------
  dayBlock: {
    paddingVertical: spacing.md,
  },
  dayDivider: {
    borderTopWidth: StyleSheet.hairlineWidth,
    borderTopColor: colors.divider,
  },
  dayName: {
    ...typeScale.cardTitle,
    color: colors.textPrimary,
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
  formGap: {
    gap: spacing.lg,
  },
  formDayHeader: {
    flexDirection: 'row',
    alignItems: 'flex-end',
    gap: spacing.xs,
  },
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
