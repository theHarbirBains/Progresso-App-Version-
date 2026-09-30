import { StyleSheet } from 'react-native';
import { colors, spacing, typeScale } from '../design/theme';

// LogPastWorkoutScreen. The exercise/set block visuals themselves reuse
// liveWorkoutStyles (same family as the live workout screen) -- this file
// only holds what's specific to this screen: the scrolling body's gutter and
// gap, and the exercise header's "remove" glyph (a plain × rather than the
// live screen's trash icon, since removing a not-yet-saved draft exercise
// here is a lighter action than removing one from an already-in-progress
// workout).
export const logPastWorkoutStyles = StyleSheet.create({
  content: {
    paddingHorizontal: spacing.xxl,
    paddingTop: spacing.md,
    paddingBottom: spacing.xxl,
    gap: spacing.lg,
  },
  removeExerciseGlyph: {
    ...typeScale.cardTitle,
    color: colors.textMuted,
  },
});
