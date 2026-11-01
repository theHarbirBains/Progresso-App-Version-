import { StyleSheet } from 'react-native';
import { colors, fonts, radii, spacing, typeScale } from '../design/theme';

// Shared styles for the Progress section (Strength/Top Sets/1RM/PRs/
// Exercises + their reusable components). Layout/spacing/radii/typography
// all come from the same design/theme.ts tokens every other screen uses --
// only the accent color varies, and it's always passed in as a prop
// (the user's Workout Mode color), never hardcoded here.
export const progressStyles = StyleSheet.create({
  // A section (PRs/Exercises/Top Sets/1RM) that owns a FlatList rather than
  // sharing Strength's own ScrollView -- this gives that FlatList a
  // properly flexed parent so it fills the remaining space below whatever
  // fixed header content (a count, a search bar) precedes it, without
  // nesting two same-orientation scroll containers.
  sectionFill: {
    flex: 1,
  },
  // All Time: its Workouts / Nutrition switch over whichever is chosen.
  allTimeTabs: {
    flex: 1,
    gap: spacing.md,
  },

  // ProgressHeader's eyebrow/heading/supporting-text block, below the
  // chrome row and the mode toggle -- "PROGRESS" (accent-colored eyebrow),
  // "Track Your Growth" (the screen's real title, large), then a two-line
  // supporting sentence. Deliberately its own block rather than reusing
  // `headerTitle` (screenTitle scale) -- this heading reads larger/more
  // prominent, matching the reference, while still built from the same
  // typeScale/spacing tokens rather than a one-off size.
  headingBlock: {
    paddingHorizontal: 0,
    marginBottom: spacing.xl,
  },
  eyebrow: {
    ...typeScale.sectionHeading,
    marginBottom: spacing.xs,
  },
  heading: {
    ...typeScale.display,
    color: colors.textPrimary,
    marginBottom: spacing.sm,
  },
  headingSupporting: {
    ...typeScale.body,
    color: colors.textSecondary,
    lineHeight: 20,
  },

  // Wraps the shared ModeToggle (design/ModeToggle.tsx) -- Progress is one
  // of the app's primary/root screens, so it keeps this the same way
  // Dashboard does; deeper detail screens reached from here don't.
  modeToggleWrap: {
    paddingHorizontal: 0,
    marginBottom: spacing.lg,
  },
  // Section tabs + error, under the header.
  tabsWrap: {
    paddingHorizontal: 0,
  },
  // The active section's widget: a card filling the remaining height below
  // the tabs, inset to the same screen margin the tabs use.
  // The section card's rollout wrapper (RiseIn) -- fills the same height.
  sectionRise: {
    flex: 1,
  },
  sectionCard: {
    flex: 1,
    marginHorizontal: 0,
    marginTop: spacing.sm,
    marginBottom: spacing.lg,
  },

  // ProgressExerciseDetailScreen's scrolling body (the frame is `Screen`).
  detailContent: {
    paddingBottom: spacing.xxl,
  },

  // Featured exercise (ProgressExerciseDetailScreen)
  featuredCurrent: {
    ...typeScale.statMedium,
    fontFamily: fonts.monoBold,
    color: colors.textPrimary,
    marginTop: spacing.sm,
  },
  featuredDelta: {
    ...typeScale.secondary,
    marginTop: 2,
  },

  // MetricCard
  metricsGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: spacing.md,
  },
  metricCard: {
    flexBasis: '47%',
    flexGrow: 1,
  },
  metricLabel: {
    ...typeScale.secondary,
    fontFamily: fonts.semibold,
    color: colors.textSecondary,
    marginBottom: spacing.xs,
  },
  metricValue: {
    ...typeScale.statMedium,
    fontFamily: fonts.monoBold,
    color: colors.textPrimary,
  },
  metricUnit: {
    ...typeScale.secondary,
    color: colors.textSecondary,
  },
  metricEmpty: {
    ...typeScale.secondary,
    color: colors.textMuted,
  },

  // ProgressExerciseDetailScreen's Top Sets: each workout's heaviest set, newest first, as divided
  // rows -- the date, and the set as a mono readout.
  workoutTopSetRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: spacing.md,
    paddingVertical: spacing.sm,
  },
  workoutTopSetDivider: {
    borderTopWidth: StyleSheet.hairlineWidth,
    borderTopColor: colors.divider,
  },
  workoutTopSetDate: {
    ...typeScale.callout,
    color: colors.textSecondary,
  },
  workoutTopSetValue: {
    ...typeScale.statSmall,
    color: colors.textPrimary,
  },

  // Milestones (Progression Journey)
  milestoneRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.md,
    paddingVertical: spacing.sm,
  },
  milestoneDot: {
    width: 8,
    height: 8,
    borderRadius: radii.pill,
  },
  milestoneLabel: {
    ...typeScale.callout,
    fontFamily: fonts.semibold,
    color: colors.textPrimary,
  },
  milestoneDate: {
    ...typeScale.secondary,
    color: colors.textMuted,
    marginTop: 1,
  },

  // PRRow
  recordRow: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: spacing.md,
    gap: spacing.md,
  },
  recordRowDivider: {
    borderTopWidth: 1,
    borderTopColor: colors.divider,
  },
  recordRowIcon: {
    width: 40,
    height: 40,
    borderRadius: radii.md,
    alignItems: 'center',
    justifyContent: 'center',
  },
  recordRowBody: {
    flex: 1,
  },
  recordRowTitle: {
    ...typeScale.body,
    fontFamily: fonts.semibold,
    color: colors.textPrimary,
  },
  recordRowMeta: {
    ...typeScale.secondary,
    color: colors.textSecondary,
    marginTop: 2,
  },
  recordRowValue: {
    ...typeScale.statSmall,
    fontFamily: fonts.monoBold,
  },

  // Top Sets' own compact intro -- deliberately small (cardTitle scale, not
  // screenTitle) since the shared ProgressHeader above the tab row already
  // carries the screen's real title; this is just a one-line label for
  // which tab's content the user is looking at, not a second page header.
  topSetsSectionTitle: {
    ...typeScale.cardTitle,
    color: colors.textPrimary,
  },
  topSetsSectionSubtitle: {
    ...typeScale.secondary,
    color: colors.textSecondary,
    marginTop: 2,
    marginBottom: spacing.md,
  },

  // Search row (Top Sets/Exercises): the shared TextInput, with space below.
  searchWrap: {
    marginBottom: spacing.md,
  },

  // TopSetRow -- a standalone glass card per exercise (not a divided list
  // like PRRow/ExerciseProgressRow), per the Top Sets page's own design
  // spec. Consistent AppCard spacing between cards comes from FlatList's
  // ItemSeparatorComponent (see TopSetsSection.tsx), not a margin here, so
  // this card's own footprint stays identical to every other AppCard.
  topSetCard: {
    minHeight: 56,
    justifyContent: 'center',
    paddingVertical: spacing.md,
  },
  // Hairline between Top Set rows.
  separator: {
    height: StyleSheet.hairlineWidth,
    backgroundColor: colors.divider,
  },
  topSetRowContent: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: spacing.md,
  },
  topSetRowLeft: {
    flex: 1,
  },
  topSetExerciseName: {
    ...typeScale.body,
    fontFamily: fonts.semibold,
    color: colors.textPrimary,
  },
  topSetMuscleGroup: {
    ...typeScale.secondary,
    color: colors.textSecondary,
    marginTop: 2,
  },
  topSetRowRight: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
  },
  topSetValueColumn: {
    alignItems: 'flex-end',
  },
  topSetValue: {
    ...typeScale.statSmall,
    fontFamily: fonts.monoBold,
  },
  topSetCaption: {
    ...typeScale.caption,
    color: colors.textMuted,
    marginTop: 2,
  },

  emptyStateWrap: {
    paddingVertical: spacing.xxxl,
  },

  errorText: {
    ...typeScale.callout,
    color: colors.destructive,
    marginBottom: spacing.md,
  },

  // OverviewSection's two top-level cards ("Your Progress", "Recent
  // Milestones") -- a single AppCard each, never a card nested inside
  // another card: the metric tiles/PR rows inside them stay subtle/dark
  // (statTile below has no background of its own; PRRow's own rows use the
  // shared divider pattern), not separate bright cards.
  overviewCard: {
    marginBottom: spacing.xxl,
  },
  overviewCardHeader: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: spacing.sm,
    marginBottom: spacing.lg,
  },
  overviewCardIconWrap: {
    width: 36,
    height: 36,
    borderRadius: radii.md,
    alignItems: 'center',
    justifyContent: 'center',
  },
  overviewCardTitleColumn: {
    flex: 1,
  },
  overviewCardTitle: {
    ...typeScale.cardTitle,
    color: colors.textPrimary,
  },
  overviewCardSubtitle: {
    ...typeScale.secondary,
    color: colors.textSecondary,
    marginTop: 2,
  },

  // Compact lifetime-stats row (shared with ProfileScreen's own stat grid)
  statsRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: spacing.sm,
  },
  statTile: {
    flexBasis: '47%',
    flexGrow: 1,
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
  },
  statTileValue: {
    ...typeScale.statMedium,
    color: colors.textPrimary,
  },
  statTileLabel: {
    ...typeScale.secondary,
    color: colors.textSecondary,
  },

  // "View All" link on a section header
  viewAllText: {
    ...typeScale.secondary,
    fontFamily: fonts.semibold,
  },

  // Muscle Group Progress
  muscleGroupRow: {
    paddingVertical: spacing.sm,
  },
  muscleGroupLabelRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginBottom: 6,
  },
  muscleGroupLabel: {
    ...typeScale.callout,
    fontFamily: fonts.semibold,
    color: colors.textPrimary,
  },
  muscleGroupCount: {
    ...typeScale.secondary,
    color: colors.textSecondary,
  },
  muscleGroupBarTrack: {
    height: 6,
    borderRadius: radii.pill,
    backgroundColor: colors.surfaceRaised,
    overflow: 'hidden',
  },
  muscleGroupBarFill: {
    height: '100%',
    borderRadius: radii.pill,
  },

  // All Time tab -- see AllTimeSection.tsx. Its own tokens rather than
  // reusing Strength's strengthPerfGrid/strengthListRow (visually similar,
  // but kept independent so an All Time tweak can never accidentally touch
  // the Strength tab's styling).
  allTimeStatGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: spacing.sm,
    marginBottom: spacing.lg,
  },
  allTimeStatCard: {
    flexBasis: '47%',
    flexGrow: 1,
    paddingVertical: spacing.md,
  },
  allTimeStatIcon: {
    width: 32,
    height: 32,
    borderRadius: radii.md,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: spacing.sm,
  },
  allTimeStatValue: {
    ...typeScale.statMedium,
    color: colors.textPrimary,
  },
  allTimeStatLabel: {
    ...typeScale.secondary,
    color: colors.textSecondary,
    marginTop: 2,
  },

  allTimePrGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    rowGap: spacing.lg,
  },
  allTimePrCell: {
    flexBasis: '50%',
  },
  allTimePrName: {
    ...typeScale.secondary,
    color: colors.textSecondary,
    marginBottom: 2,
  },
  allTimePrValue: {
    ...typeScale.statMedium,
    fontFamily: fonts.monoBold,
    color: colors.textPrimary,
  },
  allTimePrCaption: {
    ...typeScale.secondary,
    color: colors.textMuted,
    marginTop: 2,
  },

  allTimeRankRow: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: spacing.sm,
    gap: spacing.md,
  },
  allTimeRankRowDivider: {
    borderTopWidth: 1,
    borderTopColor: colors.divider,
  },
  allTimeRankBadge: {
    width: 24,
    height: 24,
    borderRadius: radii.pill,
    borderWidth: 1,
    borderColor: colors.border,
    alignItems: 'center',
    justifyContent: 'center',
  },
  allTimeRankBadgeText: {
    ...typeScale.secondary,
    fontFamily: fonts.display,
    color: colors.textSecondary,
  },
  allTimeRankName: {
    ...typeScale.callout,
    fontFamily: fonts.semibold,
    flex: 1,
    color: colors.textPrimary,
  },
  allTimeRankValue: {
    ...typeScale.statSmall,
    fontFamily: fonts.monoBold,
    color: colors.textPrimary,
  },

  allTimeMilestoneRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingVertical: spacing.sm,
  },
  allTimeMilestoneRowDivider: {
    borderTopWidth: 1,
    borderTopColor: colors.divider,
  },
  allTimeMilestoneLabel: {
    ...typeScale.callout,
    fontFamily: fonts.semibold,
    color: colors.textPrimary,
    flex: 1,
    marginRight: spacing.md,
  },
  allTimeMilestoneDate: {
    ...typeScale.secondary,
    color: colors.textMuted,
  },

  // Shareable Progress
  shareButton: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    paddingHorizontal: spacing.md,
    paddingVertical: 6,
    borderRadius: radii.pill,
    borderWidth: 1,
  },
  shareButtonText: {
    ...typeScale.secondary,
    fontFamily: fonts.semibold,
  },
});
