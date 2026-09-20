import { StyleSheet } from 'react-native';
import { colors, spacing, typeScale } from '../design/theme';

// WorkoutHistoryScreen ("Workouts"). Token-only. The frame (safe area, fixed
// header, transparent root) is the shared `Screen`; workouts are `ListRow`s,
// so this holds only the blocks that make up the page.
export const workoutHistoryStyles = StyleSheet.create({
  listContent: {
    paddingHorizontal: spacing.xxl,
    paddingBottom: spacing.xxl,
  },
  // Every group on the page (mode toggle, primary action, calendar, summary,
  // day/recent lists) is separated by the same vertical step.
  block: {
    marginBottom: spacing.xl,
  },
  // Wraps the shared ModeToggle -- Workouts is one of the app's primary/root
  // screens, so it keeps this the same way Dashboard does; deeper screens
  // reached from here don't.
  modeToggleWrap: {
    marginTop: spacing.xs,
  },

  // "You have a workout in progress" -- a plain line above the one primary
  // button, not a card.
  resumeText: {
    ...typeScale.callout,
    color: colors.textSecondary,
    marginBottom: spacing.sm,
  },

  // Calendar legend
  legendRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: spacing.lg,
    marginBottom: spacing.md,
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

  // Monthly summary: three neutral mono readouts separated from the calendar
  // by a hairline.
  summaryRow: {
    flexDirection: 'row',
    paddingTop: spacing.lg,
    borderTopWidth: StyleSheet.hairlineWidth,
    borderTopColor: colors.divider,
  },
  summaryStat: {
    flex: 1,
    alignItems: 'center',
  },
  summaryLabel: {
    ...typeScale.caption,
    color: colors.textMuted,
    marginTop: 2,
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
