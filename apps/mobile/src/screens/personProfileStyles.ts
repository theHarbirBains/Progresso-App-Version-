import { StyleSheet } from 'react-native';
import { colors, minTouchTarget, radii, spacing, typeScale, widgetGap } from '../design/theme';

// PersonProfileScreen, and the You tab's own profile on it. Token-only. The top of the page -- photo, name, bio, counts and the follow
// button -- sits straight on the theme's photo, brightened behind it like Feed's hero, with
// its words lined up with the cards' own text below; the figures, tabs and what each tab shows are
// the usual glass cards.
export const personProfileStyles = StyleSheet.create({
  content: {
    gap: widgetGap,
    paddingBottom: spacing.xxl,
  },

  top: {
    paddingHorizontal: spacing.lg,
    gap: spacing.lg,
  },
  identity: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: spacing.lg,
  },
  // The photo in a ring of the accent, a hairline of the background between them.
  avatarRing: {
    borderWidth: 3,
    borderRadius: radii.pill,
    padding: 3,
  },
  avatarInitial: {
    ...typeScale.display,
    color: colors.textSecondary,
  },
  // Your own: the photo's place while a new one saves, and the camera saying it can be changed,
  // sitting on the ring's lower right, ringed in the background.
  avatarSaving: {
    width: 88,
    height: 88,
    alignItems: 'center',
    justifyContent: 'center',
  },
  avatarEditBadge: {
    position: 'absolute',
    right: 0,
    bottom: 0,
    width: 28,
    height: 28,
    borderRadius: radii.pill,
    borderWidth: 2,
    borderColor: colors.background,
    alignItems: 'center',
    justifyContent: 'center',
  },
  identityText: {
    flex: 1,
    gap: 2,
    paddingTop: spacing.xs,
  },
  name: {
    ...typeScale.screenTitle,
    color: colors.textPrimary,
  },
  username: {
    ...typeScale.callout,
    color: colors.textSecondaryBright,
  },
  bio: {
    ...typeScale.body,
    color: colors.textPrimary,
    marginTop: spacing.xs,
  },
  followsYou: {
    ...typeScale.caption,
    color: colors.textSecondaryBright,
    marginTop: 2,
  },
  counts: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  count: {
    minHeight: minTouchTarget,
    justifyContent: 'center',
    paddingRight: spacing.lg,
  },
  countValue: {
    ...typeScale.statSmall,
    color: colors.textPrimary,
  },
  countLabel: {
    ...typeScale.secondary,
    color: colors.textSecondaryBright,
  },
  countDivider: {
    width: StyleSheet.hairlineWidth,
    alignSelf: 'stretch',
    marginVertical: spacing.sm,
    marginRight: spacing.lg,
    backgroundColor: colors.glassBorderStrong,
  },
  mutuals: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
    minHeight: minTouchTarget,
  },
  mutualAvatars: {
    flexDirection: 'row',
  },
  // Each after the first tucks under the one before, ringed in the background.
  mutualAvatar: {
    borderRadius: radii.pill,
    borderWidth: 2,
    borderColor: colors.background,
  },
  mutualAvatarOverlap: {
    marginLeft: -10,
  },
  mutualText: {
    ...typeScale.callout,
    color: colors.textPrimary,
    flexShrink: 1,
  },

  request: {
    gap: spacing.sm,
  },
  requestText: {
    ...typeScale.callout,
    color: colors.textPrimary,
  },
  requestActions: {
    flexDirection: 'row',
    gap: spacing.sm,
  },
  actions: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
  },
  mainAction: {
    flex: 1,
  },

  // The four figures, side by side: glass tiles with an accent hairline.
  tiles: {
    flexDirection: 'row',
    gap: widgetGap,
    marginTop: spacing.sm,
  },
  tile: {
    flex: 1,
    borderRadius: radii.lg,
    padding: spacing.md,
    gap: spacing.xs,
    overflow: 'hidden',
  },
  tileValueRow: {
    flexDirection: 'row',
    alignItems: 'baseline',
    marginTop: spacing.xs,
  },
  tileValue: {
    ...typeScale.statMedium,
    color: colors.textPrimary,
  },
  tileLabel: {
    ...typeScale.caption,
    color: colors.textSecondary,
  },

  cardHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: spacing.md,
  },
  cardTitle: {
    ...typeScale.cardTitle,
    color: colors.textPrimary,
  },
  viewAll: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.xs,
    minHeight: minTouchTarget,
    paddingLeft: spacing.md,
  },
  viewAllLabel: {
    ...typeScale.label,
  },
  ranksEarned: {
    ...typeScale.caption,
    color: colors.textSecondary,
  },
  // Every achievement, three to a row: its badge at its rank, its name, the rank in its colour.
  achievements: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    rowGap: spacing.lg,
  },
  achievement: {
    width: '33.33%',
    alignItems: 'center',
    gap: spacing.xs,
    paddingHorizontal: spacing.xs,
  },
  achievementTitle: {
    ...typeScale.caption,
    color: colors.textPrimary,
    textAlign: 'center',
  },
  achievementRank: {
    ...typeScale.caption,
    letterSpacing: 1,
    textTransform: 'uppercase',
  },

  lift: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.md,
    paddingVertical: spacing.sm,
  },
  liftDivider: {
    borderTopWidth: 1,
    borderTopColor: colors.divider,
  },
  liftText: {
    flex: 1,
  },
  liftName: {
    ...typeScale.callout,
    color: colors.textPrimary,
  },
  liftMachine: {
    ...typeScale.caption,
    color: colors.textMuted,
  },
  liftValue: {
    ...typeScale.statSmall,
  },
  liftSearch: {
    marginBottom: spacing.sm,
  },
  liftNone: {
    ...typeScale.secondary,
    color: colors.textMuted,
    paddingVertical: spacing.sm,
  },
  statGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: widgetGap,
  },
  statCell: {
    // Two to a row, the gap between them shared.
    width: '48.5%',
  },

  sheetTitle: {
    ...typeScale.cardTitle,
    color: colors.textPrimary,
  },
  sheetSubtitle: {
    ...typeScale.secondary,
    color: colors.textSecondary,
    marginTop: 2,
    marginBottom: spacing.md,
  },
});
