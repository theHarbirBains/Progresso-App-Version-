// Resolves one food component against an ordered list of sources. The caller supplies the
// order (catalog first, then barcode, branded, chain, generic). The resolver never decides
// for the user when it is unsure.

import { scaleFor, scaleNutrients, type Amount } from './quantity';
import {
  AMBIGUITY_MARGIN,
  AUTO_ACCEPT_SCORE,
  rankCandidates,
  type ScoredCandidate,
} from './scoring';
import type {
  FoodQuery,
  NutritionSource,
  Provenance,
  ResolvedComponent,
  SourceCandidate,
  SourceKind,
} from './source.interface';

/** The caveat attached to every Progresso catalog result: the seeded values' original source isn't recorded. */
export const CATALOG_ORIGIN_ASSUMPTION =
  'Progresso catalog figures; the original source of these values is not recorded.';

export interface ComponentInput {
  name: string;
  query: FoodQuery;
  /** Null when the user gave no amount. The resolver then asks, and never assumes one. */
  quantity: Amount | null;
  /**
   * The candidate the user picked from a choice list. When set, only that candidate is
   * considered, so the user's choice resolves the component without restarting the search.
   */
  pick?: { sourceKind: SourceKind; sourceId: string } | null;
}

export interface QuantityOption {
  label: string;
  amount: number;
  unit: string;
}

export interface Choice {
  sourceKind: SourceKind;
  sourceId: string;
  matchedName: string;
  brand: string | null;
  score: number;
  reasons: string[];
}

export type ResolutionOutcome =
  | { status: 'resolved'; component: ResolvedComponent }
  | {
      status: 'needs_quantity';
      name: string;
      matchedName: string;
      options: QuantityOption[];
      reason: string;
    }
  | { status: 'choose'; name: string; choices: Choice[] }
  | { status: 'not_found'; name: string };

/** A source that throws is skipped, not fatal: the next source still gets its turn. */
async function searchSafely(source: NutritionSource, query: FoodQuery): Promise<SourceCandidate[]> {
  try {
    return await source.search(query);
  } catch {
    return [];
  }
}

/** The amounts a user can pick from when theirs can't be used: the source's own basis, then its published measures. */
export function quantityOptionsFor(candidate: SourceCandidate): QuantityOption[] {
  const basis =
    candidate.basis.kind === 'per_100g'
      ? { label: '100 g', amount: 100, unit: 'g' }
      : {
          label: `1 serving (${candidate.basis.size} ${candidate.basis.unit})`,
          amount: candidate.basis.size,
          unit: candidate.basis.unit,
        };
  return [
    basis,
    ...candidate.measures.map((measure) => ({
      label: `${measure.amount} ${measure.unit}`,
      amount: measure.amount,
      unit: measure.unit,
    })),
  ];
}

function provenanceFor(
  candidate: SourceCandidate,
  source: NutritionSource,
  exact: boolean,
  assumptions: string[],
): Provenance {
  const allAssumptions =
    candidate.sourceKind === 'progresso_catalog'
      ? [CATALOG_ORIGIN_ASSUMPTION, ...assumptions]
      : assumptions;
  return {
    confidence: exact ? 'verified' : 'calculated',
    sourceKind: candidate.sourceKind,
    sourceId: candidate.sourceId,
    matchedName: candidate.matchedName,
    brand: candidate.brand,
    dataVersion: candidate.dataVersion,
    retrievedAt: candidate.retrievedAt,
    licence: source.licence,
    attribution: source.attribution(candidate),
    assumptions: allAssumptions,
  };
}

function chooseOutcome(name: string, ranked: ScoredCandidate[]): ResolutionOutcome {
  return {
    status: 'choose',
    name,
    choices: ranked.slice(0, 3).map((scored) => ({
      sourceKind: scored.candidate.sourceKind,
      sourceId: scored.candidate.sourceId,
      matchedName: scored.candidate.matchedName,
      brand: scored.candidate.brand,
      score: scored.score,
      reasons: scored.reasons,
    })),
  };
}

