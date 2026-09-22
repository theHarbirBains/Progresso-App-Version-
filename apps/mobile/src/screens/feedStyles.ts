import { StyleSheet } from 'react-native';
import { colors, spacing, typeScale, widgetGap } from '../design/theme';

// FeedScreen. Token-only. The frame (safe area, header, scrolling body) is
// the shared `Screen`; each feed item is its own widget (`AppCard`), so this
// holds only what's inside a card.
//
// Card anatomy (byline row -> bold title -> stat strip) mirrors Strava's
// activity-card structure -- see DESIGN.md's Feed section -- kept strictly
// black-and-white/monochrome (textPrimary/textSecondary/textMuted only, no
// accent color) per the explicit design call: Feed distinguishes a
// workout from a food log with an icon, not a color.
export const feedStyles = StyleSheet.create({
  content: {
    gap: widgetGap,
  },
  loading: {
    paddingVertical: spacing.xxl,
  },

  // The header "+" button's action sheet.
  sheetTitle: {
    ...typeScale.sectionHeading,
    color: colors.textMuted,
    marginBottom: spacing.md,
  },

  // The byline: a small avatar, the account's own name, and a quiet
  // icon+timestamp line underneath -- Strava's "who, when" row, without the
  // social graph (it's always the signed-in user).
  metaRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.md,
    marginBottom: spacing.md,
  },
  avatarWrap: {
    width: 32,
    height: 32,
    borderRadius: 16,
    backgroundColor: colors.surfaceRaised,
    alignItems: 'center',
    justifyContent: 'center',
    overflow: 'hidden',
  },
  avatarInitial: {
    ...typeScale.label,
    color: colors.textSecondary,
  },
  metaBody: {
    flex: 1,
  },
  metaName: {
    ...typeScale.label,
    color: colors.textPrimary,
  },
  metaSubRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.xs,
    marginTop: 2,
  },
  metaTimestamp: {
    ...typeScale.caption,
    color: colors.textMuted,
  },

  itemTitle: {
    ...typeScale.screenTitle,
    color: colors.textPrimary,
    flex: 1,
  },
  itemSubtitle: {
    ...typeScale.secondary,
    color: colors.textSecondary,
    marginTop: 2,
    marginBottom: spacing.md,
  },

  statRow: {
    flexDirection: 'row',
    gap: widgetGap,
    marginTop: spacing.md,
  },

  // The food-log title row: the photo stands in for Strava's route map --
  // a real image where one exists, rather than fabricated location data.
  foodTitleRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.lg,
  },
});
