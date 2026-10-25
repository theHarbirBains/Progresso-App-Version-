import { StyleSheet } from 'react-native';
import { colors, spacing, typeScale, widgetGap } from '../design/theme';

// FoodLibraryScreen. Token-only. The frame (safe area, fixed header, transparent
// root) is the shared `Screen` and each food is a `ListRow`, so this holds only
// the controls block above the list and the row geometry.
export const foodLibraryStyles = StyleSheet.create({
  flex: {
    flex: 1,
  },
  // The whole page: the mode toggle, the search/count widget and the list
  // widget (which takes the remaining height and scrolls inside itself),
  // `widgetGap` apart.
  page: {
    flex: 1,
    gap: widgetGap,
    paddingHorizontal: 0,
    paddingBottom: spacing.lg,
  },
  modeToggleWrap: {
    marginBottom: spacing.xs,
  },
  listCard: {
    flex: 1,
  },
  block: {
    marginBottom: spacing.md,
  },
  countRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  countText: {
    ...typeScale.secondary,
    color: colors.textSecondary,
  },
  padded: {
    paddingHorizontal: 0,
  },

  // A letter heading after the first: room above it, so the groups read apart.
  laterSection: {
    paddingTop: spacing.lg,
  },
  // A food row: the ListRow (logs it) beside its edit button; consecutive
  // rows in a section are separated by a hairline across both.
  row: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  rowDivider: {
    borderTopWidth: StyleSheet.hairlineWidth,
    borderTopColor: colors.divider,
  },

  // A saved meal's sheet: its name, how many foods and calories, the foods, then Log Meal
  // and Edit Meal.
  sheetContent: {
    gap: spacing.sm,
    padding: spacing.lg,
  },
  sheetTitle: {
    ...typeScale.cardTitle,
    color: colors.textPrimary,
  },
  sheetSummary: {
    ...typeScale.secondary,
    color: colors.textSecondary,
  },
  sheetList: {
    maxHeight: 320,
    marginVertical: spacing.sm,
  },
  sheetError: {
    ...typeScale.callout,
    color: colors.destructive,
  },
});
