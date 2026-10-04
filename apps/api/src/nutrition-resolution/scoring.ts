// How a source candidate is scored against what the user asked for. Deterministic and
// explainable: every score can be traced to the words that matched.

import type { FoodQuery, SourceCandidate } from './source.interface';

/** At or above this, a candidate may be used without asking. */
export const AUTO_ACCEPT_SCORE = 0.85;
/** Below this, a candidate is not offered at all. Between the two, it is offered as a choice. */
export const CHOICE_MIN_SCORE = 0.5;
/** Two candidates from one source closer than this are ambiguous, so the user chooses. */
export const AMBIGUITY_MARGIN = 0.05;

const STOP_WORDS = new Set(['a', 'an', 'and', 'of', 'the', 'with', 'in', 'on', 'for']);

/** Lower-case word tokens with basic singularisation, so "potatoes" matches "potato". */
export function tokenize(text: string): string[] {
  return text
    .toLowerCase()
    .replace(/[^a-z0-9%\s]/g, ' ')
    .split(/\s+/)
    .filter((word) => word.length > 0 && !STOP_WORDS.has(word))
    .map(singular);
}

function singular(word: string): string {
  if (word.length > 4 && word.endsWith('ies')) return `${word.slice(0, -3)}y`;
  if (word.length > 3 && word.endsWith('oes')) return word.slice(0, -2);
  if (word.length > 3 && word.endsWith('s') && !word.endsWith('ss')) return word.slice(0, -1);
  return word;
}

/**
 * How well a candidate's name covers the query's words. Recall (how much of
 * what was asked for appears) counts more than precision (how much extra the
 * candidate carries), so "potato" matches "Potato (baked)" well but "Sweet
 * Potato (baked)" only partly.
 */
export function nameScore(term: string, matchedName: string): number {
  const query = new Set(tokenize(term));
  const candidate = new Set(tokenize(matchedName));
  if (query.size === 0 || candidate.size === 0) return 0;

  let shared = 0;
  for (const word of query) if (candidate.has(word)) shared += 1;
  const recall = shared / query.size;
  const precision = shared / candidate.size;
  return 0.75 * recall + 0.25 * precision;
}

/**
 * A brand the user named must appear on the candidate. Absent a named brand,
 * brand is not a factor. A named brand that doesn't match scores zero, so a
 * branded query never silently resolves to a different product.
 */
export function brandScore(queryBrand: string | null, candidateBrand: string | null): number {
  if (!queryBrand) return 1;
  if (!candidateBrand) return 0;
  const wanted = tokenize(queryBrand).join(' ');
  const actual = tokenize(candidateBrand).join(' ');
  return wanted.length > 0 && actual.includes(wanted) ? 1 : 0;
}

export interface ScoredCandidate {
  candidate: SourceCandidate;
  score: number;
  reasons: string[];
}

/**
 * Scores one candidate. A barcode that matches exactly is conclusive. Otherwise
 * the name score is multiplied by the brand score, so a missing named brand
 * pulls the result below the auto-accept line.
 */
export function scoreCandidate(query: FoodQuery, candidate: SourceCandidate): ScoredCandidate {
  if (query.barcode && candidate.barcode === query.barcode) {
    return { candidate, score: 1, reasons: ['barcode matched exactly'] };
  }
  const name = nameScore(query.term, candidate.matchedName);
  const brand = brandScore(query.brand, candidate.brand);
  const reasons: string[] = [];
  if (name === 1) reasons.push('name matched exactly');
  else reasons.push(`name covers ${Math.round(name * 100)}% of the request`);
  if (query.brand)
    reasons.push(brand === 1 ? `brand "${query.brand}" matched` : 'brand not matched');
  return { candidate, score: name * brand, reasons };
}

/** Best first. Ties keep the source's own order. */
export function rankCandidates(query: FoodQuery, candidates: SourceCandidate[]): ScoredCandidate[] {
  return candidates
    .map((candidate) => scoreCandidate(query, candidate))
    .filter((scored) => scored.score >= CHOICE_MIN_SCORE)
    .sort((a, b) => b.score - a.score);
}
