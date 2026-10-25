import { StyleSheet } from 'react-native';
import { colors, radii, spacing, typeScale } from '../design/theme';

// Shared by Feedback & Suggestions' pages and the admins' inbox: flat Settings-style pages
// (settingsStyles.categoryGap) with these few extras.
export const feedbackStyles = StyleSheet.create({
  title: {
    ...typeScale.cardTitle,
    color: colors.textPrimary,
  },
  meta: {
    ...typeScale.secondary,
    color: colors.textSecondary,
    marginTop: spacing.xs,
  },
  body: {
    ...typeScale.body,
    color: colors.textPrimary,
    marginTop: spacing.md,
  },
  caption: {
    ...typeScale.secondary,
    color: colors.textMuted,
  },
  error: {
    ...typeScale.callout,
    color: colors.destructive,
  },
  screenshot: {
    width: '100%',
    height: 240,
    borderRadius: radii.md,
    backgroundColor: colors.surfaceRaised,
    marginTop: spacing.md,
  },
  headRow: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    justifyContent: 'space-between',
    gap: spacing.md,
  },
  headText: {
    flex: 1,
  },
  historyRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    paddingVertical: spacing.sm,
  },
  historyDivider: {
    borderTopWidth: StyleSheet.hairlineWidth,
    borderTopColor: colors.divider,
  },
  historyStatus: {
    ...typeScale.callout,
    color: colors.textPrimary,
  },
  historyDate: {
    ...typeScale.secondary,
    color: colors.textSecondary,
  },
  gapSmall: {
    gap: spacing.sm,
  },
  gapMedium: {
    gap: spacing.md,
  },
  alignStart: {
    alignItems: 'flex-start',
  },
});
