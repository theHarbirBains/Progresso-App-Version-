import { StyleSheet } from 'react-native';
import { colors, radii, spacing, typeScale, widgetGap } from '../design/theme';

// BarcodeScannerScreen. Token-only. The live-camera state is the one screen in
// the app that is genuinely full-bleed (the camera itself, not a Background
// Theme): the header is layered over it as an absolute overlay rather than
// pushing the preview down. Every other state is the shared `Screen`.
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
  // The hint sits on a solid pill so it stays legible over any live image,
  // instead of a text shadow.
  hintPill: {
    backgroundColor: colors.surface,
    borderRadius: radii.pill,
    paddingHorizontal: spacing.lg,
    paddingVertical: spacing.sm,
  },
  frameHint: {
    ...typeScale.callout,
    color: colors.textPrimary,
    textAlign: 'center',
  },

  // Permission / not-found / error states: content centred in the space under
  // the header, with the actions beneath it.
  centered: {
    justifyContent: 'center',
    gap: widgetGap,
  },
  // The code that had no match, in the mono face, so it can be checked
  // against the packaging.
  scannedCode: {
    ...typeScale.statSmall,
    color: colors.textSecondary,
    textAlign: 'center',
    marginTop: spacing.xs,
  },
  manualHint: {
    ...typeScale.secondary,
    color: colors.textMuted,
    textAlign: 'center',
    marginTop: spacing.md,
  },
  actions: {
    gap: spacing.md,
  },

  foundButtonWrap: {
    marginTop: spacing.xxl,
  },
});
