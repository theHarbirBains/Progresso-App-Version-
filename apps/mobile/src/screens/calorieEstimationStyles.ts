import { StyleSheet } from 'react-native';
import { colors, radii, spacing, typeScale, widgetGap } from '../design/theme';

// CalorieEstimationScreen ("Personal Information"). Token-only; the frame is
// the shared `Screen`, groups are `Section`s and every field is a `ChoiceTile`.
export const calorieEstimationStyles = StyleSheet.create({
  // The widgets, `widgetGap` apart.
  content: {
    gap: widgetGap,
    paddingBottom: spacing.xxl,
  },

  // Two tiles side by side, `widgetGap` apart like StatBlocks.
  tileRow: {
    flexDirection: 'row',
    gap: widgetGap,
  },
  tileCell: {
    flex: 1,
  },
  // A height or weight: its tile, then its unit toggle.
  measureCell: {
    flex: 1,
    gap: spacing.sm,
  },
  wideTile: {
    marginTop: widgetGap,
  },

  // An icon well: the accent tint behind a glyph in the accent.
  glyph: {
    width: 40,
    height: 40,
    borderRadius: radii.pill,
    alignItems: 'center',
    justifyContent: 'center',
  },
  sexTile: {
    alignItems: 'center',
    gap: spacing.sm,
    paddingVertical: spacing.xs,
  },
  wideTileRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.md,
  },
  wideTileBody: {
    flex: 1,
  },
  tileTitle: {
    ...typeScale.callout,
    fontFamily: typeScale.cardTitle.fontFamily,
    color: colors.textPrimary,
  },
  tileLabel: {
    ...typeScale.caption,
    color: colors.textSecondary,
    marginTop: 2,
  },
  ageBlock: {
    alignItems: 'flex-end',
  },
  ageValue: {
    ...typeScale.statMedium,
    color: colors.textPrimary,
  },
  measureHead: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    justifyContent: 'space-between',
    marginBottom: spacing.sm,
  },
  measureValue: {
    ...typeScale.statMedium,
    color: colors.textPrimary,
    marginTop: 2,
  },
  fieldError: {
    ...typeScale.caption,
    color: colors.destructive,
    marginTop: spacing.xs,
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
