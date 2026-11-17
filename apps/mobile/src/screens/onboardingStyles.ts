import { StyleSheet } from 'react-native';
import { colors, spacing, typeScale } from '../design/theme';

export const onboardingStyles = StyleSheet.create({
  screen: {
    flex: 1,
    // Transparent like every other screen, so onboarding sits on the plain
    // background AppBackgroundLayer paints before sign-in.
    backgroundColor: 'transparent',
  },
  keyboardAvoiding: {
    flex: 1,
  },
  scrollContent: {
    flexGrow: 1,
    paddingHorizontal: spacing.xxl,
    paddingBottom: spacing.xxxl,
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.md,
    paddingBottom: spacing.xl,
  },
  progress: {
    flex: 1,
  },
  // Every question starts at the same height, so moving on never shifts where to look; the body
  // still fills the screen, which keeps Continue at its foot.
  body: {
    flex: 1,
    justifyContent: 'flex-start',
  },
  // "About You · 2 of 6", over each question.
  sectionLabel: {
    ...typeScale.label,
    color: colors.textSecondary,
    marginBottom: spacing.sm,
  },
  stepTitle: {
    ...typeScale.screenTitle,
    color: colors.textPrimary,
    marginBottom: spacing.sm,
  },
  stepExplanation: {
    ...typeScale.callout,
    color: colors.textSecondary,
    marginBottom: spacing.xl,
  },
  wheelArea: {
    alignItems: 'center',
    paddingVertical: spacing.xl,
  },
  errorText: {
    ...typeScale.callout,
    color: colors.destructive,
    marginBottom: spacing.md,
  },
  footer: {
    paddingTop: spacing.lg,
  },
  // A quiet line under a step's own buttons: where to find this again later.
  footnote: {
    ...typeScale.secondary,
    color: colors.textMuted,
    textAlign: 'center',
    marginTop: spacing.sm,
  },
});
