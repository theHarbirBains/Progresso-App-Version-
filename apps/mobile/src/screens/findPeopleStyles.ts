import { StyleSheet } from 'react-native';
import { spacing } from '../design/theme';

// FindPeopleScreen. Token-only -- the frame is the shared `Screen`, rows are
// `ListRow`s, so this holds only the Friends/Requests tab's and search
// field's spacing, and the requests row's paired Accept/Reject buttons.
export const findPeopleStyles = StyleSheet.create({
  // The Friends/Requests toggle sits directly on the screen (not inside a
  // card), so unlike a card -- whose own padding creates its inset from the
  // edge-to-edge frame -- it needs an explicit gutter of its own.
  tabWrap: {
    paddingHorizontal: spacing.xxl,
    paddingBottom: spacing.md,
  },
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
