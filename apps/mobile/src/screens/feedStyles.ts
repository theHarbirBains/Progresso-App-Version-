import { StyleSheet } from 'react-native';
import { colors, spacing, typeScale, widgetGap } from '../design/theme';

// FeedScreen. Token-only. The frame (safe area, header, scrolling body) is
// the shared `Screen`; each feed item is its own widget (`AppCard`), so this
// holds only what's inside a card.
export const feedStyles = StyleSheet.create({
  content: {
    gap: widgetGap,
  },
  loading: {
    paddingVertical: spacing.xxl,
  },

  // Shared by both card kinds: a title row (name left, a quiet date/time on
  // the right) above the card's own body.
  itemHeader: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    justifyContent: 'space-between',
    gap: spacing.md,
    marginBottom: spacing.md,
  },
  itemTitle: {
    ...typeScale.cardTitle,
    color: colors.textPrimary,
    flex: 1,
  },
  itemTimestamp: {
    ...typeScale.caption,
    color: colors.textMuted,
  },
  itemSubtitle: {
    ...typeScale.secondary,
    color: colors.textSecondary,
    marginBottom: spacing.md,
  },

  statRow: {
    flexDirection: 'row',
    gap: widgetGap,
  },

  foodRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.lg,
  },
  foodBody: {
    flex: 1,
  },
  foodMeta: {
    ...typeScale.secondary,
    color: colors.textSecondary,
    marginTop: 2,
  },
});
