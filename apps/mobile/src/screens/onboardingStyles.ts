import { StyleSheet } from 'react-native';
import { colors, radii, spacing, typeScale } from '../design/theme';

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
  backButton: {
    width: 36,
    height: 36,
    borderRadius: radii.pill,
    backgroundColor: colors.surface,
    borderWidth: 1,
    borderColor: colors.border,
    alignItems: 'center',
    justifyContent: 'center',
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
    color: colors.textSecondary,
    fontSize: 14,
    marginBottom: spacing.xl,
  },
  wheelArea: {
    alignItems: 'center',
    paddingVertical: spacing.xl,
  },
  errorText: {
    color: colors.destructive,
    fontSize: 14,
    marginBottom: spacing.md,
  },
  footer: {
    paddingTop: spacing.lg,
  },
  continueButton: {
    backgroundColor: colors.accent,
    borderRadius: radii.md,
    paddingVertical: spacing.md,
    alignItems: 'center',
  },
  continueButtonDisabled: {
    opacity: 0.5,
  },
  continueButtonText: {
    color: colors.onAccent,
    fontFamily: 'Manrope_700Bold',
    fontSize: 15,
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
    color: colors.textSecondary,
    fontSize: 15,
    textAlign: 'center',
    marginBottom: spacing.xxxl,
  },
  startButton: {
    alignSelf: 'stretch',
    backgroundColor: colors.accent,
    borderRadius: radii.md,
    paddingVertical: spacing.md,
    alignItems: 'center',
  },
  startButtonText: {
    color: colors.onAccent,
    fontFamily: 'Manrope_700Bold',
    fontSize: 16,
  },
});
