import { StyleSheet } from 'react-native';
import { colors, spacing, typeScale } from '../design/theme';

// AiFoodSearchScreen. Token-only -- the frame is the shared `Screen`, the
// input/estimate form is the one `AppCard`, so this only holds the group's
// internal spacing and the error text.
export const aiFoodSearchStyles = StyleSheet.create({
  group: {
    gap: spacing.lg,
  },
  description: {
    ...typeScale.secondary,
    color: colors.textSecondary,
  },
  guidance: {
    ...typeScale.caption,
    color: colors.textMuted,
  },
  example: {
    ...typeScale.caption,
    color: colors.textMuted,
    fontStyle: 'italic',
  },
  clarificationText: {
    ...typeScale.callout,
    color: colors.textPrimary,
  },
  errorText: {
    ...typeScale.callout,
    color: colors.destructive,
  },
});
