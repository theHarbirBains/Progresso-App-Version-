import { StyleSheet } from 'react-native';
import { colors, spacing, typeScale, widgetGap } from '../design/theme';

// FeedScreen. Token-only. The frame (safe area, header, scrolling body) is
// the shared `Screen`; each feed item is its own widget (the redesign's flat
// `Card`, design/Card.tsx -- the first screen on the new system; every other
// screen still uses `AppCard`), so this holds only what's inside a card.
//
// Card anatomy (byline row -> bold title -> stat strip) mirrors Strava's
// activity-card structure -- see DESIGN.md's Feed section. Regular cards
// stay black-and-white/monochrome (textPrimary/textSecondary/textMuted
// only) -- restrained accent use is the point: the one Next Workout hero is
// the only place accent appears, filled solid rather than every card
// carrying a tinted band.
export const feedStyles = StyleSheet.create({
  content: {
    gap: widgetGap,
  },
  loading: {
    paddingVertical: spacing.xxl,
  },
  // "Get Started" (the empty-state actions card's header) sits directly on
  // the screen, not inside a card -- same explicit 6px gutter call as
  // NotificationsScreen's own section headers.
  sectionHeaderWrap: {
    paddingHorizontal: 6,
  },

  // The "Next Workout" widget pinned above everything else -- the redesign's
  // one bold hero, filled solid with the mode accent (see Card's `heroColor`)
  // rather than a neutral surface, so these are layout-only: color comes
  // from `theme.onAccent` at render time (FeedScreen), since it has to
  // invert for a light vs. dark accent.
  nextWorkoutEyebrow: {
    ...typeScale.sectionHeading,
    marginBottom: spacing.xs,
  },
  nextWorkoutDayName: {
    ...typeScale.screenTitle,
  },
  nextWorkoutMuscles: {
    ...typeScale.secondary,
    marginTop: 2,
  },
  nextWorkoutMeta: {
    ...typeScale.secondary,
    marginTop: spacing.sm,
  },
  nextWorkoutAction: {
    marginTop: spacing.lg,
  },

  // The byline: a small avatar, the account's own name, and a quiet
  // icon+timestamp line underneath -- Strava's "who, when" row, without the
  // social graph (it's always the signed-in user).
  metaRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.md,
    marginBottom: spacing.md,
  },
  avatarWrap: {
    width: 32,
    height: 32,
    borderRadius: 16,
    backgroundColor: colors.surfaceRaised,
    alignItems: 'center',
    justifyContent: 'center',
    overflow: 'hidden',
  },
  avatarInitial: {
    ...typeScale.label,
    color: colors.textSecondary,
  },
  metaBody: {
    flex: 1,
  },
  metaName: {
    ...typeScale.label,
    color: colors.textPrimary,
  },
  metaSubRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.xs,
    marginTop: 2,
  },
  metaTimestamp: {
    ...typeScale.caption,
    color: colors.textMuted,
  },

  itemTitle: {
    ...typeScale.screenTitle,
    color: colors.textPrimary,
    flex: 1,
  },
  itemSubtitle: {
    ...typeScale.secondary,
    color: colors.textSecondary,
    marginTop: 2,
    marginBottom: spacing.md,
  },

  // A workout card's stat area: two rows of two StatBlocks (Duration/
  // Exercises, Sets/Volume) -- the same 2x2 grid WorkoutDetailScreen's own
  // hero summary uses, rather than a single cramped 3-across row, so a
  // fourth genuinely useful number (Exercises) fits without crowding.
  statGrid: {
    gap: widgetGap,
    marginTop: spacing.md,
  },
  statRow: {
    flexDirection: 'row',
    gap: widgetGap,
  },
});
