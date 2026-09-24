import { StyleSheet } from 'react-native';
import { colors, spacing, typeScale } from '../design/theme';

export const onboardingStyles = StyleSheet.create({
  screen: {
    flex: 1,
    // Onboarding is explicitly out of scope for the Background Theme
    // feature (see the task's scope notes) -- stays on the static default,
    // unlike the rest of the app's screen containers.
    backgroundColor: colors.background,
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
  body: {
    flex: 1,
    justifyContent: 'center',
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
  completionContainer: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
  },
  completionTitle: {
    ...typeScale.screenTitle,
    color: colors.textPrimary,
    textAlign: 'center',
    marginBottom: spacing.sm,
  },
  completionSubtitle: {
    ...typeScale.body,
    color: colors.textSecondary,
    textAlign: 'center',
    marginBottom: spacing.xxxl,
  },
});
