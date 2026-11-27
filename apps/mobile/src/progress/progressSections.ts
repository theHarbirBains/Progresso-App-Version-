import { Platform } from 'react-native';
import { HEALTH_PREVIEW_ENABLED } from '../health/preview/healthPreview';

// Progress's sections/tabs, per the current approved product scope --
// Strength (removed: Progress has no line graphs), History/Volume/
// Exercises/1 Rep Max/etc. are deliberately not here; do not add
// placeholder tabs for them ahead of time. Nutrition is All Time's second
// tab (ProgressOverviewScreen), not a section of its own. Cardio is the
// cardio in the person's own workouts (CardioProgressSection). Steps (from
// Apple Health) is iPhone only, and only ever the person's own -- a trainer's
// view of a client has no Steps tab (see TrainerClientDetailScreen), and no
// Cardio tab yet. Muscles is Muscle Activity (MuscleActivitySection), the
// person's own too.
export const PROGRESS_SECTIONS = [
  { key: 'Overview', label: 'Overview', icon: 'bar-chart-2' },
  { key: 'TopSets', label: 'Top Sets', icon: 'target' },
  { key: 'Muscles', label: 'Muscles', icon: 'user' },
  { key: 'Cardio', label: 'Cardio', icon: 'activity' },
  { key: 'AllTime', label: 'All Time', icon: 'calendar' },
  { key: 'Steps', label: 'Steps', icon: 'trending-up' },
  // PHASE 1 PROTOTYPE (Harbir's Health & Wearables brief): sample data, shown only in development
  // builds (ownProgressSections) -- never on TestFlight or the App Store.
  { key: 'Health', label: 'Health', icon: 'heart' },
] as const;

export type ProgressSection = (typeof PROGRESS_SECTIONS)[number]['key'];

/**
 * The person's own Progress tabs: Steps only where Apple Health can be (iPhone), and Health -- a
 * prototype for now -- only in development builds.
 */
export function ownProgressSections(healthPreview = HEALTH_PREVIEW_ENABLED) {
  return PROGRESS_SECTIONS.filter(
    (section) =>
      (section.key !== 'Steps' || Platform.OS === 'ios') &&
      (section.key !== 'Health' || healthPreview),
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
