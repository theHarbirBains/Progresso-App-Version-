import { Platform } from 'react-native';
import { HEALTH_PREVIEW_ENABLED } from '../health/preview/healthPreview';

// Progress's sections/tabs, per the current approved product scope --
// Strength (removed: Progress has no line graphs), History/Volume/
// Exercises/1 Rep Max/etc. are deliberately not here; do not add
// placeholder tabs for them ahead of time. All Time and Nutrition are
// Overview's views (ProgressOverviewScreen), not tabs of their own. Cardio is
// the cardio in the person's own workouts (CardioProgressSection). Steps (from
// Apple Health) are Health's, iPhone only, and only ever the person's own -- a
// trainer's view of a client has no Health tab (see TrainerClientDetailScreen),
// and no Cardio tab yet; 'Steps' stays a key so a link asking for it opens
// Health. Muscles is Muscle Activity (MuscleActivitySection), the person's own
// too.
export const PROGRESS_SECTIONS = [
  { key: 'Overview', label: 'Overview', icon: 'bar-chart-2' },
  { key: 'TopSets', label: 'Top Sets', icon: 'target' },
  { key: 'Muscles', label: 'Muscles', icon: 'user' },
  { key: 'Cardio', label: 'Cardio', icon: 'activity' },
  { key: 'AllTime', label: 'All Time', icon: 'calendar' },
  { key: 'Steps', label: 'Steps', icon: 'trending-up' },
  // Health: the person's Apple Health steps (what was the Steps tab -- Harbir's call, November
  // 2026), and in development builds a way into the Health prototype (Phase 1, sample data).
  { key: 'Health', label: 'Health', icon: 'heart' },
] as const;

export type ProgressSection = (typeof PROGRESS_SECTIONS)[number]['key'];

/**
 * The person's own Progress tabs (Harbir asked for a leaner Progress, November 2026): no All Time
 * tab -- All Time is part of Overview (its This Week / All Time / Nutrition switch) -- and no Steps
 * tab: steps are Health's, a tab only where Apple Health can be (iPhone), or in a development build
 * for the Health prototype. A link asking for Steps opens Health. A trainer's view of a client
 * keeps its own tabs.
 */
export function ownProgressSections(healthPreview = HEALTH_PREVIEW_ENABLED) {
  return PROGRESS_SECTIONS.filter(
    (section) =>
      section.key !== 'AllTime' &&
      section.key !== 'Steps' &&
      (section.key !== 'Health' || Platform.OS === 'ios' || healthPreview),
  );
}

/**
 * A trainer's view of a client's Progress: never Steps -- they're on the client's phone only --
 * and no Cardio or Muscles tab yet.
 */
export const CLIENT_PROGRESS_SECTIONS = PROGRESS_SECTIONS.filter(
  (section) =>
    section.key !== 'Steps' &&
    section.key !== 'Cardio' &&
    section.key !== 'Muscles' &&
    section.key !== 'Health',
);
