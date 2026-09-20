// Exactly four Progress sections/tabs, per the current approved product
// scope -- History/Volume/Exercises/1 Rep Max/etc. are deliberately not
// here; do not add placeholder tabs for them ahead of time.
export const PROGRESS_SECTIONS = [
  { key: 'Overview', label: 'Overview', icon: 'bar-chart-2' },
  { key: 'TopSets', label: 'Top Sets', icon: 'target' },
  { key: 'Strength', label: 'Strength', icon: 'trending-up' },
  { key: 'AllTime', label: 'All Time', icon: 'calendar' },
] as const;

export type ProgressSection = (typeof PROGRESS_SECTIONS)[number]['key'];
