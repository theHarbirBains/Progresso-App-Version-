import { StyleSheet } from 'react-native';
import { colors, minTouchTarget, spacing, typeScale, widgetGap } from '../design/theme';

// CalorieEstimationScreen ("Personal Information"). Token-only; the frame is
// the shared `Screen`. One row per field, separated by hairlines.
export const calorieEstimationStyles = StyleSheet.create({
  // The widgets, `widgetGap` apart.
  content: {
    gap: widgetGap,
    paddingBottom: spacing.xxl,
  },

  fieldRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: spacing.md,
    minHeight: minTouchTarget + spacing.md,
    paddingVertical: spacing.sm,
  },
  fieldDivider: {
    borderTopWidth: StyleSheet.hairlineWidth,
    borderTopColor: colors.divider,
  },
  fieldRowLabel: {
    ...typeScale.callout,
    fontFamily: typeScale.cardTitle.fontFamily,
    color: colors.textPrimary,
  },
  // The value(s) and any unit toggle, kept together on the right.
  fieldRowControl: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.md,
    flexShrink: 1,
  },
  valueButton: {
    minHeight: minTouchTarget,
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.xs,
    flexShrink: 1,
  },
  valueText: {
    ...typeScale.callout,
    color: colors.textPrimary,
    flexShrink: 1,
  },
  fieldError: {
    ...typeScale.caption,
    color: colors.destructive,
    marginBottom: spacing.sm,
  },

  actions: {
    gap: spacing.md,
  },
  footnote: {
    ...typeScale.caption,
    color: colors.textMuted,
    textAlign: 'center',
  },

  // Picker sheets.
  sheetTitle: {
    ...typeScale.cardTitle,
    color: colors.textPrimary,
    marginBottom: spacing.md,
  },
  sheetList: {
    maxHeight: 420,
  },
  sheetDoneButton: {
    marginTop: spacing.lg,
  },
});
