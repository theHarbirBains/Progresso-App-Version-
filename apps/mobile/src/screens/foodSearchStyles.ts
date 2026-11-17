import { StyleSheet } from 'react-native';
import { colors, spacing, typeScale } from '../design/theme';

// FoodSearchScreen. Token-only; the frame is the shared `Screen`, results are
// `ListRow`s and the food's nutrition is the shared `FoodFacts`, so this holds
// only the search field's spacing, the busy/log blocks and the quiet lines
// around the results.
export const foodSearchStyles = StyleSheet.create({
  searchRow: {
    paddingHorizontal: spacing.xxl,
    paddingBottom: spacing.md,
  },
  logButtonWrap: {
    marginTop: spacing.xxl,
  },
  correctedText: {
    ...typeScale.secondary,
    color: colors.textSecondary,
    marginBottom: spacing.sm,
  },
  footerRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: spacing.sm,
    paddingTop: spacing.md,
  },
  footerText: {
    ...typeScale.secondary,
    color: colors.textMuted,
  },
  noResultsActions: {
    gap: spacing.sm,
    paddingTop: spacing.md,
  },
});
