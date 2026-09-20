import { StyleSheet } from 'react-native';
import { colors, spacing, typeScale } from '../design/theme';

// Local to the Start Workout screen (day-selection only -- see
// NewWorkoutScreen.tsx). The frame (safe area, scroll, horizontal padding) is
// the shared `Screen`; only what is unique to this screen lives here.
export const startWorkoutStyles = StyleSheet.create({
  // Vertical rhythm between the screen's groups (next workout, day list,
  // "do a different workout") -- larger than the 6px dashboard widget gap,
  // since these are sections of a list screen, not adjacent widgets.
  content: {
    gap: spacing.xxl,
  },
  errorText: {
    ...typeScale.callout,
    color: colors.destructive,
    marginBottom: spacing.sm,
  },
  conflictBlock: {
    gap: spacing.sm,
  },

  // Next Workout: the one card on this screen -- the actionable hero.
  heroEyebrow: {
    ...typeScale.sectionHeading,
    color: colors.textSecondary,
    marginBottom: spacing.xs,
  },
  heroDayName: {
    ...typeScale.screenTitle,
    color: colors.textPrimary,
  },
  heroMuscles: {
    ...typeScale.secondary,
    color: colors.textSecondaryBright,
    marginTop: 2,
  },
  heroMeta: {
    ...typeScale.secondary,
    color: colors.textSecondary,
    marginTop: spacing.sm,
  },
  // The visible "Start Workout" button. The whole card is the tap target (it
  // has to stay one tappable element carrying the day's text), so this wrapper
  // turns the real PrimaryButton's own touches off and lets the card take the
  // press -- the button is what the eye reads as the primary action, and it
  // shows the loading state.
  heroAction: {
    marginTop: spacing.lg,
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
    paddingHorizontal: spacing.xxl,
    gap: spacing.lg,
  },
});
