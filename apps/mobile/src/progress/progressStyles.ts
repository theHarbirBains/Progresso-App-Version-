import { StyleSheet } from 'react-native';
import { colors, fonts, radii, spacing, typeScale } from '../design/theme';

// Shared styles for the Progress section (Overview/Top Sets/1RM/PRs/
// Exercises + their reusable components). Layout/spacing/radii/typography
// all come from the same design/theme.ts tokens every other screen uses --
// only the accent color varies, and it's always passed in as a prop
// (the user's Workout Mode color), never hardcoded here.
export const progressStyles = StyleSheet.create({
  screen: {
    flex: 1,
    backgroundColor: colors.background,
  },
  // A section (PRs/Exercises/Top Sets/1RM) that owns a FlatList rather than
  // sharing the Overview/Strength ScrollView -- this gives that FlatList a
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
  // ProgressHeader's own layout -- title + optional subtitle stacked in a
  // column, no row/button slot (Progress is a primary bottom-nav
  // destination now navigated internally via CategoryTabs, not a menu
  // button or back arrow). Kept separate from `header` above, which
  // ProgressExerciseDetailScreen still uses for its own back-button row.
  headerColumn: {
    paddingBottom: spacing.lg,
  },
  headerTitle: {
    ...typeScale.screenTitle,
    color: colors.textPrimary,
  },
  headerSubtitle: {
    ...typeScale.secondary,
    color: colors.textSecondary,
    marginTop: 2,
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

  // Featured exercise + ExerciseSelector trigger
  exerciseSelectorTrigger: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.xs,
    marginBottom: spacing.xs,
  },
  exerciseSelectorLabel: {
    ...typeScale.cardTitle,
    color: colors.textPrimary,
  },
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

  // ExerciseProgressRow (Exercises page + "Exercises Improving")
  exerciseRow: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: spacing.md,
    gap: spacing.md,
  },
  exerciseRowDivider: {
    borderTopWidth: 1,
    borderTopColor: colors.divider,
  },
  exerciseRowBody: {
    flex: 1,
  },
  exerciseRowName: {
    color: colors.textPrimary,
    fontSize: 15,
    fontWeight: '600',
  },
  exerciseRowMeta: {
    color: colors.textSecondary,
    fontSize: 13,
    marginTop: 2,
  },
  exerciseRowTrailing: {
    alignItems: 'flex-end',
  },
  exerciseRowValue: {
    fontFamily: fonts.monoBold,
    color: colors.textPrimary,
    fontSize: 15,
  },
  exerciseRowChange: {
    fontSize: 12,
    fontWeight: '600',
    marginTop: 2,
  },

  // TopSetRow / PRRow
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

  // Search / filter row (Top Sets)
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
  sortRow: {
    flexDirection: 'row',
    gap: spacing.sm,
    marginBottom: spacing.lg,
  },

  // ProgressSectionMenu
  menuBackdrop: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    backgroundColor: 'rgba(0, 0, 0, 0.5)',
  },
  menuPanel: {
    position: 'absolute',
    top: 0,
    bottom: 0,
    left: 0,
    width: 280,
    backgroundColor: colors.surface,
    borderRightWidth: 1,
    borderRightColor: colors.border,
    paddingHorizontal: spacing.xl,
  },
  menuTitle: {
    ...typeScale.screenTitle,
    color: colors.textPrimary,
    marginBottom: spacing.xl,
  },
  menuItem: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.md,
    paddingVertical: spacing.md,
    borderRadius: radii.md,
  },
  menuItemActive: {
    backgroundColor: colors.surfaceRaised,
  },
  menuItemLabel: {
    fontSize: 16,
    fontWeight: '600',
    color: colors.textSecondary,
  },
  menuItemLabelActive: {
    color: colors.textPrimary,
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

  // Compact lifetime-stats row (Overview) + Training Momentum (StatTile)
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

  // "You Got Stronger" insight banner
  insightCard: {
    borderWidth: 1,
  },
  insightTitleRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
    marginBottom: spacing.sm,
  },
  insightTitle: {
    ...typeScale.cardTitle,
    color: colors.textPrimary,
  },
  insightRow: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: spacing.sm,
    paddingVertical: 4,
  },
  insightText: {
    color: colors.textSecondary,
    fontSize: 14,
    flex: 1,
  },

  // Most Improved ranking
  rankBadge: {
    width: 24,
    height: 24,
    borderRadius: radii.pill,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: colors.surfaceRaised,
  },
  rankBadgeText: {
    fontSize: 12,
    fontWeight: '700',
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

  // Global Milestones (distinct from the per-exercise "Progression Journey")
  milestoneCard: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.md,
    paddingVertical: spacing.sm,
  },
  milestoneIconWrap: {
    width: 36,
    height: 36,
    borderRadius: radii.pill,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: colors.surfaceRaised,
  },
  milestoneBody: {
    flex: 1,
  },
  milestoneCardLabel: {
    color: colors.textPrimary,
    fontSize: 14,
    fontWeight: '600',
    marginBottom: 4,
  },
  milestoneCardProgressText: {
    color: colors.textMuted,
    fontSize: 12,
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
