import { StyleSheet } from 'react-native';
import { colors, minTouchTarget, radii, spacing, typeScale, widgetGap } from '../design/theme';

// ExerciseLibraryScreen's list/browse view. Token-only; the screen frame
// (safe area, header, scrolling body) is the shared `Screen`, the page is two
// widgets (`AppCard`) `widgetGap` apart, and each exercise is a `ListRow`, so
// this file only holds what those don't cover: the filter block and the
// source blocks.
export const exerciseLibraryStyles = StyleSheet.create({
  content: {
    gap: widgetGap,
  },

  searchWrap: {
    marginBottom: spacing.md,
  },
  // Vertical breathing room around the muscle-group filter row -- guarded by
  // a regression test (must stay positive).
  chipsWrap: {
    marginVertical: spacing.sm,
  },

  // "All / Built-in / Mine": three equal raised blocks, `widgetGap` apart; the
  // selected one takes the mode accent (tint fill + accent outline -- the
  // outline is always 1px, transparent when unselected, so nothing shifts).
  sourceTabs: {
    flexDirection: 'row',
    gap: widgetGap,
    marginTop: spacing.sm,
  },
  sourceTab: {
    flex: 1,
    minHeight: minTouchTarget + spacing.sm,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: colors.surfaceRaised,
    borderRadius: radii.md,
    borderWidth: 1,
    borderColor: 'transparent',
  },
  sourceTabLabel: {
    ...typeScale.callout,
    fontFamily: typeScale.label.fontFamily,
    color: colors.textSecondary,
  },
  sourceTabCount: {
    ...typeScale.statSmall,
    color: colors.textMuted,
    marginTop: 2,
  },

  countSortRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  countText: {
    ...typeScale.secondary,
    color: colors.textSecondary,
  },

  // Ownership marker on the right of a row: a quiet uppercase caption, the
  // user's own exercises in the mode accent. (Colour supplied per render.)
  sourceLabel: {
    ...typeScale.caption,
    letterSpacing: 1,
    textTransform: 'uppercase',
  },

  errorText: {
    ...typeScale.callout,
    color: colors.destructive,
    marginBottom: spacing.md,
  },
  loading: {
    paddingVertical: spacing.lg,
  },
});
