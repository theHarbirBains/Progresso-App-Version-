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
  // The greeting at the top (feed/FeedGreeting.tsx): straight on the photo, its words lined up
  // with the cards' own text below it, and a little more room under it than between widgets.
  greeting: {
    paddingHorizontal: spacing.lg,
    paddingTop: spacing.xs,
    paddingBottom: spacing.sm,
  },
  // With the Daily Steps widget beside it: the words take the rest of the row, the widget its
  // own width on the right, the two centred on each other.
  greetingRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.md,
    paddingRight: 0,
  },
  greetingWords: {
    flex: 1,
    minWidth: 0,
  },
  // The headline, and the holidays' star beside it.
  greetingHeadlineRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
  },
  greetingHeadline: {
    ...typeScale.screenTitle,
    flexShrink: 1,
  },
  greetingLine: {
    ...typeScale.body,
    marginTop: 2,
  },
  // "Get Started" (the empty-state actions card's header) sits directly on
  // the screen, not inside a card -- same explicit 6px gutter call as
  // NotificationsScreen's own section headers.
  sectionHeaderWrap: {
    paddingHorizontal: 6,
  },

  // The "Next Workout" widget pinned above everything else -- the redesign's
  // one bold hero, a photo `hero` Card (the warm gym photo) rather than a
  // neutral surface, so these are layout-only: color comes from
  // `colors.textPrimary` at render time (FeedScreen), off-white over the
  // photo's darkened text side.
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

  // The byline: the author's photo (44pt, big enough to tell who it is at a glance), their name,
  // and a quiet icon+timestamp line underneath -- Strava's "who, when" row.
  metaRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.md,
    marginBottom: spacing.md,
  },
  // The byline's avatar and name, which open its person's profile.
  authorTap: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.md,
  },
  avatarWrap: {
    width: 44,
    height: 44,
    borderRadius: 22,
    backgroundColor: colors.surfaceRaised,
    alignItems: 'center',
    justifyContent: 'center',
    overflow: 'hidden',
  },
  avatarInitial: {
    ...typeScale.cardTitle,
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
  statRow: {
    flexDirection: 'row',
    gap: widgetGap,
  },
});
