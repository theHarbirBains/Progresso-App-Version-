import { StyleSheet } from 'react-native';
import { colors, fonts, radii, spacing, typeScale } from '../design/theme';

export const accentColorPickerStyles = StyleSheet.create({
  screen: {
    flex: 1,
    // Transparent -- AppBackgroundLayer (mounted once behind the navigator)
    // paints the selected Background Theme; screens no longer hardcode it.
    backgroundColor: 'transparent',
  },
  scrollContent: {
    paddingBottom: spacing.xxxl,
  },
  subtitle: {
    ...typeScale.callout,
    color: colors.textSecondary,
    marginTop: 2,
    marginBottom: spacing.xl,
  },

  section: {
    marginBottom: spacing.xxl,
  },

  // Live preview card.
  previewTopRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: spacing.lg,
  },
  previewSegmentToggle: {
    flexDirection: 'row',
    backgroundColor: colors.surfaceRaised,
    borderRadius: radii.md,
    borderWidth: 1,
    borderColor: colors.border,
    padding: 3,
  },
  previewSegment: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    paddingVertical: 6,
    paddingHorizontal: spacing.md,
    borderRadius: radii.sm,
  },
  previewSegmentText: {
    ...typeScale.secondary,
    fontFamily: fonts.display,
    color: colors.textSecondary,
  },
  previewIconBox: {
    width: 32,
    height: 32,
    borderRadius: radii.sm,
    alignItems: 'center',
    justifyContent: 'center',
  },

  previewRow: {
    flexDirection: 'row',
    gap: spacing.md,
    marginBottom: spacing.md,
  },
  previewButton: {
    flex: 1,
    borderRadius: radii.lg,
    paddingVertical: spacing.md,
    alignItems: 'center',
  },
  previewButtonText: {
    ...typeScale.callout,
    fontFamily: fonts.display,
  },
  previewCard: {
    flex: 1,
    backgroundColor: colors.surfaceRaised,
    borderRadius: radii.md,
    borderLeftWidth: 3,
    padding: spacing.md,
  },
  previewCardLabel: {
    ...typeScale.secondary,
    color: colors.textSecondary,
    marginTop: spacing.sm,
  },

  previewProgressLabel: {
    ...typeScale.secondary,
    color: colors.textSecondary,
    marginBottom: spacing.xs,
  },
  previewProgressTrack: {
    height: 6,
    borderRadius: 3,
    backgroundColor: colors.surfaceRaised,
    overflow: 'hidden',
  },
  previewProgressFill: {
    height: '100%',
    borderRadius: 3,
  },

  previewRingBlock: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.md,
    marginBottom: spacing.md,
  },
  previewRingCenterLabel: {
    ...typeScale.caption,
    color: colors.textSecondary,
  },

  previewNavRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: spacing.xs,
    marginTop: spacing.sm,
    paddingTop: spacing.md,
    borderTopWidth: 1,
    borderTopColor: colors.border,
  },
  previewNavLabel: {
    ...typeScale.secondary,
    fontFamily: fonts.semibold,
  },

  // Preset palette.
  groupLabel: {
    ...typeScale.sectionHeading,
    color: colors.textMuted,
    marginBottom: spacing.md,
  },
  swatchGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: spacing.md,
  },
  swatchItem: {
    width: 68,
    alignItems: 'center',
  },
  swatchCircle: {
    width: 44,
    height: 44,
    borderRadius: radii.pill,
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 2,
    borderColor: 'transparent',
  },
  swatchCircleSelected: {
    borderColor: colors.textPrimary,
  },
  customSwatchCircle: {
    backgroundColor: colors.surfaceRaised,
    borderWidth: 1,
    borderStyle: 'dashed',
    borderColor: colors.border,
  },
  swatchName: {
    ...typeScale.caption,
    color: colors.textSecondary,
    marginTop: spacing.xs,
    textAlign: 'center',
  },

  // Custom color section.
  customColorCard: {
    marginTop: spacing.lg,
  },

  saveError: {
    ...typeScale.secondary,
    color: colors.destructive,
    marginBottom: spacing.md,
  },
  monoValue: {
    fontFamily: fonts.monoBold,
  },
});
