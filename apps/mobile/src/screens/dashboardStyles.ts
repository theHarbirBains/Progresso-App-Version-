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
    backgroundColor: colors.background,
  },

  // Fixed header: the brand row + mode toggle, pinned above the scrolling
  // content. Same background as the screen so it reads as part of the
  // Dashboard rather than a floating overlay (per the approved requirement).
  fixedHeader: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    backgroundColor: colors.background,
    paddingHorizontal: spacing.xxl,
    paddingBottom: spacing.md,
    zIndex: 10,
    elevation: 10,
  },

  // The ScrollView itself fills the screen; scrollContent's paddingTop/
  // paddingBottom (set from measured fixedHeader/bottomBar heights in
  // DashboardScreen) keep real content from ever landing underneath them.
  scrollArea: {
    flex: 1,
  },
  scrollContent: {
    paddingHorizontal: spacing.xxl,
  },

  topBar: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: spacing.lg,
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
    color: colors.textSecondary,
    fontSize: 13,
    fontWeight: '700',
    letterSpacing: 2,
  },
  iconButton: {
    width: 36,
    height: 36,
    borderRadius: radii.pill,
    backgroundColor: colors.surface,
    borderWidth: 1,
    borderColor: colors.border,
    alignItems: 'center',
    justifyContent: 'center',
  },

  modeToggle: {
    flexDirection: 'row',
    backgroundColor: colors.surface,
    borderRadius: radii.lg,
    borderWidth: 1,
    borderColor: colors.border,
    padding: 4,
    marginBottom: spacing.xl,
  },
  modeSegment: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: spacing.xs,
    paddingVertical: 10,
    borderRadius: radii.md,
  },
  // Absolute-filled behind the segment's icon/text; its opacity is animated
  // between 0 and 1 (per mode theme) to crossfade the active highlight
  // smoothly instead of snapping between modes. See DashboardScreen.tsx.
  modeSegmentFill: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    borderRadius: radii.md,
  },
  modeSegmentText: {
    color: colors.textSecondary,
    fontSize: 14,
    fontWeight: '700',
  },

  greetingRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: spacing.xl,
  },
  greetingBlock: {
    flexShrink: 1,
    paddingRight: spacing.md,
  },
  greeting: {
    ...typeScale.screenTitle,
    color: colors.textPrimary,
  },
  avatar: {
    width: 44,
    height: 44,
    borderRadius: radii.pill,
    backgroundColor: colors.surfaceRaised,
    borderWidth: 1,
    borderColor: colors.border,
    alignItems: 'center',
    justifyContent: 'center',
  },
  avatarInitial: {
    ...typeScale.cardTitle,
    color: colors.textPrimary,
  },

  errorText: {
    color: colors.destructive,
    fontSize: 14,
    marginBottom: spacing.md,
  },
  section: {
    marginBottom: spacing.xxl,
  },
  sectionHeaderRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: spacing.sm,
  },
  // color is supplied per-render by the active mode theme (see
  // DashboardScreen.tsx).
  viewAllText: {
    fontSize: 13,
    fontWeight: '600',
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

  // "Create Your Story" -- visual only, no media functionality this task.
  storyCard: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.md,
  },
  storyIconBox: {
    width: 44,
    height: 44,
    borderRadius: radii.md,
    backgroundColor: colors.surfaceRaised,
    alignItems: 'center',
    justifyContent: 'center',
  },
  storyTextBlock: {
    flex: 1,
  },
  storyTitle: {
    color: colors.textPrimary,
    fontSize: 15,
    fontWeight: '700',
  },
  storySubtitle: {
    color: colors.textSecondary,
    fontSize: 12,
    marginTop: 2,
  },

  // Dynamic Next Workout card -- driven by the user's active workout split
  // and history (see workouts/nextWorkout.ts), never a hardcoded day.
  nextWorkoutEyebrow: {
    ...typeScale.sectionHeading,
    color: colors.textMuted,
    marginBottom: spacing.xs,
  },
  nextWorkoutDayName: {
    ...typeScale.screenTitle,
    color: colors.textPrimary,
  },
  nextWorkoutSplitName: {
    color: colors.textSecondary,
    fontSize: 13,
    marginTop: 2,
    marginBottom: spacing.sm,
  },
  nextWorkoutMessage: {
    color: colors.textSecondary,
    fontSize: 14,
    marginBottom: spacing.lg,
  },
  nextWorkoutVisualization: {
    alignItems: 'center',
    marginBottom: spacing.lg,
  },
  nextWorkoutButton: {
    borderRadius: radii.lg,
    paddingVertical: spacing.md + 2,
    alignItems: 'center',
    flexDirection: 'row',
    justifyContent: 'center',
    gap: spacing.sm,
  },
  nextWorkoutButtonText: {
    fontSize: 16,
    fontWeight: '700',
  },
  nextWorkoutSecondaryButton: {
    alignItems: 'center',
    paddingVertical: spacing.md,
  },
  nextWorkoutSecondaryButtonText: {
    color: colors.textSecondary,
    fontSize: 14,
    fontWeight: '600',
  },

  // 2-column stat grid -- empty-state placeholders only (no aggregation
  // layer exists yet for workout count / volume / streak / avg duration).
  statsGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: spacing.md,
  },
  statCard: {
    flexBasis: '47%',
    flexGrow: 1,
  },
  statIconWrap: {
    width: 32,
    height: 32,
    borderRadius: radii.sm,
    backgroundColor: colors.surfaceRaised,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: spacing.sm,
  },
  statTitle: {
    color: colors.textSecondary,
    fontSize: 12,
    fontWeight: '600',
    marginBottom: 4,
  },
  statValue: {
    ...typeScale.statMedium,
    color: colors.textMuted,
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

  // Calories Today ring card.
  ringCardTop: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.lg,
  },
  ringCenter: {
    alignItems: 'center',
    justifyContent: 'center',
  },
  ringCenterValue: {
    fontFamily: fonts.monoBold,
    color: colors.textPrimary,
    fontSize: 22,
  },
  ringCenterUnit: {
    color: colors.textSecondary,
    fontSize: 11,
  },
  calorieNumbers: {
    flex: 1,
    gap: spacing.sm,
  },
  calorieText: {
    color: colors.textSecondary,
    fontSize: 13,
  },
  calorieValue: {
    fontFamily: fonts.monoBold,
    color: colors.textPrimary,
    fontSize: 15,
  },
  noGoalsText: {
    color: colors.textMuted,
    fontSize: 12,
    marginTop: spacing.sm,
  },

  // Macro cards.
  macroRow: {
    flexDirection: 'row',
    gap: spacing.sm,
    marginTop: spacing.lg,
  },
  macroCard: {
    flex: 1,
  },
  macroName: {
    color: colors.textSecondary,
    fontSize: 12,
    fontWeight: '600',
    marginBottom: 4,
  },
  macroText: {
    color: colors.textSecondary,
    fontSize: 13,
  },
  macroAmount: {
    fontFamily: fonts.monoBold,
    color: colors.textPrimary,
    fontSize: 14,
    marginBottom: spacing.sm,
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
  quickActionIcon: {
    width: 36,
    height: 36,
    borderRadius: radii.sm,
    backgroundColor: colors.surfaceRaised,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: spacing.sm,
  },
  quickActionTitle: {
    color: colors.textPrimary,
    fontSize: 13,
    fontWeight: '700',
  },
  quickActionSubtitle: {
    color: colors.textMuted,
    fontSize: 11,
    marginTop: 2,
  },

  // Nutrition Goals shortcut card -- the one card in this screen with real
  // navigation to an already-existing screen (NutritionGoalsScreen).
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
  goalsProgressTrack: {
    height: 8,
    borderRadius: 4,
    backgroundColor: colors.surfaceRaised,
    overflow: 'hidden',
    marginTop: spacing.md,
  },
  // backgroundColor is supplied per-render by the active mode theme (see
  // DashboardScreen.tsx).
  goalsProgressFill: {
    height: '100%',
    borderRadius: 4,
  },

  footer: {
    alignItems: 'center',
    marginTop: spacing.sm,
  },

  // Decorative bottom bar -- Progresso has no real tab navigator today, so
  // this is a purely visual row local to this screen, not new navigation
  // architecture. See DashboardScreen.tsx's own note for detail. Fixed to
  // the bottom of the screen (position/zIndex below) so it stays visible
  // through scrolling, same as the fixed header above.
  bottomBar: {
    position: 'absolute',
    bottom: 0,
    left: 0,
    right: 0,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-around',
    backgroundColor: colors.surface,
    borderTopWidth: 1,
    borderTopColor: colors.border,
    paddingTop: spacing.sm,
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
  bottomBarCenter: {
    width: 46,
    height: 46,
    borderRadius: radii.pill,
    alignItems: 'center',
    justifyContent: 'center',
    marginTop: -20,
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
