import { StyleSheet } from 'react-native';
import { spacing } from '../design/theme';

// FindPeopleScreen. Token-only -- the frame is the shared `Screen`, rows are
// `ListRow`s, so this holds only the search field's spacing and the
// requests row's paired Accept/Reject buttons.
export const findPeopleStyles = StyleSheet.create({
  searchRow: {
    paddingHorizontal: spacing.xxl,
    paddingBottom: spacing.md,
  },
  loading: {
    paddingVertical: spacing.xxl,
  },
  requestActions: {
    flexDirection: 'row',
    gap: spacing.sm,
  },
});
