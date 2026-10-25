import { StyleSheet } from 'react-native';
import { colors, minTouchTarget, radii, spacing, typeScale } from '../design/theme';

// AiFoodSearchScreen. Token-only -- the frame is the shared `Screen`, the
// input/estimate form is the one `AppCard`, so this only holds the group's
// internal spacing, the amount-and-unit row (its unit dropdown is the food
// form's), the unit sheet and the error text.
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
  servingRow: {
    flexDirection: 'row',
    gap: spacing.md,
  },
  amountCell: {
    flex: 1,
  },
  unitCell: {
    flex: 1,
  },
  fieldLabel: {
    ...typeScale.label,
    color: colors.textSecondary,
    marginBottom: spacing.xs,
  },
  unitButton: {
    minHeight: minTouchTarget,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: spacing.xs,
    backgroundColor: colors.surface,
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: radii.md,
    paddingHorizontal: spacing.md,
  },
  unitValue: {
    ...typeScale.body,
    color: colors.textPrimary,
    flexShrink: 1,
  },
  sheetContent: {
    gap: spacing.sm,
    padding: spacing.lg,
  },
  sheetTitle: {
    ...typeScale.cardTitle,
    color: colors.textPrimary,
  },
  sheetList: {
    maxHeight: 420,
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
