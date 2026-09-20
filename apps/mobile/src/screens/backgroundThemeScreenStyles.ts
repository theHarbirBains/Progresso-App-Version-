import { StyleSheet } from 'react-native';
import { colors, radii, spacing, typeScale } from '../design/theme';

export const backgroundThemeScreenStyles = StyleSheet.create({
  screen: {
    flex: 1,
    backgroundColor: 'transparent',
  },
  scrollContent: {
    paddingHorizontal: spacing.xxl,
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
    fontSize: 20,
    color: colors.textPrimary,
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
    fontSize: 14,
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
    color: colors.destructive,
    fontSize: 14,
    marginBottom: spacing.md,
  },
  saveButtonWrap: {
    marginBottom: spacing.xxl,
  },
});
