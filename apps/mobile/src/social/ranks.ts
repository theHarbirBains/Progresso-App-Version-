import { rankColors } from '../design/theme';

// The nine ranks every achievement climbs, lowest first -- each with its own colour
// (design/theme.ts's rankColors).

export type RankId =
  | 'bronze'
  | 'silver'
  | 'gold'
  | 'platinum'
  | 'diamond'
  | 'vanguard'
  | 'titan'
  | 'sovereign'
  | 'legacy';

export interface Rank {
  id: RankId;
  name: string;
  color: string;
}

export const RANKS: readonly Rank[] = [
  { id: 'bronze', name: 'Bronze', color: rankColors.bronze },
  { id: 'silver', name: 'Silver', color: rankColors.silver },
  { id: 'gold', name: 'Gold', color: rankColors.gold },
  { id: 'platinum', name: 'Platinum', color: rankColors.platinum },
  { id: 'diamond', name: 'Diamond', color: rankColors.diamond },
  { id: 'vanguard', name: 'Vanguard', color: rankColors.vanguard },
  { id: 'titan', name: 'Titan', color: rankColors.titan },
  { id: 'sovereign', name: 'Sovereign', color: rankColors.sovereign },
  { id: 'legacy', name: 'Legacy', color: rankColors.legacy },
];

/** The highest rank's index: Legacy. */
export const TOP_RANK = RANKS.length - 1;

/** From Platinum up, a badge wears a second, inner outline. */
export const DOUBLE_OUTLINE_FROM = 3;
