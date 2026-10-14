import { StyleSheet } from 'react-native';
import { colors, spacing, typeScale, widgetGap } from '../design/theme';

// LogPastWorkoutScreen: widgets like the rest of the app -- the workout's
// details, one card per exercise, and the add-exercise card. The set rows
// inside reuse liveWorkoutStyles (same family as the live workout screen);
// this file holds what's specific to this screen: the widget stack, a card's
// inner spacing, the empty hint, and the exercise header's "remove" glyph (a
// plain × rather than the live screen's trash icon, since removing a
// not-yet-saved draft exercise here is a lighter action than removing one
// from an already-in-progress workout).
export const logPastWorkoutStyles = StyleSheet.create({
  content: {
    paddingTop: spacing.sm,
    paddingBottom: spacing.xxl,
    gap: widgetGap,
  },
  cardBody: {
    gap: spacing.md,
  },
  hint: {
    ...typeScale.secondary,
    color: colors.textSecondary,
  },
  removeExerciseGlyph: {
    ...typeScale.cardTitle,
    color: colors.textMuted,
  },
});
