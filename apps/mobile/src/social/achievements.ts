import type { Feather } from '@expo/vector-icons';
import type { ProfileStats } from '../lib/api';
import { fromKg } from '../lib/units';

// A profile's badges (PersonProfileScreen's Achievements): worked out from the figures the profile
// already has, never stored. Milestones in workouts finished, records held and weight lifted in
// all, and Consistency -- a month with 12 workouts in it. No streaks: missing a day or a week
// never takes one away.

export type BadgeKind = 'workouts' | 'consistency' | 'prs' | 'lifted';

export interface Badge {
  id: string;
  kind: BadgeKind;
  /** Under the badge, and in the list: "100 Workouts". */
  title: string;
  /** Inside the badge, under its glyph: "100", "1M". Null for one with no figure. */
  short: string | null;
  icon: keyof typeof Feather.glyphMap;
  /** What it takes, in the list: "Finish 100 workouts". */
  requirement: string;
  earned: boolean;
}

const WORKOUTS = [10, 50, 100, 250, 500];
const PRS = [1, 10, 50, 100];
/** Weight lifted in all, in the unit the person reads weights in. */
const LIFTED = { lb: [100_000, 500_000, 1_000_000], kg: [50_000, 250_000, 500_000] };
const CONSISTENCY_WORKOUTS = 12;

/** 42800 -> "42.8K", 1250000 -> "1.25M", 950 -> "950". */
export function compactNumber(value: number): string {
  const whole = Math.floor(value);
  const trim = (n: number, digits: number) => String(Number(n.toFixed(digits)));
  if (whole >= 1_000_000) return `${trim(whole / 1_000_000, 2)}M`;
  if (whole >= 1_000) return `${trim(whole / 1_000, 1)}K`;
  return String(whole);
}

/** Every badge, in order -- kind by kind, smallest first -- each earned or not. */
export function badgesFor(stats: ProfileStats, unit: 'kg' | 'lb'): Badge[] {
  const lifted = fromKg(stats.totalVolumeKg, unit);
  return [
    ...WORKOUTS.map((n): Badge => ({
      id: `workouts-${n}`,
      kind: 'workouts',
      title: `${n} Workouts`,
      short: String(n),
      icon: 'activity',
      requirement: `Finish ${n} workouts`,
      earned: stats.workouts >= n,
    })),
    {
      id: 'consistency',
      kind: 'consistency',
      title: 'Consistency',
      short: null,
      icon: 'zap',
      requirement: `Finish ${CONSISTENCY_WORKOUTS} workouts in one month`,
      earned: stats.bestMonthWorkouts >= CONSISTENCY_WORKOUTS,
    },
    ...PRS.map((n): Badge => ({
      id: `prs-${n}`,
      kind: 'prs',
      title: n === 1 ? 'First PR' : `${n} PRs`,
      short: n === 1 ? 'PR' : String(n),
      icon: 'award',
      requirement: n === 1 ? 'Set a personal record' : `Hold ${n} personal records`,
      earned: stats.prCount >= n,
    })),
    ...LIFTED[unit].map((n): Badge => ({
      id: `lifted-${unit}-${n}`,
      kind: 'lifted',
      title: `${compactNumber(n)} ${unit} Lifted`,
      short: compactNumber(n),
      icon: 'layers',
      requirement: `Lift ${compactNumber(n)} ${unit} in all`,
      earned: lifted >= n,
    })),
  ];
}

const KINDS: BadgeKind[] = ['workouts', 'consistency', 'prs', 'lifted'];

/**
 * The few shown on the profile: the best earned of each kind, then -- while there's room -- the
 * next one to earn of each kind, so a new profile still shows what's ahead.
 */
export function featuredBadges(all: Badge[], max = 5): Badge[] {
  const best = KINDS.map((kind) => all.filter((b) => b.kind === kind && b.earned).at(-1)).filter(
    (b): b is Badge => b !== undefined,
  );
  const next = KINDS.map((kind) => all.find((b) => b.kind === kind && !b.earned)).filter(
    (b): b is Badge => b !== undefined,
  );
  return [...best, ...next].slice(0, max);
}
