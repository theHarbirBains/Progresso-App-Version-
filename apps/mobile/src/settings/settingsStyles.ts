import { StyleSheet } from 'react-native';
import { colors, fonts, radii, spacing, typeScale } from '../design/theme';

// Shared styles for the Settings hub (root list + every subpage). Settings
// is app-level/global, not a per-mode screen, so unlike Dashboard/Progress
// it has no independent theme concept of its own -- the one dynamic color
// used here (primary buttons) is always the user's Workout accent, passed
// in as a prop.
export const settingsStyles = StyleSheet.create({
  screen: {
    flex: 1,
    // Transparent -- the warm background (photo included) is painted once,
    // behind every screen; screens never hardcode it.
    backgroundColor: 'transparent',
  },
  contentScroll: {
    flex: 1,
  },
  scrollContent: {
    paddingBottom: spacing.xxl,
  },
  // Vertical rhythm between a subpage's sections, plus the screen gutter
  // every subpage needs -- Settings deliberately stays flat rows, not
  // AppCard widgets (see DESIGN.md's own Settings entry), so unlike a
  // card's own spacing.lg internal padding, nothing else in the chain
  // (Screen's intentionally edge-to-edge body, Section, ListRow) was ever
  // giving row text/icons a gutter of their own -- same class of bug as
  // AppHeader's, fixed the same way: spacing.xxl on both sides.
  categoryGap: {
    gap: spacing.xxl,
    paddingHorizontal: spacing.xxl,
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

  // Rows shared by every Settings subpage
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
