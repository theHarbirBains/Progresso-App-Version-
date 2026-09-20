import { StyleSheet } from 'react-native';
import { colors, radii, spacing, typeScale } from '../design/theme';

// Local to ChooseWorkoutSplitScreen only -- deliberately not merged into
// workoutSplitStyles.ts, which WorkoutSplitsScreen/WorkoutSplitFormScreen
// also depend on and are out of scope for this migration.
export const chooseWorkoutSplitStyles = StyleSheet.create({
  screen: {
    flex: 1,
    // Transparent -- AppBackgroundLayer (mounted once behind the navigator)
    // paints the selected Background Theme; screens no longer hardcode it.
    backgroundColor: 'transparent',
  },
  scrollContent: {
    paddingHorizontal: spacing.xxl,
    paddingBottom: spacing.xxxl,
  },
  topRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingTop: spacing.sm,
    paddingBottom: spacing.sm,
  },
  closeButton: {
    padding: spacing.xs,
  },
  settingsButton: {
    width: 40,
    height: 40,
    borderRadius: radii.pill,
    alignItems: 'center',
    justifyContent: 'center',
  },
  title: {
    ...typeScale.screenTitle,
    color: colors.textPrimary,
    marginBottom: spacing.sm,
  },
  subtitle: {
    color: colors.textSecondary,
    fontSize: 14,
    marginBottom: spacing.xxl,
  },
  errorText: {
    color: colors.destructive,
    fontSize: 14,
    marginBottom: spacing.lg,
  },
  presetList: {
    marginBottom: spacing.lg,
  },

  // Preset card
  presetCard: {
    marginBottom: spacing.lg,
  },
  cardTopRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.md,
    marginBottom: spacing.sm,
  },
  iconCircle: {
    width: 40,
    height: 40,
    borderRadius: radii.pill,
    backgroundColor: colors.surfaceRaised,
    borderWidth: 1,
    borderColor: colors.border,
    alignItems: 'center',
    justifyContent: 'center',
  },
  presetName: {
    ...typeScale.cardTitle,
    color: colors.textPrimary,
    flex: 1,
  },
  presetDescription: {
    ...typeScale.secondary,
    color: colors.textSecondary,
    marginBottom: spacing.md,
  },
  chipRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: spacing.sm,
  },

  // Create Custom Split -- a locally-styled primary button (rather than the
  // shared PrimaryButton, which hardcodes the static brand accent) so its
  // fill always tracks the user's dynamic Workout accent, per the design
  // system's contextual-accent rule.
  createSplitButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: spacing.sm,
    borderRadius: radii.md,
    paddingVertical: spacing.md + 2,
    marginTop: spacing.sm,
  },
  createSplitButtonText: {
    fontFamily: 'Manrope_700Bold',
    fontSize: 16,
  },
});
