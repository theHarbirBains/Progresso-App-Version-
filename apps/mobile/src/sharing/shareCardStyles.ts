import { StyleSheet } from 'react-native';
import { colors, radii, spacing, typeScale } from '../design/theme';

// The Share Workout screen and the card it captures. Token-only.
//
// The card is deliberately brand-coloured rather than following the user's
// accent or Background Theme: it becomes a PNG shared outside the app, so it
// always uses the static Progresso palette (`colors.background`, the brand
// `colors.accent` for PRs) and the same typography as the app. The screen
// around it (frame, header, buttons) is the shared design system.
export const shareCardStyles = StyleSheet.create({
  content: {
    alignItems: 'stretch',
    gap: spacing.xl,
    paddingBottom: spacing.xxl,
  },
  errorText: {
    ...typeScale.callout,
    color: colors.destructive,
    textAlign: 'center',
    marginBottom: spacing.md,
  },
  loading: {
    paddingVertical: spacing.xxl,
  },

  // 9:16 -- the same aspect ratio the card is captured at (1080x1920), just
  // rendered at a screen-friendly width. The preview IS the captured view,
  // not a separate representation of it.
  cardWrapper: {
    alignItems: 'center',
  },
  card: {
    width: 320,
    aspectRatio: 1080 / 1920,
    backgroundColor: colors.background,
    borderRadius: radii.lg,
    borderWidth: 1,
    borderColor: colors.border,
    padding: spacing.xl,
    justifyContent: 'space-between',
  },
  wordmark: {
    ...typeScale.label,
    color: colors.textSecondary,
    letterSpacing: 3,
  },
  cardTop: {
    gap: spacing.xs,
  },
  workoutName: {
    ...typeScale.screenTitle,
    color: colors.textPrimary,
    marginTop: spacing.md,
  },
  workoutDate: {
    ...typeScale.label,
    color: colors.textSecondary,
  },
  musclesTrained: {
    ...typeScale.label,
    color: colors.textSecondary,
    marginTop: 2,
  },
  topSetsSection: {
    marginTop: spacing.xl,
    gap: spacing.sm,
  },
  sectionLabel: {
    ...typeScale.sectionHeading,
    color: colors.textMuted,
    marginBottom: 2,
  },
  topSetRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'baseline',
  },
  topSetExercise: {
    ...typeScale.callout,
    fontFamily: typeScale.cardTitle.fontFamily,
    color: colors.textPrimary,
    flexShrink: 1,
    paddingRight: spacing.sm,
  },
  topSetValue: {
    ...typeScale.statSmall,
    color: colors.textPrimary,
  },
  prSection: {
    marginTop: spacing.lg,
    gap: spacing.xs,
  },
  prLine: {
    ...typeScale.label,
    fontFamily: typeScale.cardTitle.fontFamily,
    color: colors.accent,
  },
  footer: {
    ...typeScale.statSmall,
    color: colors.textSecondary,
    marginTop: spacing.lg,
  },

  // Below the card: Share is the one filled button, Save to Photos the quiet
  // secondary.
  actions: {
    gap: spacing.md,
  },
  savedText: {
    ...typeScale.callout,
    color: colors.textSecondary,
    textAlign: 'center',
  },
  actionError: {
    ...typeScale.callout,
    color: colors.destructive,
    textAlign: 'center',
  },
});
