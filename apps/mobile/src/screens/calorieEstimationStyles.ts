import { StyleSheet } from 'react-native';
import { colors, fonts, radii, spacing, typeScale } from '../design/theme';

// Local to CalorieEstimationScreen.tsx -- one compact glass card per field
// (icon + label + inline control, no supporting caption text), matching
// startWorkoutStyles.ts's screen/scrollContent shape for a header +
// scrollable-form screen. Height/Weight/Activity Level show a compact
// summary here and expand into a BottomSheet for the actual picker -- see
// the screen's own comment on why.
export const calorieEstimationStyles = StyleSheet.create({
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
  intro: {
    ...typeScale.body,
    color: colors.textSecondary,
    marginBottom: spacing.xl,
  },

  fieldCard: {
    marginBottom: spacing.md,
  },
  fieldRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.md,
  },
  fieldIconWrap: {
    width: 36,
    height: 36,
    borderRadius: radii.md,
    backgroundColor: colors.surfaceRaised,
    alignItems: 'center',
    justifyContent: 'center',
  },
  fieldRowBody: {
    flex: 1,
  },
  fieldRowLabel: {
    ...typeScale.cardTitle,
    color: colors.textPrimary,
  },
  fieldRowControl: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
  },
  fieldError: {
    ...typeScale.caption,
    color: colors.destructive,
    marginTop: spacing.sm,
  },

  // Height/Weight's collapsed value box -- tapping it opens the BottomSheet
  // with the full wheel picker; the unit toggle beside it (a plain
  // SegmentedControl) works immediately, without opening anything.
  compactValueButton: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    borderWidth: 1,
    borderColor: colors.glassBorder,
    borderRadius: radii.md,
    paddingHorizontal: spacing.sm,
    paddingVertical: spacing.xs,
  },
  compactValueText: {
    fontFamily: fonts.monoBold,
    color: colors.textPrimary,
    fontSize: 15,
  },

  // Activity Level's collapsed summary sub-row, nested under the card's own
  // icon/label header -- tapping it opens the BottomSheet listing all 5
  // tiers (each with its own description -- only the summary row stays to a
  // single line).
  activitySummaryRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.md,
    marginTop: spacing.md,
    paddingTop: spacing.md,
    borderTopWidth: 1,
    borderTopColor: colors.divider,
  },
  activitySummaryIconWrap: {
    width: 36,
    height: 36,
    borderRadius: radii.md,
    backgroundColor: colors.surfaceRaised,
    alignItems: 'center',
    justifyContent: 'center',
  },
  activitySummaryBody: {
    flex: 1,
  },
  activitySummaryLabel: {
    ...typeScale.cardTitle,
    color: colors.textPrimary,
  },

  sheetTitle: {
    ...typeScale.screenTitle,
    color: colors.textPrimary,
    marginBottom: spacing.lg,
  },
  sheetDoneButton: {
    marginTop: spacing.lg,
  },
  sheetList: {
    maxHeight: 420,
  },

  sectionSpacer: {
    height: spacing.xl,
  },
  footnote: {
    ...typeScale.caption,
    color: colors.textMuted,
    marginTop: spacing.lg,
    textAlign: 'center',
  },
});
