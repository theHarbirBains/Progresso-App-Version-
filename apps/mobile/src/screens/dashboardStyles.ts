import { StyleSheet } from 'react-native';
import { colors, fonts, radii, spacing, typeScale } from '../design/theme';

// Dashboard-specific layout only -- everything reusable (cards, buttons,
// section headers, stat values, badges) comes from src/design/. This file
// exists for the handful of things unique to this screen's composition.
// Visual-restructure pass: reference-image-inspired Workout/Nutrition
// segmented layout, still on the existing "Dark + Electric" tokens below --
// no new palette introduced.
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
  // deliberately no blur (no BlurView, unlike `chrome`), so the forest
  // background never gets softened, just given enough contrast for the
  // hamburger/wordmark/bell/mode-toggle to read clearly against it. See the
  // Workout Mode readability refinement's own reasoning: the earlier
  // "no fill at all" version traded too much legibility for background
  // visibility.
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

  // The ScrollView itself fills the screen; scrollContent's paddingTop/
  // paddingBottom (set from measured fixedHeader/bottomBar heights in
  // DashboardScreen) keep real content from ever landing underneath them.
  // Split into an outer (`scrollArea`, on the Animated.View wrapper that
  // carries Workout mode's "swipe up to reveal the background" transform)
  // and inner (`scrollAreaInner`, on the ScrollView itself) layer so the
  // transform has its own view to animate without fighting the
  // ScrollView's own layout.
  scrollArea: {
    flex: 1,
  },
  scrollAreaInner: {
    flex: 1,
  },
  scrollContent: {
    paddingHorizontal: spacing.xxl,
  },
  // Workout mode only -- see DashboardScreen.tsx's contentContainerStyle
  // comment. Lets the greeting + three widgets fill whatever vertical
  // space the device actually has (responsive, not a fixed-height guess),
  // rather than leaving a large empty gap below This Week.
  workoutModeFillContent: {
    flexGrow: 1,
    justifyContent: 'space-between',
  },
  // Nutrition mode has no ScrollView at all (see DashboardScreen.tsx) --
  // this is the plain, non-scrolling View that fills the fixed space
  // between the header/footer overlays directly, so scrolling is
  // structurally impossible rather than merely undesired. It's the Weekly
  // Calories card specifically that absorbs any leftover space (see
  // weeklyCaloriesSectionFill/weeklyCaloriesCardFill below), not evenly
  // distributed gaps between every widget -- the other Nutrition cards
  // keep their natural, compact height.
  nutritionScreenArea: {
    flex: 1,
    paddingHorizontal: spacing.xxl,
  },
  // Compact variants of greetingRow/greetingBlock, used only in Nutrition
  // mode's non-scrolling layout -- kept separate from the shared
  // greetingRow/greetingBlock (still used by Workout mode's ScrollView)
  // rather than trimming those, since Workout mode's own layout must stay
  // untouched.
  // flexShrink/minHeight: last-resort compression safety net (see
  // nutritionQuickActionsSectionShrink's comment) -- the greeting is the
  // least critical thing on this screen, so it's allowed to give first and
  // most; minHeight only guarantees the name line itself stays readable.
  nutritionGreetingRow: {
    alignItems: 'center',
    marginBottom: spacing.xs,
    flexShrink: 1,
    minHeight: 28,
  },
  // No glass pill/background here (unlike Workout mode's shared
  // greetingBlock) -- Nutrition mode's background is now a flat, generic
  // dark backdrop (see backgroundThemes.ts), not a busy photo, so there's
  // no separation problem for a translucent pill to solve.
  nutritionGreetingBlock: {
    alignItems: 'center',
    alignSelf: 'center',
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
    color: colors.textSecondaryBright,
    fontSize: 13,
    fontWeight: '700',
    letterSpacing: 2,
  },
  // Wraps the shared ModeToggle (see design/ModeToggle.tsx) -- preserves
  // Dashboard's original spacing before the greeting row now that the
  // toggle itself is a reusable component with no baked-in margin of its
  // own (other screens want different spacing around it). Trimmed
  // aggressively, alongside every other margin/padding in this file's
  // Workout-mode section, so the full stack (greeting + Next Workout + the
  // 2x2 stat grid + This Week) fits one screen without scrolling on
  // typical phones -- this widget stack grew across several passes and
  // needed a real second condensing pass, not just a touch-up.
  modeToggleWrap: {
    marginBottom: spacing.sm,
  },

  // Centered -- no longer a left-aligned row balanced against a
  // right-side avatar (that was removed; see the note on greeting below).
  greetingRow: {
    alignItems: 'center',
    marginBottom: spacing.sm,
  },
  // Two-line greeting -- a small time-of-day eyebrow ("GOOD MORNING") above
  // the user's first name, replacing the earlier single-line "Good
  // morning, Harbir" plus avatar. No avatar/initials render on this screen
  // any more (see DashboardScreen.tsx's own note on this). Sits on the same
  // dark glass fill as every other widget (GlassBackground, rendered as
  // this View's first child in DashboardScreen.tsx) -- a text-shadow alone
  // wasn't reliably dark/legible enough against a busy or lighter patch of
  // the background photo, since this block has no card of its own.
  greetingBlock: {
    alignItems: 'center',
    alignSelf: 'center',
    borderRadius: radii.lg,
    paddingHorizontal: spacing.xl,
    paddingVertical: spacing.md,
    overflow: 'hidden',
  },
  greetingEyebrow: {
    ...typeScale.sectionHeading,
    color: colors.textSecondaryBright,
    marginBottom: spacing.xs,
    textAlign: 'center',
    textShadowColor: 'rgba(0, 0, 0, 0.65)',
    textShadowOffset: { width: 0, height: 1 },
    textShadowRadius: 4,
  },
  greeting: {
    ...typeScale.screenTitle,
    color: colors.textPrimary,
    textAlign: 'center',
    textShadowColor: 'rgba(0, 0, 0, 0.65)',
    textShadowOffset: { width: 0, height: 1 },
    textShadowRadius: 4,
  },

  errorText: {
    color: colors.destructive,
    fontSize: 14,
    marginBottom: spacing.md,
  },
  // Workout mode's stack grew with the 2x2 stat grid (see
  // DashboardStatCard usage), so this stays tighter than nutritionSection
  // below to keep the whole thing fitting one screen without scrolling.
  section: {
    marginBottom: spacing.xs,
  },
  // Trimmed to spacing.xs (from spacing.sm) now that Nutrition mode has no
  // ScrollView fallback -- every widget's natural size has to fit the
  // fixed space between the header/footer, so this stack needed the same
  // kind of condensing pass Workout mode's `section` already went through.
  nutritionSection: {
    marginBottom: spacing.xs,
  },
  // Applied (merged with each card's own `style`) to every Nutrition-mode
  // card. spacing.sm rather than AppCard's own default spacing.lg, since
  // four compact cards still need to be tighter than a single full-size
  // card -- but not as thin as an earlier spacing.xs pass, which read as
  // text sitting too close to the card edges. Now that Weekly Calories no
  // longer stretches to fill leftover space (see weeklyCaloriesSectionFill),
  // there's real headroom for this without reintroducing clipping.
  compactCard: {
    padding: spacing.sm,
  },
  // Real-device testing kept showing Weekly Calories itself clipped even
  // after repeated rounds of trimming the OTHER widgets' spacing --
  // guessing exact pixel budgets for "a typical phone" without being able
  // to test on the actual device kept being wrong by a real margin each
  // time. This card (the Calorie/Macro ring+macros widget) is deliberately
  // NOT part of that shrink pool: CalorieRing draws a fixed-size SVG
  // circle, which flexShrink cannot compress without literally clipping
  // the ring -- a broken ring is worse than the problem this is meant to
  // solve, so this card's own natural size (already trimmed -- see
  // CalorieRing's `size` in DashboardScreen.tsx) is a second hard floor,
  // same as Weekly Calories itself, and the *other* three widgets below
  // (Quick Actions, Recent Meals, Greeting) absorb the shortfall instead.
  // Their own minHeight floors are set low enough to guarantee they can
  // give real room even in a worst-case estimate: Quick Actions can lose
  // its subtitle line, Recent Meals can lose its logged rows down to just
  // its header + "View All", the greeting can compress to a single line.
  nutritionQuickActionsSectionShrink: {
    flexShrink: 1,
    minHeight: 40,
  },
  // Recent Meals additionally varies with real data (0-4 logged meals)
  // rather than just being compressible chrome -- same flexShrink
  // treatment as its siblings.
  nutritionMealsSection: {
    flexShrink: 1,
    minHeight: 44,
  },
  // The last Nutrition-mode section (Weekly Calories). Deliberately NOT
  // flexGrow anymore -- an earlier version stretched this card to fill
  // whatever leftover vertical space the cards above it didn't use, which
  // is exactly what produced a large, awkward empty area inside the card
  // (the actual root cause of that complaint, not a spacing/padding
  // problem). This card is now sized purely by its own content, same as
  // every other Nutrition widget: "content, with balanced internal
  // spacing," per the approved direction. If the stack above happens to be
  // shorter than the available screen height, the leftover space is just a
  // natural trailing gap below this card, above the bottom nav -- that's
  // the expected, intentional look ("ends naturally above the
  // BottomNavBar"), not something to be filled by stretching a card.
  // flexShrink: 0 is the one thing that stays: this card must never be
  // compressed below its own content and clipped -- see
  // nutritionQuickActionsSectionShrink's comment for which widgets *do*
  // absorb a too-tall stack instead.
  weeklyCaloriesSectionFill: {
    flexShrink: 0,
    // Overrides nutritionSection's own marginBottom -- as the last widget,
    // there's nothing below it to separate from.
    marginBottom: 0,
  },
  weeklyCaloriesCardFill: {
    flexShrink: 0,
  },
  // Wraps everything below the card's own header row (icon + "Weekly
  // Calories" title, which stays at the top like every other card) -- just
  // a deliberate gap below the header, no longer a flex-fill region (see
  // weeklyCaloriesSectionFill's comment above).
  weeklyCaloriesContentFill: {
    marginTop: spacing.sm,
  },
  // color is supplied per-render by the active mode theme (see
  // DashboardScreen.tsx).
  viewAllText: {
    fontSize: 13,
    fontWeight: '600',
  },
  // Vertical padding for the Workout-mode widgets (Next Workout / This
  // Week) -- deliberately tighter than AppCard's own default
  // (spacing.lg), since these need to be as compact as possible for the
  // whole Workout-mode stack to fit one screen without scrolling.
  condensedCard: {
    paddingVertical: spacing.sm,
  },
  cardTitle: {
    ...typeScale.cardTitle,
    color: colors.textPrimary,
    marginBottom: 2,
  },
  cardMeta: {
    color: colors.textSecondary,
    fontSize: 13,
  },

  // Dynamic Next Workout card -- driven by the user's active workout split
  // and history (see workouts/nextWorkout.ts), never a hardcoded day.
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
  // Small accent-colored badge (e.g. "PPL") derived from the split's own
  // real name -- see workouts/splitBadge.ts. Uses the active mode theme's
  // own accentBg/accentBorder tokens, not a hardcoded tint.
  splitBadge: {
    borderRadius: radii.sm,
    borderWidth: 1,
    paddingHorizontal: spacing.sm,
    paddingVertical: 2,
  },
  splitBadgeText: {
    fontFamily: fonts.monoBold,
    fontSize: 11,
    letterSpacing: 1,
  },
  nextWorkoutDayName: {
    ...typeScale.screenTitle,
    color: colors.textPrimary,
  },
  nextWorkoutSplitName: {
    color: colors.textSecondaryBright,
    fontSize: 13,
    marginTop: 2,
    marginBottom: spacing.xs,
  },
  nextWorkoutButton: {
    borderRadius: radii.lg,
    paddingVertical: spacing.sm + 2,
    alignItems: 'center',
    flexDirection: 'row',
    justifyContent: 'center',
    gap: spacing.sm,
    marginTop: spacing.sm,
  },
  nextWorkoutButtonText: {
    fontSize: 16,
    fontWeight: '700',
  },
  // A darker glass pill (surfaceRaised, the same token used for other
  // secondary/inset chrome, e.g. quickActionIcon below) -- distinct from
  // the plain-text button this replaced, so it reads as a real secondary
  // action next to the primary accent-filled Start Workout button.
  nextWorkoutSecondaryButton: {
    alignItems: 'center',
    paddingVertical: spacing.xs + 2,
    borderRadius: radii.lg,
    marginTop: spacing.xs,
    backgroundColor: colors.surfaceRaised,
    borderWidth: 1,
    borderColor: colors.border,
  },
  nextWorkoutSecondaryButtonText: {
    color: colors.textSecondaryBright,
    fontSize: 14,
    fontWeight: '600',
  },

  // 2x2 lifetime/weekly stat grid (Sets Done / Workouts This Month / Day
  // Streak / Weekly Goal) -- see dashboard/DashboardStatCard.tsx. Each tile
  // is a shared AppCard, not a hand-rolled background. Deliberately compact
  // (smaller icon/value than a standalone stat card would use elsewhere)
  // since this is one of four tiles inside an already-tall Workout-mode
  // stack that needs to fit one screen without scrolling.
  statGridRow: {
    flexDirection: 'row',
    gap: spacing.sm,
  },
  statGridCard: {
    flex: 1,
    padding: spacing.sm,
  },
  statGridIcon: {
    width: 26,
    height: 26,
    borderRadius: radii.sm,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: spacing.xs,
  },
  statGridValue: {
    ...typeScale.statMedium,
    color: colors.textPrimary,
  },
  statGridTitle: {
    color: colors.textPrimary,
    fontSize: 13,
    fontWeight: '600',
    marginTop: 1,
  },
  statGridFooterRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginTop: 2,
  },
  statGridSubtitle: {
    color: colors.textSecondary,
    fontSize: 11,
  },

  // Weekly Process widget.
  weeklyCountText: {
    fontFamily: fonts.monoBold,
    color: colors.textPrimary,
    fontSize: 14,
  },
  weeklyHeaderRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: spacing.xs,
  },
  weeklyDaysRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
  },
  weeklyDay: {
    alignItems: 'center',
    gap: 2,
  },
  weeklyDayCircle: {
    width: 26,
    height: 26,
    borderRadius: radii.pill,
    borderWidth: 1,
    borderColor: colors.border,
    alignItems: 'center',
    justifyContent: 'center',
  },
  weeklyDayLabel: {
    color: colors.textSecondary,
    fontSize: 10,
  },

  statMeta: {
    color: colors.textMuted,
    fontSize: 11,
    marginTop: 2,
  },

  // Shared list-row language (Recent Top Sets / Recent Meals).
  listRow: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: spacing.md,
    gap: spacing.md,
  },
  listRowDivider: {
    borderTopWidth: 1,
    borderTopColor: colors.divider,
  },
  listThumb: {
    width: 44,
    height: 44,
    borderRadius: radii.md,
    backgroundColor: colors.surfaceRaised,
    alignItems: 'center',
    justifyContent: 'center',
  },
  listRowBody: {
    flex: 1,
  },
  listRowTitle: {
    color: colors.textPrimary,
    fontSize: 15,
    fontWeight: '600',
  },
  listRowMeta: {
    color: colors.textSecondary,
    fontSize: 12,
    marginTop: 2,
  },
  listRowTrailing: {
    alignItems: 'flex-end',
    gap: 4,
  },
  // color is supplied per-render by the active mode theme (see
  // DashboardScreen.tsx).
  listRowValue: {
    fontFamily: fonts.monoBold,
    fontSize: 15,
  },

  topSetRow: {
    marginTop: spacing.xs,
    flexDirection: 'row',
    flexWrap: 'wrap',
    alignItems: 'center',
    gap: spacing.sm,
  },
  topSetText: {
    color: colors.textPrimary,
    fontSize: 15,
  },
  // color is supplied per-render by the active mode theme (see
  // DashboardScreen.tsx).
  topSetValue: {
    fontFamily: fonts.monoBold,
    fontSize: 17,
  },
  insight: {
    color: colors.textSecondary,
    fontSize: 13,
    marginTop: spacing.xs,
  },

  // Calories Today ring card. Hierarchy per the reference design: a small
  // icon+label row ("Calories"), then one big bold readout ("0 / 2,100") --
  // the ring itself carries no text of its own (see CalorieRing's own
  // comment), so this is the single place the number lives.
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
  // fontSize 26 vs macroAmount's 14 -- a deliberate ~2x gap so the calorie
  // readout reads as the card's primary number and the macros clearly
  // secondary, not three roughly-equal numbers competing for attention.
  calorieBigValue: {
    fontFamily: fonts.monoBold,
    color: colors.textPrimary,
    fontSize: 26,
  },
  calorieBigGoal: {
    fontFamily: fonts.mono,
    color: colors.textSecondary,
    fontSize: 15,
  },
  noGoalsText: {
    color: colors.textSecondary,
    fontSize: 12,
    marginTop: spacing.sm,
  },
  noGoalsSubtitle: {
    color: colors.textMuted,
    fontSize: 11,
    marginTop: 2,
  },
  // Deliberate separation between the ring/calorie row and the macro row
  // below it -- a clean section break (per the reference) rather than
  // spacing alone trying to do that job.
  heroDivider: {
    borderTopWidth: 1,
    borderTopColor: colors.divider,
    marginTop: spacing.xs,
    paddingTop: spacing.xs,
  },

  // Weekly Calories card -- the daily target x7, with a game-style progress
  // bar toward it (see computeWeeklyCalorieSummary). This card is the one
  // widget that never shrinks (flexShrink: 0 on weeklyCaloriesCardFill), so
  // ITS OWN natural size is the hard floor the rest of the Nutrition stack
  // has to fit around -- sized down a third time (original 40/26 -> 30/20
  // -> 26/17 here) since real-device testing kept showing this exact card
  // clipped even after trimming every other widget. Still the biggest,
  // boldest numbers on the card (per the approved "game-style" design),
  // just no longer sized for a screen with room to spare.
  weeklyCaloriesValue: {
    fontFamily: fonts.monoBold,
    color: colors.textPrimary,
    fontSize: 26,
  },
  weeklyCaloriesUnit: {
    fontFamily: fonts.displayMedium,
    color: colors.textSecondary,
    fontSize: 12,
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
  // computeWeeklyCalorieSummary) -- deliberately no sentence/explanatory
  // text here, per the approved design.
  weeklyCaloriesStatsRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.lg,
    marginTop: spacing.xs,
  },
  weeklyCaloriesStatBlock: {
    flex: 1,
    alignItems: 'flex-start',
  },
  // Visual separator between Consumed/Remaining, matching the reference --
  // the same hairline `divider` token used for macro columns above.
  weeklyCaloriesStatDivider: {
    width: 1,
    alignSelf: 'stretch',
    backgroundColor: colors.divider,
  },
  weeklyCaloriesStatLabel: {
    ...typeScale.secondary,
    color: colors.textSecondary,
    marginBottom: spacing.xs,
  },
  weeklyCaloriesStatValue: {
    fontFamily: fonts.monoBold,
    color: colors.textPrimary,
    fontSize: 17,
  },

  // Macro cards -- three equal columns separated by a hairline divider
  // (colors.divider, the same "row dividers within a card" token used
  // elsewhere) rather than gap/spacing alone, matching the reference's
  // clear column separation.
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
    color: colors.textSecondary,
    fontSize: 12,
    fontWeight: '600',
  },
  macroAmount: {
    fontFamily: fonts.monoBold,
    color: colors.textPrimary,
    fontSize: 14,
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

  // Quick actions -- visual only, no functionality this task.
  quickActionsRow: {
    flexDirection: 'row',
    gap: spacing.sm,
  },
  quickActionCard: {
    flex: 1,
    alignItems: 'flex-start',
  },
  // backgroundColor is supplied per-render (theme.accentBg) so the badge
  // follows the active mode's accent -- see DashboardScreen.tsx.
  quickActionIcon: {
    width: 30,
    height: 30,
    borderRadius: radii.pill,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: spacing.xs,
  },
  quickActionTitle: {
    color: colors.textPrimary,
    fontSize: 13,
    fontWeight: '700',
  },
  quickActionSubtitle: {
    color: colors.textSecondary,
    fontSize: 11,
    marginTop: 2,
  },

  // Shared "icon + title" row header used inside a card (Weekly Calories).
  goalsHeaderRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  goalsTitleRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
  },
  // Today's Meals' own header row -- icon badge + title + trailing chevron,
  // the whole row tappable (navigates to Nutrition), replacing an earlier
  // small top-right-only "View All" link with a clearer title treatment
  // matching the reference design's icon-wrap + title + chevron row
  // convention (DESIGN.md's own settingsStyles row pattern).
  mealsHeaderRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
    marginBottom: spacing.xs,
  },
  mealsHeaderIcon: {
    width: 30,
    height: 30,
    borderRadius: radii.pill,
    alignItems: 'center',
    justifyContent: 'center',
  },
  mealsHeaderTitle: {
    ...typeScale.cardTitle,
    color: colors.textPrimary,
    flex: 1,
  },
  mealsEmptyText: {
    color: colors.textSecondary,
    fontSize: 13,
  },

  footer: {
    alignItems: 'center',
    marginTop: spacing.sm,
  },

  // Decorative bottom bar -- Progresso has no real tab navigator today, so
  // this is a purely visual row local to this screen, not new navigation
  // architecture. See DashboardScreen.tsx's own note for detail. Fixed to
  // the bottom of the screen (position/zIndex below) so it stays visible
  // through scrolling, same as the fixed header above. A glass `chrome`
  // surface (GlassBackground, rendered as this View's first child) -- the
  // same real-blur treatment as the shared BottomNavBar used on every other
  // screen, so Dashboard's own copy of the bar looks consistent with it.
  bottomBar: {
    position: 'absolute',
    bottom: 0,
    left: 0,
    right: 0,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-around',
    borderTopWidth: 1,
    borderTopColor: colors.glassBorderStrong,
    paddingTop: spacing.sm,
    overflow: 'hidden',
    zIndex: 10,
    elevation: 10,
  },
  bottomBarItem: {
    alignItems: 'center',
    gap: 2,
    minWidth: 48,
    paddingVertical: 4,
  },
  bottomBarLabel: {
    fontSize: 11,
    fontWeight: '600',
  },
  // Raised less than before (was -20) -- `bottomBar`'s own overflow:'hidden'
  // (needed to clip its chrome blur/pill corners) was clipping the top of
  // this circle whenever it poked that far above the bar's own bounds.
  bottomBarCenter: {
    width: 46,
    height: 46,
    borderRadius: radii.pill,
    alignItems: 'center',
    justifyContent: 'center',
    marginTop: -8,
  },
  // Two of these are stacked behind bottomBarCenter's icon, one per mode
  // theme; their opacity crossfades on mode switch (see DashboardScreen.tsx)
  // so the accent transitions smoothly instead of snapping.
  bottomBarCenterFill: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    borderRadius: radii.pill,
  },
});
