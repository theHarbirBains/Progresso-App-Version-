export const PROGRESS_SECTIONS = [
  { key: 'Overview', label: 'Overview' },
  { key: 'Strength', label: 'Strength' },
  { key: 'PRs', label: 'PRs' },
  { key: 'Exercises', label: 'Exercises' },
  { key: 'TopSets', label: 'Top Sets' },
  { key: 'OneRepMax', label: '1 Rep Max' },
] as const;

export type ProgressSection = (typeof PROGRESS_SECTIONS)[number]['key'];
