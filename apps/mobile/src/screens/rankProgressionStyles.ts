import { StyleSheet } from 'react-native';
import { colors, radii, spacing, typeScale, widgetGap } from '../design/theme';

// RankProgressionScreen. Token-only: a card per rank -- emblem, name in its colour, AP range --
// with its five divisions side by side, outlined in the rank's colour once reached.
export const rankProgressionStyles = StyleSheet.create({
  content: {
    gap: widgetGap,
    paddingBottom: spacing.xxl,
  },
  intro: {
    ...typeScale.body,
    color: colors.textSecondaryBright,
    paddingHorizontal: spacing.lg,
    marginBottom: spacing.sm,
  },
  tierHead: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.md,
  },
  tierText: {
    flex: 1,
    gap: 2,
  },
  tierName: {
    ...typeScale.cardTitle,
  },
  tierRange: {
    ...typeScale.caption,
    color: colors.textSecondary,
  },
  here: {
    ...typeScale.label,
    letterSpacing: 1,
    textTransform: 'uppercase',
  },
  divisions: {
    flexDirection: 'row',
    gap: spacing.xs,
    marginTop: spacing.md,
  },
  division: {
    flex: 1,
    alignItems: 'center',
    borderWidth: 1,
    borderRadius: radii.md,
    paddingVertical: spacing.sm,
    gap: 2,
  },
  divisionName: {
    ...typeScale.label,
  },
  divisionFloor: {
    ...typeScale.caption,
    color: colors.textMuted,
  },
  legacyNote: {
    ...typeScale.caption,
    color: colors.textMuted,
    marginTop: spacing.sm,
  },
});