/** Only the candidate the user picked, scored as conclusive. Empty when that source no longer offers it. */
function pinnedRanking(
  pick: { sourceKind: SourceKind; sourceId: string },
  candidates: SourceCandidate[],
): ScoredCandidate[] {
  const match = candidates.find(
    (candidate) => candidate.sourceKind === pick.sourceKind && candidate.sourceId === pick.sourceId,
  );
  if (!match) return [];
  return [{ candidate: match, score: 1, reasons: ['chosen by you'] }];
}

/**
 * Resolves one component. Sources are tried in the order given. The first unambiguous match
 * at or above AUTO_ACCEPT_SCORE wins. If none is unambiguous, the best-ranked choices from the
 * highest-priority source that had any are returned for the user to pick. Two close candidates
 * are never picked between silently.
 */
export async function resolveComponent(
  input: ComponentInput,
  sources: NutritionSource[],
): Promise<ResolutionOutcome> {
  let firstWithChoices: ScoredCandidate[] | null = null;
  let firstNeedsQuantity: ResolutionOutcome | null = null;
  const pick = input.pick ?? null;

  for (const source of sources) {
    const candidates = await searchSafely(source, input.query);
    const ranked = pick ? pinnedRanking(pick, candidates) : rankCandidates(input.query, candidates);
    if (ranked.length === 0) continue;

    const top = ranked[0]!;
    const second = ranked[1];
    const unambiguous =
      pick !== null ||
      (top.score >= AUTO_ACCEPT_SCORE && (!second || top.score - second.score >= AMBIGUITY_MARGIN));

    if (!unambiguous) {
      // A strong but ambiguous set stops the search: the user chooses among the closest real
      // matches, rather than a weaker source silently taking over. A weak set is only a fallback.
      if (top.score >= AUTO_ACCEPT_SCORE) return chooseOutcome(input.name, ranked);
      firstWithChoices ??= ranked;
      continue;
    }

    const needs = (reason: string): ResolutionOutcome => ({
      status: 'needs_quantity',
      name: input.name,
      matchedName: top.candidate.matchedName,
      options: quantityOptionsFor(top.candidate),
      reason,
    });

    if (input.quantity === null) return needs('no amount given');

    const scale = scaleFor(input.quantity, top.candidate);
    if (!scale.ok) {
      // This source can't express the amount for this food. A later source may: USDA publishes
      // a cup weight that a catalog serving in grams does not. Keep looking, and remember this.
      firstNeedsQuantity ??= needs(
        scale.reason === 'ambiguous_count'
          ? `"${input.quantity.unit}" doesn't name a size`
          : `"${input.quantity.unit}" can't be converted for this food`,
      );
      continue;
    }

    const assumptions: string[] = [];
    if (scale.via === 'measure') {
      assumptions.push(
        `Used the ${top.candidate.sourceKind} weight for "${input.quantity.unit}" of this food.`,
      );
    }
    return {
      status: 'resolved',
      component: {
        name: input.name,
        quantity: input.quantity,
        grams: scale.grams,
        nutrients: scaleNutrients(top.candidate.basis.nutrients, scale.factor),
        provenance: provenanceFor(top.candidate, source, scale.exact, assumptions),
      },
    };
  }

  if (firstNeedsQuantity) return firstNeedsQuantity;

  if (firstWithChoices) {
    return {
      status: 'choose',
      name: input.name,
      choices: firstWithChoices.slice(0, 3).map((scored) => ({
        sourceKind: scored.candidate.sourceKind,
        sourceId: scored.candidate.sourceId,
        matchedName: scored.candidate.matchedName,
        brand: scored.candidate.brand,
        score: scored.score,
        reasons: scored.reasons,
      })),
    };
  }
  return { status: 'not_found', name: input.name };
}
