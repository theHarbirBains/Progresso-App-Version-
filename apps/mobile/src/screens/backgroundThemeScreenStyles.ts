import { StyleSheet } from 'react-native';
import { colors, radii, spacing, typeScale } from '../design/theme';

export const backgroundThemeScreenStyles = StyleSheet.create({
  screen: {
    flex: 1,
    backgroundColor: 'transparent',
  },
  scrollContent: {
    paddingBottom: spacing.xxl,
  },
  subtitle: {
    ...typeScale.secondary,
    color: colors.textSecondary,
    marginTop: spacing.xs,
    marginBottom: spacing.xl,
  },
  grid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: spacing.md,
    marginBottom: spacing.xxl,
  },
  tile: {
    width: '47%',
    borderRadius: radii.lg,
    borderWidth: 1.5,
    borderColor: colors.border,
    overflow: 'hidden',
    backgroundColor: colors.surface,
  },
  swatch: {
    height: 72,
    overflow: 'hidden',
  },
  tileBody: {
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.sm,
  },
  tileName: {
    ...typeScale.label,
    color: colors.textPrimary,
  },
  tileDescription: {
    ...typeScale.caption,
    color: colors.textMuted,
    marginTop: 2,
  },
  checkBadge: {
    position: 'absolute',
    top: spacing.sm,
    right: spacing.sm,
    width: 22,
    height: 22,
    borderRadius: radii.pill,
    alignItems: 'center',
    justifyContent: 'center',
  },
  saveError: {
    ...typeScale.callout,
    color: colors.destructive,
    marginBottom: spacing.md,
  },
  saveButtonWrap: {
    marginBottom: spacing.xxl,
  },
});
