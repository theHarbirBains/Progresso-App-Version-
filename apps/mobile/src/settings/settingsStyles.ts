import { StyleSheet } from 'react-native';
import { colors, fonts, radii, spacing, typeScale } from '../design/theme';

// Shared styles for the Settings hub (shell + every category). Settings is
// app-level/global, not a per-mode screen, so unlike Dashboard/Progress it
// has no independent theme concept of its own -- the one dynamic color used
// here (the category tabs' selected state, primary buttons) is always the
// user's Workout accent, passed in as a prop.
export const settingsStyles = StyleSheet.create({
  screen: {
    flex: 1,
    // Transparent -- AppBackgroundLayer (mounted once behind the navigator)
    // paints the selected Background Theme; screens no longer hardcode it.
    backgroundColor: 'transparent',
  },
  // ScrollView defaults to flexGrow: 1 internally -- without this explicit
  // `flex: 1` on the *component* (not just its contentContainerStyle), this
  // content area and the category tabs' own ScrollView (below) would both
  // compete for leftover vertical space on any category with short content,
  // stretching the tabs bar into tall ovals instead of leaving it compact.
  contentScroll: {
    flex: 1,
  },
  scrollContent: {
    paddingBottom: spacing.xxl,
  },
  // Category tabs, inset to the screen margin under the header.
  tabsWrap: {
    paddingHorizontal: spacing.xxl,
  },
  // Vertical rhythm between a category's sections.
  categoryGap: {
    gap: spacing.xxl,
  },
  loadingWrap: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
  },
  errorText: {
    ...typeScale.callout,
    color: colors.destructive,
    marginBottom: spacing.md,
  },

  // Category tabs. flexGrow: 0 keeps this ScrollView pinned to its own
  // content height regardless of how much space the category below it
  // leaves unclaimed. alignItems: 'center' is a second, independent guard --
  // a flex row's cross-axis (height) defaults to 'stretch', which would
  // otherwise stretch every pill to match whatever height this row ends up
  // with, even if that height were ever wrong again for some other reason.
  tabsScroll: {
    flexGrow: 0,
    marginBottom: spacing.xl,
  },
  tabsRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
  },
  tab: {
    paddingHorizontal: spacing.lg,
    paddingVertical: spacing.sm + 2,
    borderRadius: radii.pill,
    borderWidth: 1,
    borderColor: colors.glassBorder,
    overflow: 'hidden',
    // Centers a lone label (Settings' own tabs) exactly as before, and
    // centers an icon-above-label stack (a caller that opts into
    // CategoryTabs' optional `icon`, e.g. Progress) with a small gap
    // between them -- a no-op for text-only callers since gap has no
    // effect with a single child.
    alignItems: 'center',
    gap: spacing.xs,
  },
  tabLabel: {
    ...typeScale.callout,
    fontFamily: fonts.semibold,
    color: colors.textSecondary,
  },
  // Selection changes color only -- never size, weight, padding, or border
  // width, all of which stay identical to `tab`/`tabLabel` above so a
  // selected pill never grows relative to its own unselected size.
  tabLabelSelected: {
    color: colors.textPrimary,
  },

  section: {
    marginBottom: spacing.xxl,
  },
  cardLabel: {
    ...typeScale.secondary,
    fontFamily: fonts.display,
    color: colors.textMuted,
    textTransform: 'uppercase',
    letterSpacing: 1,
    marginBottom: spacing.md,
  },
  fieldSpacer: {
    height: spacing.lg,
  },

  // Rows shared by Account Actions / App / Notifications / Help
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.md,
    paddingVertical: spacing.md,
  },
  rowDivider: {
    borderTopWidth: 1,
    borderTopColor: colors.divider,
  },
  rowIconWrap: {
    width: 36,
    height: 36,
    borderRadius: radii.md,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: colors.surfaceRaised,
  },
  rowBody: {
    flex: 1,
  },
  rowTitle: {
    ...typeScale.body,
    fontFamily: fonts.semibold,
    color: colors.textPrimary,
  },
  rowTitleDestructive: {
    color: colors.destructive,
  },
  rowSubtitle: {
    ...typeScale.secondary,
    color: colors.textSecondary,
    marginTop: 2,
  },
  rowValue: {
    ...typeScale.secondary,
    color: colors.textSecondary,
    marginTop: 2,
  },
  swatch: {
    width: 32,
    height: 32,
    borderRadius: radii.pill,
    borderWidth: 1,
    borderColor: colors.border,
  },

  comingSoonBadge: {
    backgroundColor: colors.surfaceRaised,
  },
  comingSoonBadgeText: {
    color: colors.textMuted,
  },

  emptyWrap: {
    paddingVertical: spacing.xxxl,
  },

  headerSubtitle: {
    ...typeScale.body,
    color: colors.textSecondary,
  },
});
