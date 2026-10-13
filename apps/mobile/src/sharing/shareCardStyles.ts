import { StyleSheet } from 'react-native';
import { colors, fonts, radii, spacing, typeScale } from '../design/theme';

// The shareable workout image (ShareCard) and the screen around it. Token-only.
//
// The card is a PNG that leaves the app, so it paints everything itself --
// the warm gym photo at its top and the warm surface below -- rather than
// relying on the screen's background behind it. One accent (amber) marks
// personal records and nothing else.
export const shareCardStyles = StyleSheet.create({
  // ---- The screen ----------------------------------------------------------
  content: {
    flex: 1,
    gap: spacing.lg,
    paddingBottom: spacing.lg,
  },
  // Takes whatever height is left above the button; the card is scaled to fit it.
  stage: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
  },
  errorText: {
    ...typeScale.callout,
    color: colors.destructive,
    textAlign: 'center',
  },
  loading: {
    paddingVertical: spacing.xxl,
  },
  actions: {
    gap: spacing.md,
  },
  actionError: {
    ...typeScale.callout,
    color: colors.destructive,
    textAlign: 'center',
  },

  // ---- The card ------------------------------------------------------------
  card: {
    backgroundColor: colors.surface,
    borderRadius: radii.xl,
    borderWidth: 1,
    borderColor: colors.glassBorderStrong,
    overflow: 'hidden',
  },
  fill: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
  },

  // The photo block: brand mark and date along the top, the workout at its foot.
  hero: {
    flex: 1,
    justifyContent: 'space-between',
    padding: spacing.xl,
  },
  heroTop: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: spacing.md,
  },
  wordmark: {
    ...typeScale.caption,
    color: colors.textSecondaryBright,
    letterSpacing: 4,
  },
  date: {
    ...typeScale.caption,
    color: colors.textSecondaryBright,
  },
  workoutName: {
    ...typeScale.display,
    color: colors.textPrimary,
  },
  muscles: {
    ...typeScale.callout,
    color: colors.textSecondaryBright,
    marginTop: spacing.xs,
  },

  // Four stats in a row, hairlines between them.
  stats: {
    flexDirection: 'row',
    paddingVertical: spacing.md,
    paddingHorizontal: spacing.sm,
    borderTopWidth: StyleSheet.hairlineWidth,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderColor: colors.border,
  },
  stat: {
    flex: 1,
    gap: spacing.xs,
    paddingHorizontal: spacing.sm,
  },
  statDivided: {
    borderLeftWidth: StyleSheet.hairlineWidth,
    borderLeftColor: colors.border,
  },
  statValue: {
    ...typeScale.statMedium,
    color: colors.textPrimary,
    marginTop: 2,
  },
  statLabel: {
    ...typeScale.caption,
    color: colors.textSecondary,
  },

  body: {
    paddingHorizontal: spacing.lg,
    paddingTop: spacing.md,
    paddingBottom: spacing.lg,
    gap: spacing.md,
  },
  section: {
    gap: 6,
  },
  sectionHeader: {
    flexDirection: 'row',
    alignItems: 'baseline',
    justifyContent: 'space-between',
  },
  sectionLabel: {
    ...typeScale.caption,
    letterSpacing: 2,
    color: colors.textSecondary,
    marginBottom: 2,
  },
  prCount: {
    ...typeScale.callout,
    fontFamily: fonts.display,
  },

  // A quiet raised row: a lift over the card's fill, no border.
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.md,
    paddingHorizontal: spacing.md,
    backgroundColor: colors.surfaceLift,
    borderRadius: radii.md,
  },
  rowText: {
    flex: 1,
  },
  thumb: {
    alignItems: 'center',
    justifyContent: 'center',
    overflow: 'hidden',
    backgroundColor: colors.surfaceRaised,
  },
  thumbInitial: {
    fontFamily: fonts.display,
    color: colors.textSecondary,
  },

  // Personal records: the one place the accent appears.
  recordRow: {
    height: 52,
  },
  recordName: {
    ...typeScale.callout,
    fontFamily: fonts.semibold,
    color: colors.textPrimary,
  },
  recordLabel: {
    ...typeScale.secondary,
    color: colors.textSecondary,
  },
  recordValue: {
    ...typeScale.statSmall,
  },

  liftRow: {
    height: 42,
    gap: spacing.sm,
  },
  rank: {
    width: 22,
    height: 22,
    borderRadius: 11,
    borderWidth: 1,
    borderColor: colors.textMuted,
    alignItems: 'center',
    justifyContent: 'center',
  },
  rankText: {
    ...typeScale.caption,
    color: colors.textSecondary,
  },
  liftName: {
    ...typeScale.callout,
    color: colors.textPrimary,
    flex: 1,
  },
  liftValue: {
    fontFamily: fonts.mono,
    fontSize: typeScale.callout.fontSize,
    color: colors.textPrimary,
  },
});
