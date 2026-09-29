import { StyleSheet } from 'react-native';
import { colors, spacing, typeScale, widgetGap } from '../design/theme';

// NotificationsScreen. Token-only -- the frame is the shared `Screen`; each
// notification is its own widget (`AppCard`, same "one card per activity"
// anatomy Feed's own cards use -- icon/avatar + title + subtitle, an
// accent band on top), so this holds only what's inside a card plus the
// busy-state spacing between them.
export const notificationsStyles = StyleSheet.create({
  content: {
    gap: widgetGap,
  },
  loading: {
    paddingVertical: spacing.xxl,
  },
  // "Insights"/"Activity" sit directly on the screen (not inside a card),
  // so unlike a card -- whose own padding creates its inset from the
  // edge-to-edge frame -- they need an explicit gutter of their own. A
  // deliberate 6px here, not the standard screen gutter (spacing.xxl) --
  // explicit design call for this screen.
  sectionHeaderWrap: {
    paddingHorizontal: 6,
  },
  itemRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.md,
  },
  iconWell: {
    width: 44,
    height: 44,
    borderRadius: 22,
    backgroundColor: colors.surfaceRaised,
    alignItems: 'center',
    justifyContent: 'center',
  },
  avatarInitial: {
    ...typeScale.cardTitle,
    color: colors.textSecondary,
  },
  itemBody: {
    flex: 1,
    gap: 2,
  },
  itemTitle: {
    ...typeScale.cardTitle,
    color: colors.textPrimary,
  },
  itemSubtitle: {
    ...typeScale.secondary,
    color: colors.textMuted,
  },
  itemActionWrap: {
    marginTop: spacing.lg,
  },
  requestActions: {
    flexDirection: 'row',
    gap: spacing.sm,
  },
});
