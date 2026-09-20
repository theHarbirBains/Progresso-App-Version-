import { StyleSheet } from 'react-native';
import { colors, fonts, radii, spacing, typeScale } from '../design/theme';

// Local to BarcodeScannerScreen.tsx. The live-camera state is the one
// screen in the app that's genuinely full-bleed (the camera itself, not a
// Background Theme) -- AppHeader is layered on top as an absolute overlay
// (same "fixed chrome over live content" shape Dashboard's own header
// uses) rather than pushing the camera down, so the preview fills the
// whole screen right up to the header's own glass.
export const barcodeScannerStyles = StyleSheet.create({
  screen: {
    flex: 1,
    backgroundColor: colors.background,
  },
  camera: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
  },
  overlay: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
  },
  frameWrap: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    gap: spacing.xl,
  },
  frame: {
    width: 240,
    height: 150,
    borderRadius: radii.lg,
    borderWidth: 3,
  },
  frameHint: {
    ...typeScale.body,
    color: colors.textPrimary,
    textAlign: 'center',
    textShadowColor: 'rgba(0, 0, 0, 0.65)',
    textShadowOffset: { width: 0, height: 1 },
    textShadowRadius: 4,
  },

  permissionContent: {
    flex: 1,
    justifyContent: 'center',
    paddingHorizontal: spacing.xxl,
    gap: spacing.xl,
  },
  permissionActions: {
    gap: spacing.md,
  },

  foundContent: {
    paddingHorizontal: spacing.xxl,
    paddingTop: spacing.lg,
  },
  foundServing: {
    ...typeScale.body,
    color: colors.textSecondary,
    marginBottom: spacing.lg,
  },
  foundCalories: {
    fontFamily: fonts.monoBold,
    color: colors.textPrimary,
    fontSize: 30,
    marginBottom: spacing.xl,
  },
  foundMacroRow: {
    flexDirection: 'row',
    gap: spacing.xl,
    marginBottom: spacing.lg,
  },
  foundMacro: {
    ...typeScale.secondary,
    color: colors.textSecondary,
  },
  foundAttribution: {
    ...typeScale.caption,
    color: colors.textMuted,
    marginBottom: spacing.xl,
  },
  foundButtonWrap: {
    marginTop: spacing.md,
  },

  fallbackContent: {
    flex: 1,
    justifyContent: 'center',
    paddingHorizontal: spacing.xxl,
    gap: spacing.lg,
  },
  fallbackSubtitle: {
    ...typeScale.body,
    color: colors.textSecondary,
    textAlign: 'center',
    marginTop: -spacing.md,
  },
  fallbackActions: {
    gap: spacing.md,
  },
});
