import { StyleSheet } from 'react-native';
import { colors, spacing, typeScale } from '../design/theme';

// Every signed-out screen (Sign In, Sign Up, Forgot/Reset Password, Welcome),
// via AuthFrame. Token-only; inputs and buttons are the shared design
// components, so this holds only the frame and a few text blocks.
export const authStyles = StyleSheet.create({
  // The Screen's scrolling body: centred vertically when the form is short.
  content: {
    flexGrow: 1,
    justifyContent: 'center',
    paddingVertical: spacing.xxl,
  },
  frame: {
    gap: spacing.lg,
  },
  header: {
    alignItems: 'center',
    gap: spacing.xs,
    marginBottom: spacing.sm,
  },
  logo: {
    width: 64,
    height: 64,
    marginBottom: spacing.md,
  },
  title: {
    ...typeScale.screenTitle,
    color: colors.textPrimary,
    textAlign: 'center',
  },
  subtitle: {
    ...typeScale.body,
    color: colors.textSecondary,
    textAlign: 'center',
  },
  info: {
    ...typeScale.body,
    color: colors.textSecondary,
    textAlign: 'center',
  },
  errorText: {
    ...typeScale.callout,
    color: colors.destructive,
  },
  actions: {
    gap: spacing.sm,
  },
  // "or" between the password form and the OAuth buttons, flanked by hairlines.
  dividerRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.md,
  },
  dividerLine: {
    flex: 1,
    height: StyleSheet.hairlineWidth,
    backgroundColor: colors.divider,
  },
  dividerText: {
    ...typeScale.secondary,
    color: colors.textMuted,
  },
  // "Already have an account? Sign In"
  footer: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: spacing.xs,
  },
  footerText: {
    ...typeScale.callout,
    color: colors.textSecondary,
  },
});
