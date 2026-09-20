import { StyleSheet } from 'react-native';
import { colors, fonts, radii, spacing, typeScale } from '../design/theme';

const INDEX_RAIL_WIDTH = 20;

// Local to FoodLibraryScreen.tsx. A primary bottom-tab destination (like
// Dashboard), not a pushed detail screen -- so its header is a hamburger +
// brand row (side menu always reachable, no dead-end back button) rather
// than AppHeader's back-button shape, mirroring dashboardStyles.ts's own
// top bar.
export const foodLibraryStyles = StyleSheet.create({
  screen: {
    flex: 1,
    // Transparent -- AppBackgroundLayer (mounted once behind the navigator)
    // paints the selected Background Theme; screens no longer hardcode it.
    backgroundColor: 'transparent',
  },
  topBar: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: spacing.xxl,
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

  // Wraps the shared ModeToggle (design/ModeToggle.tsx) -- Food is one of
  // the app's primary/root screens, so it keeps this the same way Dashboard
  // does; deeper screens reached from here don't.
  modeToggleWrap: {
    paddingHorizontal: spacing.xxl,
    marginBottom: spacing.lg,
  },

  titleBlock: {
    paddingHorizontal: spacing.xxl,
    marginBottom: spacing.lg,
  },
  title: {
    ...typeScale.screenTitle,
    color: colors.textPrimary,
  },
  subtitle: {
    ...typeScale.body,
    color: colors.textSecondary,
    marginTop: 2,
  },

  searchWrap: {
    paddingHorizontal: spacing.xxl,
    marginBottom: spacing.lg,
  },

  countRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: spacing.xxl,
    marginBottom: spacing.sm,
  },
  countText: {
    ...typeScale.secondary,
    color: colors.textSecondary,
  },
  countRowActions: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
  },
  sortButton: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.xs,
    borderWidth: 1,
    borderColor: colors.glassBorder,
    borderRadius: radii.pill,
    paddingVertical: spacing.xs,
    paddingHorizontal: spacing.md,
  },
  sortButtonText: {
    ...typeScale.secondary,
    color: colors.textSecondary,
    fontWeight: '600',
  },
  addButton: {
    width: 32,
    height: 32,
    borderRadius: radii.pill,
    borderWidth: 1,
    borderColor: colors.glassBorder,
    alignItems: 'center',
    justifyContent: 'center',
    overflow: 'hidden',
  },

  listContent: {
    paddingHorizontal: spacing.xxl,
    paddingRight: spacing.xxl + INDEX_RAIL_WIDTH,
    paddingBottom: spacing.xxxl,
  },
  sectionHeader: {
    backgroundColor: colors.background,
    paddingVertical: spacing.xs,
  },
  sectionHeaderText: {
    ...typeScale.cardTitle,
    color: colors.textPrimary,
    fontWeight: '700',
  },

  row: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: spacing.md,
    gap: spacing.md,
    borderBottomWidth: 1,
    borderBottomColor: colors.divider,
  },
  rowTouchable: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.md,
  },
  rowIconWrap: {
    width: 40,
    height: 40,
    borderRadius: radii.md,
    backgroundColor: colors.surfaceRaised,
    alignItems: 'center',
    justifyContent: 'center',
  },
  rowBody: {
    flex: 1,
  },
  rowName: {
    ...typeScale.cardTitle,
    color: colors.textPrimary,
  },
  rowMeta: {
    ...typeScale.secondary,
    color: colors.textSecondary,
    marginTop: 2,
  },
  rowCalories: {
    fontFamily: fonts.monoBold,
    color: colors.textPrimary,
    fontSize: 14,
  },
  rowEditButton: {
    padding: spacing.xs,
  },

  indexRailWrap: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
  },

  emptyWrap: {
    paddingTop: spacing.xxl,
  },

  logFoodContent: {
    paddingHorizontal: spacing.xxl,
  },
  logFoodField: {
    marginTop: spacing.lg,
  },
  logFoodError: {
    ...typeScale.caption,
    color: colors.destructive,
    marginTop: spacing.sm,
  },
});
