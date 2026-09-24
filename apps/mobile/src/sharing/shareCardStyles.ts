import { StyleSheet } from 'react-native';
import { colors, radii, spacing, typeScale } from '../design/theme';

// The shareable workout image (ShareCard) and the screen around it. Token-only.
//
// The card is deliberately minimal and clinical: near-black, Manrope, mono
// numerals, hairlines, one accent colour (the user's Workout accent, supplied
// per render) used only for personal records. It is a PNG that leaves the app,
// so it always paints the static Progresso palette rather than a Background
// Theme.
export const shareCardStyles = StyleSheet.create({
  // ---- The screen ----------------------------------------------------------
  content: {
    gap: spacing.xxl,
    paddingBottom: spacing.xxl,
  },
  errorText: {
    ...typeScale.callout,
    color: colors.destructive,
    textAlign: 'center',
  },
  loading: {
    paddingVertical: spacing.xxl,
  },
  previewWrap: {
    alignItems: 'center',
  },
  formatWrap: {
    alignItems: 'center',
  },
  privacyNote: {
    ...typeScale.caption,
    color: colors.textMuted,
    marginTop: spacing.sm,
  },
  actions: {
    gap: spacing.md,
  },
  savedText: {
    ...typeScale.callout,
    color: colors.textSecondary,
    textAlign: 'center',
  },
  actionError: {
    ...typeScale.callout,
    color: colors.destructive,
    textAlign: 'center',
  },

  // ---- The card ------------------------------------------------------------
  card: {
    width: 320,
    backgroundColor: colors.background,
    borderRadius: radii.lg,
    borderWidth: 1,
    borderColor: colors.border,
    overflow: 'hidden',
  },
  // Dims a user's own photo so the type stays legible whatever it is.
  photo: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
  },
  scrim: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
  },
  body: {
    flex: 1,
    padding: spacing.xl,
    justifyContent: 'space-between',
    gap: spacing.lg,
  },

  // The shorter feed card packs the same blocks a little tighter.
  bodyCompact: {
    padding: spacing.lg,
    gap: spacing.md,
  },
  blocks: {
    gap: spacing.lg,
  },
  blocksCompact: {
    gap: spacing.md,
  },

  topRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  wordmark: {
    ...typeScale.caption,
    color: colors.textSecondary,
    letterSpacing: 3,
  },
  date: {
    ...typeScale.caption,
    color: colors.textSecondary,
  },
  workoutName: {
    ...typeScale.screenTitle,
    color: colors.textPrimary,
    marginTop: spacing.md,
  },
  muscles: {
    ...typeScale.secondary,
    color: colors.textSecondary,
    marginTop: spacing.xs,
  },

  section: {
    gap: spacing.sm,
    paddingTop: spacing.md,
    borderTopWidth: StyleSheet.hairlineWidth,
    borderTopColor: colors.border,
  },
  sectionLabel: {
    ...typeScale.caption,
    letterSpacing: 2,
    color: colors.textMuted,
  },
  // Personal records: the one place the accent appears.
  recordName: {
    ...typeScale.callout,
    fontFamily: typeScale.cardTitle.fontFamily,
    color: colors.textPrimary,
  },
  recordLabel: {
    ...typeScale.secondary,
    color: colors.textSecondary,
  },
  recordValue: {
    ...typeScale.statLarge,
  },
  recordValueCompact: {
    ...typeScale.statMedium,
  },

  row: {
    flexDirection: 'row',
    alignItems: 'baseline',
    justifyContent: 'space-between',
    gap: spacing.md,
  },
  rowLabel: {
    ...typeScale.callout,
    color: colors.textSecondary,
    flexShrink: 1,
  },
  rowValue: {
    ...typeScale.statMedium,
    color: colors.textPrimary,
  },
  rowValueCompact: {
    ...typeScale.statSmall,
  },
  liftName: {
    ...typeScale.callout,
    color: colors.textPrimary,
    flexShrink: 1,
  },
  liftValue: {
    ...typeScale.statSmall,
    color: colors.textPrimary,
  },
});
