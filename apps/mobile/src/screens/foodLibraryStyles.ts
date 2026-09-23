import { StyleSheet } from 'react-native';
import { colors, spacing, typeScale, widgetGap } from '../design/theme';

const INDEX_RAIL_WIDTH = 20;

// FoodLibraryScreen. Token-only. The frame (safe area, fixed header, transparent
// root) is the shared `Screen` and each food is a `ListRow`, so this holds only
// the controls block above the list and the row/rail geometry.
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
    paddingHorizontal: spacing.sm,
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
    paddingHorizontal: spacing.sm,
  },
  loading: {
    paddingVertical: spacing.xxl,
  },

  listContent: {
    paddingRight: INDEX_RAIL_WIDTH,
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

  indexRailWrap: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
  },
});
