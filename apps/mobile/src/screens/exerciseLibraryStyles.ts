import { StyleSheet } from 'react-native';
import { colors, minTouchTarget, spacing, typeScale } from '../design/theme';

// ExerciseLibraryScreen's list/browse view. Token-only; the screen frame
// (safe area, header, transparent root) is the shared `Screen`, and each
// exercise is a `ListRow`, so this file only holds what those don't cover:
// the filter block above the list and the source tabs.
export const exerciseLibraryStyles = StyleSheet.create({
  listContent: {
    paddingHorizontal: spacing.xxl,
    paddingBottom: spacing.xxl,
  },

  searchWrap: {
    marginBottom: spacing.md,
  },
  // Vertical breathing room around the muscle-group filter row -- guarded by
  // a regression test (must stay positive).
  chipsWrap: {
    marginVertical: spacing.sm,
  },

  // "All / Built-in / Mine": three equal tabs sharing one hairline; the
  // selected one is underlined and coloured with the mode accent. Plain
  // pressable text, not cards -- there is nothing to group.
  sourceTabs: {
    flexDirection: 'row',
    marginTop: spacing.sm,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: colors.divider,
  },
  sourceTab: {
    flex: 1,
    minHeight: minTouchTarget + spacing.sm,
    alignItems: 'center',
    justifyContent: 'center',
    borderBottomWidth: 2,
    borderBottomColor: 'transparent',
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

  emptyWrap: {
    paddingTop: spacing.xxl,
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
