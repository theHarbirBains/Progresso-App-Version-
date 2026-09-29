import { StyleSheet } from 'react-native';
import { spacing } from '../design/theme';

// FindPeopleScreen. Token-only -- the frame is the shared `Screen`, tabs are
// `UnderlineTabs` (full-bleed by design, same as ProfileScreen's own use of
// it -- see its own component comment), rows are `ListRow`s, so this holds
// only the search field's spacing, the sub-tab's bottom margin, the invite
// block's gutter, and the requests row's paired Accept/Reject buttons.
export const findPeopleStyles = StyleSheet.create({
  searchRow: {
    paddingHorizontal: spacing.xxl,
    paddingTop: spacing.md,
    paddingBottom: spacing.md,
  },
  subTabWrap: {
    marginBottom: spacing.sm,
  },
  loading: {
    paddingVertical: spacing.xxl,
  },
  requestActions: {
    flexDirection: 'row',
    gap: spacing.sm,
  },
  // The invite block sits directly on the screen (not inside a card), so
  // unlike a card -- whose own padding creates its inset from the
  // edge-to-edge frame -- it needs an explicit gutter of its own.
  inviteWrap: {
    paddingHorizontal: spacing.xxl,
    gap: spacing.sm,
  },
});
