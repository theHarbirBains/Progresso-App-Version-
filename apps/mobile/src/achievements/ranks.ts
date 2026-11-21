import { rankPalettes } from '../design/theme';

// Lifetime ranks: worked out from lifetime Achievement Points (the sum of a person's awards) --
// no decay, no seasons; only taking back what's logged (a workout deleted or corrected) takes
// back the levels it earned, and the rank can drop with them. Nine tiers, each
// split into five divisions from V (lowest) to I; Legacy's are 2,000 AP each, and past Legacy I
// every further 2,000 AP is another Legacy level.

export type TierId =
  | 'bronze'
  | 'silver'
  | 'gold'
  | 'platinum'
  | 'diamond'
  | 'vanguard'
  | 'titan'
  | 'sovereign'
  | 'legacy';

export interface Tier {
  id: TierId;
  name: string;
  /** The AP the tier starts at. */
  floor: number;
  /** Each division's width in AP. */
  step: number;
  palette: { primary: string; deep: string };
}

// Balanced against the catalogue (npm run db:simulate): Bronze to Diamond come with steady
// training in the first year or two; Vanguard, Titan and Sovereign take years; Legacy about four
// for someone training five or six times a week, and longer for most.
export const TIERS: readonly Tier[] = [
  { id: 'bronze', name: 'Bronze', floor: 0, step: 150, palette: rankPalettes.bronze },
  { id: 'silver', name: 'Silver', floor: 750, step: 250, palette: rankPalettes.silver },
  { id: 'gold', name: 'Gold', floor: 2_000, step: 400, palette: rankPalettes.gold },
  { id: 'platinum', name: 'Platinum', floor: 4_000, step: 600, palette: rankPalettes.platinum },
  { id: 'diamond', name: 'Diamond', floor: 7_000, step: 800, palette: rankPalettes.diamond },
  { id: 'vanguard', name: 'Vanguard', floor: 11_000, step: 1_000, palette: rankPalettes.vanguard },
  { id: 'titan', name: 'Titan', floor: 16_000, step: 1_200, palette: rankPalettes.titan },
  {
    id: 'sovereign',
    name: 'Sovereign',
    floor: 22_000,
    step: 1_600,
    palette: rankPalettes.sovereign,
  },
  { id: 'legacy', name: 'Legacy', floor: 30_000, step: 2_000, palette: rankPalettes.legacy },
];

/** Lowest first: V, IV, III, II, I. */
export const DIVISIONS = ['V', 'IV', 'III', 'II', 'I'] as const;
export type Division = (typeof DIVISIONS)[number];

export interface Rank {
  tierIndex: number;
  tier: Tier;
  /** 0 for V up to 4 for I. */
  divisionIndex: number;
  division: Division;
  /** Past Legacy I, how many Legacy levels: 1 at Legacy I itself. Null below Legacy I. */
  legacyLevel: number | null;
  /** "Gold II", "Legacy I", "Legacy I · 3". */
  label: string;
  points: number;
  /** Where this division (or Legacy level) starts, and where the next one does. */
  from: number;
  to: number;
  /** Toward the next division, 0 to 1. */
  progress: number;
}

/** A division's (or a Legacy level's) starting AP. */
export function divisionFloor(tierIndex: number, divisionIndex: number): number {
  const tier = TIERS[tierIndex]!;
  return tier.floor + tier.step * divisionIndex;
}

/** The rank lifetime AP has reached. */
export function rankForPoints(points: number): Rank {
  const ap = Math.max(0, Math.floor(Number.isFinite(points) ? points : 0));
  let tierIndex = 0;
  TIERS.forEach((tier, index) => {
    if (ap >= tier.floor) tierIndex = index;
  });
  const tier = TIERS[tierIndex]!;
  const steps = Math.floor((ap - tier.floor) / tier.step);
  const divisionIndex = Math.min(DIVISIONS.length - 1, steps);
  const top = tierIndex === TIERS.length - 1 && steps >= DIVISIONS.length - 1;
  const legacyLevel = top ? steps - (DIVISIONS.length - 1) + 1 : null;
  const from = tier.floor + tier.step * (top ? steps : divisionIndex);
  const lastOfTier = divisionIndex === DIVISIONS.length - 1;
  const to = top ? from + tier.step : lastOfTier ? TIERS[tierIndex + 1]!.floor : from + tier.step;
  const division = DIVISIONS[divisionIndex]!;
  return {
    tierIndex,
    tier,
    divisionIndex,
    division,
    legacyLevel,
    label: `${tier.name} ${division}${legacyLevel && legacyLevel > 1 ? ` · ${legacyLevel}` : ''}`,
    points: ap,
    from,
    to,
    progress: Math.min(1, Math.max(0, (ap - from) / (to - from))),
  };
}

/** "Gold I" -- the rank just after this one (a Legacy level past Legacy I). */
export function nextRankLabel(rank: Rank): string {
  return rankForPoints(rank.to).label;
}
