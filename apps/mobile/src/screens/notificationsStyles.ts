import { StyleSheet } from 'react-native';
import { spacing } from '../design/theme';

// NotificationsScreen. Token-only -- the frame is the shared `Screen`, rows
// are `ListRow`s, so this holds only the busy-state spacing and the
// request row's paired Accept/Reject buttons (same shape as
// findPeopleStyles.ts's own requestActions).
export const notificationsStyles = StyleSheet.create({
  loading: {
    paddingVertical: spacing.xxl,
  },
  requestActions: {
    flexDirection: 'row',
    gap: spacing.sm,
  },
});
