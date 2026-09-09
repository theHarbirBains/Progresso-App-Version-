import { StyleSheet } from 'react-native';
import { colors, fonts, radii, spacing, typeScale } from '../design/theme';

export const accentColorPickerStyles = StyleSheet.create({
  screen: {
    flex: 1,
    backgroundColor: colors.background,
  },
  scrollContent: {
    paddingHorizontal: spacing.xxl,
    paddingBottom: spacing.xxxl,
  },
  headerRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.md,
    marginBottom: spacing.xs,
  },
  backButton: {
    width: 36,
    height: 36,
    borderRadius: radii.pill,
    backgroundColor: colors.surface,
    borderWidth: 1,
    borderColor: colors.border,
    alignItems: 'center',
    justifyContent: 'center',
  },
  title: {
    ...typeScale.screenTitle,
    color: colors.textPrimary,
  },
  subtitle: {
    color: colors.textSecondary,
    fontSize: 14,
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
    fontSize: 12,
    fontWeight: '700',
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
    fontSize: 14,
    fontWeight: '700',
  },
  previewCard: {
    flex: 1,
    backgroundColor: colors.surfaceRaised,
    borderRadius: radii.md,
    borderLeftWidth: 3,
    padding: spacing.md,
  },
  previewCardLabel: {
    color: colors.textSecondary,
    fontSize: 12,
    marginTop: spacing.sm,
  },

  previewProgressLabel: {
    color: colors.textSecondary,
    fontSize: 12,
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
    color: colors.textSecondary,
    fontSize: 10,
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
    fontSize: 12,
    fontWeight: '600',
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
    color: colors.textSecondary,
    fontSize: 11,
    marginTop: spacing.xs,
    textAlign: 'center',
  },

  // Custom color section.
  customColorCard: {
    marginTop: spacing.lg,
  },

  saveError: {
    color: colors.destructive,
    fontSize: 13,
    marginBottom: spacing.md,
  },
  saveButton: {
    borderRadius: radii.lg,
    paddingVertical: spacing.md + 2,
    alignItems: 'center',
    marginTop: spacing.md,
  },
  saveButtonText: {
    fontSize: 16,
    fontWeight: '700',
  },
  monoValue: {
    fontFamily: fonts.monoBold,
  },
});
