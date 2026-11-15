import { StyleSheet } from 'react-native';
import { colors, radii, spacing, typeScale, widgetGap } from '../design/theme';

// AchievementsScreen. Token-only: the rank hero (emblem, rank, AP, the bar to the next
// division), the filter, then the earned and still-ahead cards -- each a list of divided rows:
// an icon well, name and AP, what it takes, and when it was earned or the bar to it.
export const achievementsStyles = StyleSheet.create({
  content: {
    gap: widgetGap,
    paddingBottom: spacing.xxl,
  },

  rank: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.lg,
  },
  rankText: {
    flex: 1,
    gap: spacing.xs,
  },
  rankLabel: {
    ...typeScale.screenTitle,
  },
  rankPoints: {
    ...typeScale.statMedium,
    color: colors.textPrimary,
  },
  rankNext: {
    ...typeScale.caption,
    color: colors.textSecondary,
  },
  count: {
    ...typeScale.secondary,
    color: colors.textSecondary,
    marginTop: spacing.md,
  },

  section: {
    gap: spacing.xs,
    marginTop: spacing.md,
  },
  sectionHeader: {
    flexDirection: 'row',
    alignItems: 'baseline',
    justifyContent: 'space-between',
    paddingHorizontal: 6,
  },
  sectionNote: {
    ...typeScale.caption,
    color: colors.textMuted,
  },

  row: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: spacing.md,
    paddingVertical: spacing.md,
  },
  rowDivider: {
    borderTopWidth: 1,
    borderTopColor: colors.divider,
  },
  icon: {
    width: 40,
    height: 40,
    borderRadius: radii.md,
    alignItems: 'center',
    justifyContent: 'center',
  },
  rowText: {
    flex: 1,
    gap: 2,
  },
  rowTitleLine: {
    flexDirection: 'row',
    alignItems: 'baseline',
    justifyContent: 'space-between',
    gap: spacing.sm,
  },
  rowTitle: {
    ...typeScale.callout,
    color: colors.textPrimary,
    flexShrink: 1,
  },
  rowAp: {
    ...typeScale.label,
    color: colors.textSecondary,
  },
  rowDescription: {
    ...typeScale.secondary,
    color: colors.textSecondary,
  },
  rowEarned: {
    ...typeScale.caption,
    color: colors.textSecondaryBright,
  },
  rowProgress: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
    marginTop: spacing.xs,
  },
  rowBar: {
    flex: 1,
  },
  rowProgressLabel: {
    ...typeScale.caption,
    color: colors.textMuted,
  },
});
