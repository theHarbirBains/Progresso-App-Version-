import { StyleSheet } from 'react-native';
import { spacing } from '../design/theme';

// FoodSearchScreen. Token-only; the frame is the shared `Screen`, results are
// `ListRow`s and the food's nutrition is the shared `FoodFacts`, so this holds
// only the search field's spacing and the busy/log blocks.
export const foodSearchStyles = StyleSheet.create({
  searchRow: {
    paddingHorizontal: spacing.xxl,
    paddingBottom: spacing.md,
  },
  loading: {
    paddingVertical: spacing.xxl,
  },
  logButtonWrap: {
    marginTop: spacing.xxl,
  },
});
