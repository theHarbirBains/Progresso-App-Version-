import { StyleSheet } from 'react-native';
import { colors, fonts, spacing, typeScale } from '../design/theme';

// Dashboard-specific layout only -- everything reusable (cards, buttons,
// section headers, stat values, badges) comes from src/design/. This file
// exists for the handful of things unique to this screen's composition.
export const dashboardStyles = StyleSheet.create({
  header: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    justifyContent: 'space-between',
    marginBottom: spacing.xl,
  },
  greeting: {
    ...typeScale.screenTitle,
    color: colors.textPrimary,
    flexShrink: 1,
    paddingRight: spacing.md,
  },
  settingsButton: {
    padding: spacing.xs,
  },
  primaryAction: {
    marginBottom: spacing.xxl,
  },
  section: {
    marginBottom: spacing.xxl,
  },
  errorText: {
    color: colors.destructive,
    fontSize: 14,
    marginBottom: spacing.md,
  },
  cardTitle: {
    ...typeScale.cardTitle,
    color: colors.textPrimary,
    marginBottom: 2,
  },
  cardMeta: {
    color: colors.textSecondary,
    fontSize: 13,
  },
  topSetRow: {
    marginTop: spacing.md,
    gap: spacing.sm,
  },
  topSetText: {
    color: colors.textPrimary,
    fontSize: 15,
  },
  topSetValue: {
    fontFamily: fonts.monoBold,
    color: colors.accent,
    fontSize: 17,
  },
  insight: {
    color: colors.textSecondary,
    fontSize: 13,
    marginTop: spacing.xs,
  },
  calorieText: {
    color: colors.textSecondary,
    fontSize: 13,
    marginBottom: spacing.sm,
  },
  calorieValue: {
    fontFamily: fonts.monoBold,
    color: colors.textPrimary,
    fontSize: 26,
  },
  macroText: {
    color: colors.textSecondary,
    fontSize: 13,
    marginTop: 2,
  },
  noGoalsText: {
    color: colors.textMuted,
    fontSize: 12,
    marginTop: spacing.sm,
  },
  footer: {
    alignItems: 'center',
    marginTop: spacing.sm,
  },
});
