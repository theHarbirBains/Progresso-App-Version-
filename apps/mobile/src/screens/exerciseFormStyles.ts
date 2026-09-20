import { StyleSheet } from 'react-native';
import { colors, radii, spacing, typeScale } from '../design/theme';

// The 'screen' presentation of ExerciseFormScreen only (New Exercise / Edit
// Exercise, reached from ExerciseLibraryScreen) -- theme-token-driven dark
// glass, matching the rest of Workout Mode. Deliberately not the legacy
// exerciseStyles.ts, which the 'sheet' presentation (Create Custom Exercise
// from an active workout) still relies on unchanged.
export const exerciseFormStyles = StyleSheet.create({
  screen: {
    flex: 1,
    // Transparent -- AppBackgroundLayer (mounted once behind the navigator)
    // paints the selected Workout background; this screen never hardcodes
    // its own, same convention as exerciseLibraryStyles.screen.
    backgroundColor: 'transparent',
  },
  scrollContent: {
    paddingHorizontal: spacing.xxl,
    paddingTop: spacing.md,
  },

  // Header: no back arrow, "Cancel" pinned to the right, title centered
  // relative to the FULL header width (not the space remaining after
  // Cancel) via absolute positioning rather than a flex three-column split,
  // since Cancel and the empty left side are different widths.
  header: {
    position: 'relative',
    minHeight: 32,
    justifyContent: 'center',
    marginBottom: spacing.lg,
  },
  headerTitle: {
    ...typeScale.screenTitle,
    color: colors.textPrimary,
    textAlign: 'center',
  },
  headerSubtitle: {
    ...typeScale.body,
    color: colors.textSecondary,
    textAlign: 'center',
    marginTop: spacing.xs,
  },
  headerCancel: {
    position: 'absolute',
    right: 0,
    top: 0,
    bottom: 0,
    justifyContent: 'center',
  },
  headerCancelText: {
    ...typeScale.body,
    color: colors.textSecondary,
    fontWeight: '600',
  },

  label: {
    ...typeScale.label,
    color: colors.textSecondary,
    marginBottom: spacing.sm,
    marginTop: spacing.lg,
  },
  helperText: {
    ...typeScale.caption,
    color: colors.textMuted,
    marginTop: spacing.xs,
  },
  input: {
    backgroundColor: colors.surface,
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: radii.md,
    color: colors.textPrimary,
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.md,
    ...typeScale.body,
  },

  sectionDivider: {
    borderTopWidth: 1,
    borderTopColor: colors.divider,
    marginTop: spacing.xxl,
    paddingTop: spacing.md,
  },
  sectionTitle: {
    ...typeScale.cardTitle,
    color: colors.textPrimary,
  },
  sectionSubtitle: {
    ...typeScale.secondary,
    color: colors.textSecondary,
    marginTop: spacing.xs,
    marginBottom: spacing.md,
  },

  // "Add Machine Photo" CTA -- a dashed-look dark glass card, replaced by a
  // small preview + remove control once a photo is picked.
  photoButton: {
    borderRadius: radii.md,
    borderWidth: 1,
    borderColor: colors.border,
    borderStyle: 'dashed',
    paddingVertical: spacing.xl,
    alignItems: 'center',
    gap: spacing.xs,
  },
  photoButtonTitle: {
    ...typeScale.body,
    color: colors.textPrimary,
    fontWeight: '600',
  },
  photoButtonSubtitle: {
    ...typeScale.caption,
    color: colors.textMuted,
  },
  photoPreviewRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.md,
  },
  photoPreviewImage: {
    width: 64,
    height: 64,
    borderRadius: radii.md,
  },
  photoPreviewRemove: {
    ...typeScale.secondary,
    color: colors.destructive,
    fontWeight: '600',
  },
  photoError: {
    ...typeScale.caption,
    color: colors.destructive,
    marginTop: spacing.sm,
  },

  // "Why add a machine photo?" info card + the cable/pulley Pro Tip callout.
  infoCard: {
    marginTop: spacing.md,
  },
  infoCardHeaderRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
    marginBottom: spacing.xs,
  },
  infoCardTitle: {
    ...typeScale.secondary,
    color: colors.textPrimary,
    fontWeight: '700',
  },
  infoCardBody: {
    ...typeScale.secondary,
    color: colors.textSecondary,
    lineHeight: 18,
  },
  proTipCard: {
    marginTop: spacing.sm,
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: spacing.sm,
    paddingVertical: spacing.sm,
    paddingHorizontal: spacing.md,
  },
  proTipText: {
    ...typeScale.caption,
    color: colors.textSecondary,
    flex: 1,
    lineHeight: 16,
  },
  proTipBold: {
    color: colors.textPrimary,
    fontWeight: '700',
  },

  error: {
    ...typeScale.secondary,
    color: colors.destructive,
    marginTop: spacing.lg,
  },
  button: {
    borderRadius: radii.lg,
    paddingVertical: spacing.md + 2,
    alignItems: 'center',
    marginTop: spacing.xxl,
  },
  buttonDisabled: {
    opacity: 0.5,
  },
  buttonText: {
    fontSize: 16,
    fontWeight: '700',
  },
  deactivateButton: {
    borderRadius: radii.lg,
    borderWidth: 1,
    borderColor: colors.destructiveBorder,
    paddingVertical: spacing.md,
    alignItems: 'center',
    marginTop: spacing.md,
  },
  deactivateButtonText: {
    color: colors.destructive,
    fontSize: 15,
    fontWeight: '600',
  },
  reactivateButton: {
    borderRadius: radii.lg,
    borderWidth: 1,
    borderColor: colors.border,
    paddingVertical: spacing.md,
    alignItems: 'center',
    marginTop: spacing.md,
  },
  reactivateButtonText: {
    color: colors.textPrimary,
    fontSize: 15,
    fontWeight: '600',
  },
});
