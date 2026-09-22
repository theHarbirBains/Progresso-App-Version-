import { StyleSheet } from 'react-native';
import { colors, spacing, typeScale, widgetGap } from '../design/theme';

// WorkoutHistoryScreen ("Workouts"). Token-only. The frame (safe area, fixed
// header, scrolling body) is the shared `Screen`; the page is a stack of
// widgets -- the start/resume action, the calendar with its month summary, the
// selected day and the recent workouts -- `widgetGap` apart, the same rhythm
// as the dashboards. Workouts themselves are `ListRow`s inside a widget.
export const workoutHistoryStyles = StyleSheet.create({
  content: {
    gap: widgetGap,
  },
  // Wraps the shared ModeToggle -- Workouts is one of the app's primary/root
  // screens, so it keeps this the same way Dashboard does; deeper screens
  // reached from here don't.
  modeToggleWrap: {
    marginTop: spacing.xs,
    marginBottom: spacing.xs,
  },

  // The line above the one primary button ("Ready to train?", "You have a
  // workout in progress").
  actionLine: {
    ...typeScale.callout,
    color: colors.textSecondary,
    marginBottom: spacing.sm,
  },

  // Calendar legend
  legendRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: spacing.lg,
    marginVertical: spacing.md,
  },
  legendItem: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.xs,
  },
  legendDot: {
    width: 8,
    height: 8,
    borderRadius: 4,
  },
  legendLabel: {
    ...typeScale.secondary,
    color: colors.textMuted,
  },

  // Monthly summary: three raised stat blocks, `widgetGap` apart.
  summaryRow: {
    flexDirection: 'row',
    gap: widgetGap,
  },
  errorText: {
    ...typeScale.callout,
    color: colors.destructive,
  },
  loading: {
    paddingVertical: spacing.xl,
    alignItems: 'center',
  },
});
