import { StyleSheet } from 'react-native';
import { colors, fonts, radii, spacing, typeScale, widgetGap } from '../design/theme';

// Dashboard-specific layout only -- everything reusable (cards, buttons,
// section headers, list rows, stat values, badges) comes from src/design/.
// This file holds the handful of things unique to this screen's composition,
// and every type size here is a `typeScale` token (no literal font sizes).
//
// Composition principle: Dashboard is the one screen with a photograph
// behind it, so its content needs glass surfaces to stay readable -- but not
// a surface per fact. Each mode is a few purposeful surfaces:
//   Workout   : Next Workout (hero) . Activity (this week + stats) . Recent Workout
//   Nutrition : Calories (hero) . Quick actions . Today's Meals . Weekly Calories
// Inside a surface, groups are separated by hairlines, never by nested cards.
export const dashboardStyles = StyleSheet.create({
  screen: {
    flex: 1,
    // Transparent -- AppBackgroundLayer (mounted once behind the navigator)
    // paints the selected Background Theme; screens no longer hardcode it.
    backgroundColor: 'transparent',
  },

  // Fixed header: the brand row + mode toggle, pinned above the scrolling
  // content. A glass `surface` tint (GlassBackground, rendered as this
  // View's first child in DashboardScreen.tsx) -- tint + hairline border,
  // deliberately no blur, so the photo behind it stays sharp while the
  // hamburger/wordmark/mode-toggle still read clearly against it.
  fixedHeader: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    paddingHorizontal: spacing.xxl,
    paddingBottom: spacing.sm,
    borderBottomWidth: 1,
    borderBottomColor: colors.glassBorder,
    overflow: 'hidden',
    zIndex: 10,
    elevation: 10,
  },

  // The ScrollView itself fills the screen; scrollContent's paddingTop
  // (set from the measured fixedHeader height in DashboardScreen) keeps real
  // content from ever landing underneath the header. There is no bottom
  // inset to reserve: the bottom navigation is an in-flow sibling of the
  // navigator (App.tsx), so this screen's area already ends above it.
  scrollArea: {
    flex: 1,
  },
  scrollAreaInner: {
    flex: 1,
  },
  scrollContent: {
    paddingHorizontal: spacing.xxl,
  },
  // The widget stack, shared by Workout and Nutrition mode. Every direct child
  // is a widget, and the gap between two of them is exactly `widgetGap` (6px)
  // -- never more. This deliberately does NOT stretch or distribute leftover
  // viewport height, and does NOT squeeze widgets to fit a fixed height (which
  // clips at larger Dynamic Type sizes). Widgets keep their natural size;
  // spare height is a trailing gap below the last widget, and a stack that
  // exceeds the viewport scrolls.
  widgetStack: {
    gap: widgetGap,
  },
  // Workout Home only (Nutrition keeps the natural-height stack above). The
  // stack is at least as tall as the scroll area, and the WIDGETS share any
  // spare height (see the `grow*` styles), so they run from the mode switcher
  // down to the bottom navigation with no empty band at either end. Spare
  // height is never handed to the gaps -- those stay exactly `widgetGap` -- and
  // when the widgets are taller than the screen there is no spare height and
  // the stack simply scrolls at natural size. The bottom padding is the same
  // `widgetGap` rhythm as between widgets; it needs no safe-area term because
  // the bottom navigation is an in-flow sibling that already owns the bottom
  // inset.
  workoutStackFill: {
    flexGrow: 1,
    paddingBottom: widgetGap,
  },
  // How spare height is shared, in proportion to each widget's natural height
  // (roughly 250 : 275 : 100) so proportions hold at any screen size. Only a
  // real Next Workout card grows; the one-line resume / "no upcoming workout"
  // rows stay compact.
  growHero: {
    flexGrow: 5,
  },
  growActivity: {
    flexGrow: 5,
  },
  growRecent: {
    flexGrow: 2,
  },

  topBar: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: spacing.md,
  },
  topBarLeft: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.md,
  },
  brandRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
  },
  logo: {
    width: 22,
    height: 22,
  },
  wordmark: {
    ...typeScale.label,
    fontFamily: fonts.display,
    color: colors.textSecondaryBright,
    letterSpacing: 2,
  },
  // Wraps the shared ModeToggle (see design/ModeToggle.tsx) -- the toggle
  // itself is a reusable component with no baked-in margin of its own
  // (other screens want different spacing around it).
  modeToggleWrap: {
    marginBottom: spacing.sm,
  },

  errorText: {
    ...typeScale.callout,
    color: colors.destructive,
    marginBottom: spacing.md,
  },
  // Tighter card padding for the Nutrition-mode cards, which hold dense
  // content (a ring + macros, a row of actions, a list).
  compactCard: {
    padding: spacing.sm,
  },
  cardTitle: {
    ...typeScale.cardTitle,
    color: colors.textPrimary,
  },

  // ---- Workout: Next Workout (the hero) ------------------------------------
  nextWorkoutHeaderRow: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    justifyContent: 'space-between',
  },
  nextWorkoutEyebrow: {
    ...typeScale.sectionHeading,
    color: colors.textSecondary,
    marginBottom: spacing.xs,
  },
  nextWorkoutDayName: {
    ...typeScale.screenTitle,
    color: colors.textPrimary,
  },
  nextWorkoutMeta: {
    ...typeScale.secondary,
    color: colors.textSecondaryBright,
    marginTop: 2,
  },
  // The card absorbs spare height by keeping its text block at the top and
  // anchoring the actions to the bottom (the usual hero-card pattern), rather
  // than stretching the gaps between individual lines. At natural height this
  // is identical to before.
  nextWorkoutCard: {
    flexGrow: 1,
    justifyContent: 'space-between',
  },
  // The primary action, then a quiet text action beneath it.
  nextWorkoutActions: {
    marginTop: spacing.lg,
    gap: spacing.xs,
  },

  // ---- Workout: Activity (this week + the four stats) ----------------------
  // One card holds the week strip and the stat grid: a set of facts that
  // belong together, rather than five separate cards. The week strip stays its
  // natural height; spare height goes to the stat grid below it (its two rows
  // grow, each block centring its content).
  activityCard: {
    flexGrow: 1,
    paddingVertical: spacing.md,
  },
  weeklyDaysRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
  },
  weeklyDay: {
    alignItems: 'center',
    gap: spacing.xs,
  },
  weeklyDayCircle: {
    width: 30,
    height: 30,
    borderRadius: radii.pill,
    borderWidth: 1,
    borderColor: colors.border,
    alignItems: 'center',
    justifyContent: 'center',
  },
  weeklyDayLabel: {
    ...typeScale.caption,
    color: colors.textSecondary,
  },
  // The 2x2 stat grid: four individual blocks separated by exactly `widgetGap`
  // (6px) -- between the two rows AND between the two blocks in a row -- so
  // each reads as its own block while the group stays one cohesive section.
  // The space between them is a real gap (no borders, dividers or margins).
  statGrid: {
    flexGrow: 1,
    gap: widgetGap,
    marginTop: spacing.md,
  },
  statRow: {
    flexDirection: 'row',
    flexGrow: 1,
    gap: widgetGap,
  },
  // A block: the raised surface token (a quiet step above the card), the
  // control radius, no border. Its radius sits inside the card's (`lg`) with
  // room to spare, so the two stay concentric.
  statCell: {
    flex: 1,
    minHeight: 76,
    justifyContent: 'center',
    paddingVertical: spacing.sm,
    paddingHorizontal: spacing.md,
    backgroundColor: colors.surfaceRaised,
    borderRadius: radii.md,
  },
  statValue: {
    ...typeScale.statMedium,
  },
  // A word or name (Last Workout's workout name) in the regular UI face.
  statValueText: {
    ...typeScale.cardTitle,
  },
  statTitle: {
    ...typeScale.callout,
    fontFamily: fonts.semibold,
    color: colors.textPrimary,
    marginTop: 2,
  },
  statSubtitle: {
    ...typeScale.caption,
    color: colors.textSecondary,
  },

  // ---- Workout: Recent Workout card ----------------------------------------
  // Built from the same eyebrow/title/meta tokens as the Next Workout card so
  // the two read as one family. `recentWorkoutTopSetRow` is a divider-topped
  // row (the same hairline the macro columns use) holding the top set and,
  // when the set is currently a record, its PR badge.
  // The card fills whatever height it is given and keeps its content centred,
  // so any spare height is even breathing room above and below.
  recentWorkoutCard: {
    flexGrow: 1,
    justifyContent: 'center',
    paddingVertical: spacing.sm,
  },
  recentWorkoutHeaderRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  recentWorkoutDate: {
    ...typeScale.secondary,
    color: colors.textSecondary,
  },
  recentWorkoutName: {
    ...typeScale.cardTitle,
    color: colors.textPrimary,
  },
  recentWorkoutMeta: {
    ...typeScale.secondary,
    color: colors.textSecondaryBright,
    marginTop: 2,
  },
  recentWorkoutTopSetRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: spacing.sm,
    marginTop: spacing.xs,
    paddingTop: spacing.xs,
    borderTopWidth: 1,
    borderTopColor: colors.divider,
  },
  recentWorkoutTopSetText: {
    ...typeScale.secondary,
    color: colors.textPrimary,
    flex: 1,
  },

  // ---- Nutrition: Calories (the hero) --------------------------------------
  // Hierarchy: a small label ("Calories"), then one big readout ("0 / 2,100")
  // -- the ring itself carries no text of its own (see CalorieRing), so this
  // is the single place the number lives.
  ringCardTop: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.md,
  },
  calorieNumbers: {
    flex: 1,
    gap: spacing.xs,
  },
  calorieHeaderRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.xs,
  },
  calorieLabel: {
    ...typeScale.secondary,
    color: colors.textSecondary,
  },
  // The card's primary number, clearly larger than the macro amounts below.
  calorieBigValue: {
    ...typeScale.statLarge,
    color: colors.textPrimary,
  },
  calorieBigGoal: {
    ...typeScale.statSmall,
    fontFamily: fonts.mono,
    color: colors.textSecondary,
  },
  // "1,850 kcal left" / "150 kcal over" under the big readout -- the goal
  // minus what's been logged. Color is supplied per render (theme.accent
  // while under goal, textSecondary once over).
  calorieRemaining: {
    ...typeScale.secondary,
    color: colors.textSecondary,
  },
  noGoalsText: {
    ...typeScale.secondary,
    color: colors.textSecondary,
    marginTop: spacing.sm,
  },
  // A clean break between the ring/calorie row and the macro row below it.
  heroDivider: {
    borderTopWidth: 1,
    borderTopColor: colors.divider,
    marginTop: spacing.xs,
    paddingTop: spacing.xs,
  },
  // Three equal columns separated by the hairline `divider` token.
  macroRow: {
    flexDirection: 'row',
    marginTop: spacing.sm,
  },
  macroCard: {
    flex: 1,
    paddingHorizontal: spacing.sm,
  },
  macroCardDivider: {
    borderRightWidth: 1,
    borderRightColor: colors.divider,
  },
  macroLabelRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.xs,
    marginBottom: spacing.xs,
  },
  macroName: {
    ...typeScale.secondary,
    fontFamily: fonts.semibold,
    color: colors.textSecondary,
  },
  macroAmount: {
    ...typeScale.statSmall,
    color: colors.textPrimary,
    marginBottom: spacing.xs,
  },
  macroBarTrack: {
    height: 5,
    borderRadius: 3,
    backgroundColor: colors.surfaceRaised,
    overflow: 'hidden',
  },
  // backgroundColor is supplied per-render by the active mode theme (see
  // MacroCard in DashboardScreen.tsx), not set here.
  macroBarFill: {
    height: '100%',
    borderRadius: 3,
  },

  // ---- Nutrition: Quick actions --------------------------------------------
  // One card, three equal actions separated by hairlines -- not three cards.
  quickActionsRow: {
    flexDirection: 'row',
    alignItems: 'stretch',
  },
  quickAction: {
    flex: 1,
    minHeight: 72,
    alignItems: 'center',
    justifyContent: 'center',
    gap: spacing.xs,
    paddingVertical: spacing.sm,
  },
  quickActionDivider: {
    width: StyleSheet.hairlineWidth,
    alignSelf: 'stretch',
    backgroundColor: colors.divider,
    marginVertical: spacing.xs,
  },
  quickActionTitle: {
    ...typeScale.callout,
    fontFamily: fonts.semibold,
    color: colors.textPrimary,
    textAlign: 'center',
  },

  // ---- Nutrition: Today's Meals --------------------------------------------
  // The whole header row is the tap target for the full list (title + chevron),
  // like a ListRow. The meals themselves are ListRows.
  mealsHeaderRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
    minHeight: 44,
  },
  mealsHeaderTitle: {
    ...typeScale.cardTitle,
    color: colors.textPrimary,
    flex: 1,
  },
  mealsEmptyText: {
    ...typeScale.secondary,
    color: colors.textSecondary,
    paddingBottom: spacing.xs,
  },

  // ---- Nutrition: Weekly Calories ------------------------------------------
  goalsHeaderRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  // A deliberate gap below the card's own title.
  weeklyCaloriesContentFill: {
    marginTop: spacing.sm,
  },
  // The daily target x7, with a progress bar toward it (see
  // computeWeeklyCalorieSummary). The biggest, boldest number on the card.
  weeklyCaloriesValue: {
    ...typeScale.statLarge,
    color: colors.textPrimary,
  },
  weeklyCaloriesUnit: {
    ...typeScale.caption,
    color: colors.textSecondary,
  },
  weeklyCaloriesBarTrack: {
    height: 10,
    borderRadius: radii.pill,
    backgroundColor: colors.surfaceRaised,
    overflow: 'hidden',
    marginTop: spacing.xs,
  },
  weeklyCaloriesBarFill: {
    height: '100%',
    borderRadius: radii.pill,
  },
  // Just the two real numbers (Consumed / Remaining, both from
  // computeWeeklyCalorieSummary) -- deliberately no explanatory sentence.
  weeklyCaloriesStatsRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.lg,
    marginTop: spacing.sm,
  },
  weeklyCaloriesStatBlock: {
    flex: 1,
    alignItems: 'flex-start',
  },
  weeklyCaloriesStatDivider: {
    width: StyleSheet.hairlineWidth,
    alignSelf: 'stretch',
    backgroundColor: colors.divider,
  },
  weeklyCaloriesStatLabel: {
    ...typeScale.secondary,
    color: colors.textSecondary,
    marginBottom: spacing.xs,
  },
  weeklyCaloriesStatValue: {
    ...typeScale.statMedium,
    color: colors.textPrimary,
  },
});
