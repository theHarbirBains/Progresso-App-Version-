import { StyleSheet } from 'react-native';
import { colors, spacing, typeScale } from '../design/theme';

// Every signed-out screen (Sign In, Sign Up, Forgot/Reset Password, Welcome),
// via AuthFrame. Token-only; inputs and buttons are the shared design
// components, so this holds only the frame and a few text blocks.
export const authStyles = StyleSheet.create({
  // The Screen's scrolling body: centred vertically when the form is short.
  // Horizontal padding here (Screen itself is edge-to-edge by default, see
  // DESIGN.md's Feed section) -- a form screen's inputs/buttons need a real
  // gutter, unlike Feed's own full-bleed cards.
  content: {
    flexGrow: 1,
    justifyContent: 'center',
    paddingHorizontal: spacing.xxl,
    paddingVertical: spacing.xxxl,
  },
  frame: {
    gap: spacing.xl,
  },
  header: {
    alignItems: 'center',
    gap: spacing.sm,
    marginBottom: spacing.md,
  },
  logo: {
    width: 96,
    height: 96,
    marginBottom: spacing.md,
  },
  title: {
    ...typeScale.display,
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
