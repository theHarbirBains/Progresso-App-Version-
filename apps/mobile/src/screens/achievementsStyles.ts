import { StyleSheet } from 'react-native';
import { colors, spacing, typeScale, widgetGap } from '../design/theme';

// AchievementsScreen. Token-only: the summary hero (ranks earned and the rank ladder), then a
// card per kind of achievement, each a list of divided rows -- badge, name and rank, what it's
// for, and the bar to the next rank.
export const achievementsStyles = StyleSheet.create({
  content: {
    gap: widgetGap,
    paddingBottom: spacing.xxl,
  },

  summaryTop: {
    flexDirection: 'row',
    alignItems: 'baseline',
    gap: spacing.sm,
  },
  summaryFigure: {
    ...typeScale.statLarge,
    color: colors.textPrimary,
  },
  summaryOf: {
    ...typeScale.callout,
    color: colors.textSecondary,
  },
  summaryNote: {
    ...typeScale.secondary,
    color: colors.textSecondary,
    marginTop: spacing.xs,
  },
  // The nine ranks side by side, each with how many achievements have reached it.
  ladder: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginTop: spacing.lg,
  },
  ladderStep: {
    alignItems: 'center',
    gap: spacing.xs,
  },
  ladderCount: {
    ...typeScale.label,
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
    alignItems: 'center',
    gap: spacing.md,
    paddingVertical: spacing.md,
  },
  rowDivider: {
    borderTopWidth: 1,
    borderTopColor: colors.divider,
  },
  rowText: {
    flex: 1,
    gap: spacing.xs,
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
  rowRank: {
    ...typeScale.caption,
    letterSpacing: 1,
    textTransform: 'uppercase',
  },
  rowDescription: {
    ...typeScale.secondary,
    color: colors.textSecondary,
  },
  error: {
    ...typeScale.callout,
    color: colors.destructive,
  },
});
