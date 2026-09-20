import { StyleSheet } from 'react-native';
import { colors, radii, spacing, typeScale } from '../design/theme';

// Local to FoodSearchScreen.tsx (default food database search + a minimal
// selection/detail view) -- mirrors startWorkoutStyles.ts's
// screen/scrollContent shape for a header + scrollable-body screen.
export const foodSearchStyles = StyleSheet.create({
  screen: {
    flex: 1,
    // Transparent -- AppBackgroundLayer (mounted once behind the navigator)
    // paints the selected Background Theme; screens no longer hardcode it.
    backgroundColor: 'transparent',
  },
  searchRow: {
    paddingHorizontal: spacing.xxl,
    marginBottom: spacing.lg,
  },
  scrollContent: {
    paddingHorizontal: spacing.xxl,
    paddingBottom: spacing.xxxl,
  },

  resultCard: {
    marginBottom: spacing.sm,
  },
  resultRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.md,
  },
  resultIconWrap: {
    width: 36,
    height: 36,
    borderRadius: radii.md,
    backgroundColor: colors.surfaceRaised,
    alignItems: 'center',
    justifyContent: 'center',
  },
  resultBody: {
    flex: 1,
  },
  resultName: {
    ...typeScale.cardTitle,
    color: colors.textPrimary,
  },
  resultMeta: {
    ...typeScale.secondary,
    color: colors.textSecondary,
    marginTop: 2,
  },
  resultCalories: {
    ...typeScale.secondary,
    color: colors.textSecondary,
  },

  // Selected-food detail view
  detailServing: {
    ...typeScale.body,
    color: colors.textSecondary,
    marginBottom: spacing.lg,
  },
  detailCalorieRow: {
    alignItems: 'flex-start',
    marginBottom: spacing.xl,
  },
  detailMacroRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
  },
  detailMacroItem: {
    alignItems: 'flex-start',
  },
  detailMacroLabel: {
    ...typeScale.label,
    color: colors.textSecondary,
    marginBottom: spacing.xs,
  },
  detailAttribution: {
    ...typeScale.caption,
    color: colors.textMuted,
    marginTop: spacing.xl,
    textAlign: 'center',
  },
  logButtonWrap: {
    marginTop: spacing.xl,
  },
});
