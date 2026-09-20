import { StyleSheet } from 'react-native';
import { colors, fonts, radii, spacing, typeScale } from '../design/theme';

// Shared styles for the Progress section (Strength/Top Sets/1RM/PRs/
// Exercises + their reusable components). Layout/spacing/radii/typography
// all come from the same design/theme.ts tokens every other screen uses --
// only the accent color varies, and it's always passed in as a prop
// (the user's Workout Mode color), never hardcoded here.
export const progressStyles = StyleSheet.create({
  screen: {
    flex: 1,
    // Transparent -- AppBackgroundLayer (mounted once behind the navigator)
    // paints the selected Background Theme; screens no longer hardcode it.
    backgroundColor: 'transparent',
  },
  // A section (PRs/Exercises/Top Sets/1RM) that owns a FlatList rather than
  // sharing Strength's own ScrollView -- this gives that FlatList a
  // properly flexed parent so it fills the remaining space below whatever
  // fixed header content (a count, a search bar) precedes it, without
  // nesting two same-orientation scroll containers.
  sectionFill: {
    flex: 1,
  },
  scrollContent: {
    paddingHorizontal: spacing.xxl,
    paddingBottom: spacing.xxxl,
  },

  // ProgressHeader
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingBottom: spacing.lg,
  },
  headerTitle: {
    ...typeScale.screenTitle,
    color: colors.textPrimary,
  },
  // ProgressHeader's chrome row -- hamburger, centered "Progress" title, an
  // empty same-width spacer on the right (no notification bell any more).
  // Symmetric 36x36 side slots around a flexible, text-centered middle
  // column -- the same pattern design/AppHeader.tsx uses for every other
  // screen's title row, just hand-rolled here since this component owns
  // its own mode-toggle/heading content below. Kept separate from `header`
  // above, which ProgressExerciseDetailScreen still uses for its own
  // back-button row.
  topBar: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.md,
    marginBottom: spacing.lg,
  },
  // The page title itself now (no longer a small letter-spaced "PROGRESSO"
  // wordmark) -- matches AppHeader's own `title` style exactly (screenTitle
  // scale, textPrimary), the same treatment every other page's title
  // (Workouts, Workout Splits, Exercise Library) gets from the shared
  // AppHeader component.
  wordmark: {
    ...typeScale.screenTitle,
    flex: 1,
    textAlign: 'center',
    color: colors.textPrimary,
  },
  topBarSpacer: {
    width: 36,
    height: 36,
  },
  // ProgressHeader's eyebrow/heading/supporting-text block, below the
  // chrome row and the mode toggle -- "PROGRESS" (accent-colored eyebrow),
  // "Track Your Growth" (the screen's real title, large), then a two-line
  // supporting sentence. Deliberately its own block rather than reusing
  // `headerTitle` (screenTitle scale) -- this heading reads larger/more
  // prominent, matching the reference, while still built from the same
  // typeScale/spacing tokens rather than a one-off size.
  headingBlock: {
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
  menuButton: {
    width: 40,
    height: 40,
    borderRadius: radii.pill,
    backgroundColor: colors.surface,
    borderWidth: 1,
    borderColor: colors.border,
    alignItems: 'center',
    justifyContent: 'center',
  },

  // Wraps the shared ModeToggle (design/ModeToggle.tsx) -- Progress is one
  // of the app's primary/root screens, so it keeps this the same way
  // Dashboard does; deeper detail screens reached from here don't.
  modeToggleWrap: {
    marginBottom: spacing.lg,
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

  // Overview hero
  heroTitle: {
    ...typeScale.cardTitle,
    color: colors.textPrimary,
    marginBottom: spacing.xxl,
  },

  // Featured exercise (ProgressExerciseDetailScreen)
  featuredCurrent: {
    fontFamily: fonts.monoBold,
    fontSize: 22,
    color: colors.textPrimary,
    marginTop: spacing.sm,
  },
  featuredDelta: {
    fontSize: 13,
    marginTop: 2,
  },

  // TimeRangeSelector
  chipRow: {
    flexDirection: 'row',
    gap: spacing.sm,
    marginBottom: spacing.lg,
  },
  chip: {
    paddingHorizontal: spacing.md,
    paddingVertical: 6,
    borderRadius: radii.pill,
    borderWidth: 1,
    borderColor: colors.border,
    backgroundColor: colors.surface,
  },
  chipText: {
    fontSize: 12,
    fontWeight: '600',
    color: colors.textSecondary,
  },

  // ChartPointDetail
  pointDetail: {
    backgroundColor: colors.surfaceRaised,
    borderRadius: radii.md,
    padding: spacing.lg,
    marginTop: spacing.lg,
  },
  pointDetailHeaderRow: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    justifyContent: 'space-between',
  },
  pointDetailHeadline: {
    fontFamily: fonts.monoBold,
    fontSize: 20,
  },
  pointDetailMeta: {
    color: colors.textSecondary,
    fontSize: 13,
    marginTop: 2,
  },
  pointDetailDismiss: {
    width: 32,
    height: 32,
    alignItems: 'center',
    justifyContent: 'center',
  },
  pointDetailStatsRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: spacing.lg,
    marginTop: spacing.lg,
  },
  pointDetailStat: {
    minWidth: 80,
  },
  pointDetailStatLabel: {
    color: colors.textMuted,
    fontSize: 11,
    textTransform: 'uppercase',
    letterSpacing: 0.5,
    marginBottom: 2,
  },
  pointDetailStatValue: {
    fontFamily: fonts.monoBold,
    color: colors.textPrimary,
    fontSize: 15,
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
    color: colors.textSecondary,
    fontSize: 12,
    fontWeight: '600',
    marginBottom: spacing.xs,
  },
  metricValue: {
    fontFamily: fonts.monoBold,
    fontSize: 20,
    color: colors.textPrimary,
  },
  metricUnit: {
    fontSize: 13,
    color: colors.textSecondary,
  },
  metricEmpty: {
    color: colors.textMuted,
    fontSize: 13,
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
    color: colors.textPrimary,
    fontSize: 14,
    fontWeight: '600',
  },
  milestoneDate: {
    color: colors.textMuted,
    fontSize: 12,
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
    color: colors.textPrimary,
    fontSize: 15,
    fontWeight: '600',
  },
  recordRowMeta: {
    color: colors.textSecondary,
    fontSize: 13,
    marginTop: 2,
  },
  recordRowValue: {
    fontFamily: fonts.monoBold,
    fontSize: 15,
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
    color: colors.textSecondary,
    fontSize: 13,
    marginTop: 2,
    marginBottom: spacing.md,
  },

  // Search row (Top Sets/Exercises)
  searchInput: {
    backgroundColor: colors.surface,
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: radii.md,
    paddingHorizontal: spacing.md,
    paddingVertical: 10,
    color: colors.textPrimary,
    fontSize: 15,
    marginBottom: spacing.md,
  },

  // TopSetRow -- a standalone glass card per exercise (not a divided list
  // like PRRow/ExerciseProgressRow), per the Top Sets page's own design
  // spec. Consistent AppCard spacing between cards comes from FlatList's
  // ItemSeparatorComponent (see TopSetsSection.tsx), not a margin here, so
  // this card's own footprint stays identical to every other AppCard.
  topSetCard: {
    paddingVertical: spacing.md,
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
    color: colors.textPrimary,
    fontSize: 15,
    fontWeight: '600',
  },
  topSetMuscleGroup: {
    color: colors.textSecondary,
    fontSize: 13,
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
    fontFamily: fonts.monoBold,
    fontSize: 15,
  },
  topSetCaption: {
    color: colors.textMuted,
    fontSize: 11,
    marginTop: 2,
  },

  emptyStateWrap: {
    paddingVertical: spacing.xxxl,
  },

  loadingWrap: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
  },
  errorText: {
    color: colors.destructive,
    fontSize: 14,
    marginBottom: spacing.md,
  },

  // OverviewSection's two top-level cards ("Your Progress", "Recent
  // Milestones") -- a single AppCard each, never a card nested inside
  // another card: the metric tiles/PR rows inside them stay subtle/dark
  // (statTile below has no background of its own; PRRow's own rows use the
  // shared divider pattern), not separate bright cards.
  overviewCard: {
    marginBottom: spacing.lg,
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
    color: colors.textSecondary,
    fontSize: 13,
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
  statTileIcon: {
    width: 32,
    height: 32,
    borderRadius: radii.md,
    alignItems: 'center',
    justifyContent: 'center',
  },
  statTileValue: {
    ...typeScale.statMedium,
    color: colors.textPrimary,
  },
  statTileLabel: {
    fontSize: 12,
    color: colors.textSecondary,
  },

  // "View All" link on a section header
  viewAllText: {
    fontSize: 13,
    fontWeight: '600',
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
    color: colors.textPrimary,
    fontSize: 14,
    fontWeight: '600',
  },
  muscleGroupCount: {
    color: colors.textSecondary,
    fontSize: 13,
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

  // Strength Progress -- the featured exercise's card (name, muscle-group/
  // movement-type tags, starting/latest performance, delta + progress
  // level, chart) and the "other exercises with meaningful progress" list
  // below it.
  strengthCard: {
    marginBottom: spacing.lg,
  },
  strengthCardName: {
    ...typeScale.cardTitle,
    fontSize: 18,
    color: colors.textPrimary,
    marginBottom: spacing.xs,
  },
  strengthTagsRow: {
    flexDirection: 'row',
    gap: spacing.sm,
    marginBottom: spacing.lg,
  },
  strengthTag: {
    backgroundColor: colors.surfaceRaised,
    borderRadius: radii.sm,
    paddingHorizontal: spacing.sm,
    paddingVertical: 3,
  },
  strengthTagText: {
    color: colors.textSecondary,
    fontSize: 11,
    fontWeight: '600',
  },
  strengthPerfGrid: {
    flexDirection: 'row',
    gap: spacing.xl,
    marginBottom: spacing.lg,
  },
  strengthPerfLabel: {
    color: colors.textSecondary,
    fontSize: 12,
    marginBottom: 2,
  },
  strengthPerfValue: {
    fontFamily: fonts.monoBold,
    color: colors.textPrimary,
    fontSize: 17,
  },
  strengthDeltaRow: {
    marginBottom: spacing.lg,
  },
  strengthDeltaValue: {
    fontFamily: fonts.monoBold,
    fontSize: 24,
  },
  strengthLevelBadge: {
    alignSelf: 'flex-start',
    borderRadius: radii.sm,
    paddingHorizontal: spacing.sm,
    paddingVertical: 3,
    marginTop: spacing.xs,
  },
  strengthLevelBadgeText: {
    fontSize: 12,
    fontWeight: '700',
  },

  strengthListRow: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: spacing.md,
    gap: spacing.md,
  },
  strengthListRowDivider: {
    borderTopWidth: 1,
    borderTopColor: colors.divider,
  },
  strengthListRowBody: {
    flex: 1,
  },
  strengthListRowName: {
    color: colors.textPrimary,
    fontSize: 15,
    fontWeight: '600',
  },
  strengthListRowMeta: {
    color: colors.textSecondary,
    fontSize: 13,
    marginTop: 2,
  },
  strengthListRowTrailing: {
    alignItems: 'flex-end',
  },
  strengthListRowDelta: {
    fontFamily: fonts.monoBold,
    fontSize: 15,
  },
  strengthListRowLevel: {
    color: colors.textSecondary,
    fontSize: 12,
    marginTop: 2,
  },

  // All Time tab -- see AllTimeSection.tsx. Its own tokens rather than
  // reusing Strength's strengthPerfGrid/strengthListRow (visually similar,
  // but kept independent so an All Time tweak can never accidentally touch
  // the Strength tab's styling).
  allTimeHero: {
    marginBottom: spacing.lg,
  },
  allTimeHeroTitle: {
    ...typeScale.screenTitle,
    color: colors.textPrimary,
    marginBottom: spacing.xs,
  },
  allTimeHeroSubtitle: {
    color: colors.textSecondary,
    fontSize: 14,
    lineHeight: 20,
  },
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
    fontSize: 12,
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
    color: colors.textSecondary,
    fontSize: 12,
    marginBottom: 2,
  },
  allTimePrValue: {
    fontFamily: fonts.monoBold,
    fontSize: 19,
    color: colors.textPrimary,
  },
  allTimePrCaption: {
    color: colors.textMuted,
    fontSize: 12,
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
    color: colors.textSecondary,
    fontSize: 12,
    fontWeight: '700',
  },
  allTimeRankName: {
    flex: 1,
    color: colors.textPrimary,
    fontSize: 14,
    fontWeight: '600',
  },
  allTimeRankValue: {
    fontFamily: fonts.monoBold,
    fontSize: 14,
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
    color: colors.textPrimary,
    fontSize: 14,
    fontWeight: '600',
    flex: 1,
    marginRight: spacing.md,
  },
  allTimeMilestoneDate: {
    color: colors.textMuted,
    fontSize: 12,
  },

  // Relative Strength -- honest "not enough data yet" state (see section
  // 24 of the All Time spec); no fabricated percentiles.
  relativeStrengthTitle: {
    ...typeScale.cardTitle,
    color: colors.textPrimary,
    marginBottom: spacing.xs,
  },
  relativeStrengthBody: {
    color: colors.textSecondary,
    fontSize: 13,
    lineHeight: 19,
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
    fontSize: 13,
    fontWeight: '600',
  },
});
