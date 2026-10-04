// How a source candidate is scored against what the user asked for. Deterministic and
// explainable: every score can be traced to the words that matched and the extra words that didn't.

import type { FoodQuery, SourceCandidate } from './source.interface';

/** At or above this, a candidate may be used without asking. */
export const AUTO_ACCEPT_SCORE = 0.85;
/** Below this, a candidate is not offered at all. Between the two, it is offered as a choice. */
export const CHOICE_MIN_SCORE = 0.5;
/** Two candidates from one source closer than this are ambiguous, so the user chooses. */
export const AMBIGUITY_MARGIN = 0.05;

/** How hard an extra name word lowers a score: a full penalty of this fraction when every name word is extra. */
const EXTRA_WORD_PENALTY = 0.5;

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
 * A food name split into its name words and its descriptors. Words in brackets, or after a
 * comma, describe the food ("Potato (baked)", "Egg, Large"): they count as matches but are not
 * extra words. Everything before them is the name itself ("Sweet Potato"), and a name word the
 * query didn't ask for is an extra word.
 */
export function splitName(name: string): { core: string[]; descriptors: string[] } {
  const bracketed = [...name.matchAll(/\(([^)]*)\)/g)].map((match) => match[1] ?? '');
  const withoutBrackets = name.replace(/\([^)]*\)/g, ' ');
  const [head = '', ...afterComma] = withoutBrackets.split(',');
  const core = tokenize(head);
  const descriptors = tokenize([...bracketed, ...afterComma].join(' '));
  if (core.length === 0) return { core: descriptors, descriptors: [] };
  return { core, descriptors };
}

/**
 * How well a candidate's name matches what was asked for, from 0 to 1.
 *
 * Recall: the share of the query's words the candidate contains, in its name or descriptors.
 * Extra words: the candidate's own name words the query didn't ask for. Each one lowers the
 * score, so "Big Mac" scores 1 against "Big Mac" and below it against "Big Mac Sauce". A
 * descriptor is never extra, so "potato" still matches "Potato (baked)" fully.
 */
export function nameScore(term: string, matchedName: string): number {
  const query = new Set(tokenize(term));
  if (query.size === 0) return 0;
  const { core, descriptors } = splitName(matchedName);
  const available = new Set([...core, ...descriptors]);
  if (available.size === 0) return 0;

  let shared = 0;
  for (const word of query) if (available.has(word)) shared += 1;
  const recall = shared / query.size;

  const coreWords = new Set(core);
  let extra = 0;
  for (const word of coreWords) if (!query.has(word)) extra += 1;
  const extraShare = coreWords.size === 0 ? 0 : extra / coreWords.size;

  return recall * (1 - EXTRA_WORD_PENALTY * extraShare);
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
  const ranked = candidates
    .map((candidate) => scoreCandidate(query, candidate))
    .filter((scored) => scored.score >= CHOICE_MIN_SCORE)
    .sort((a, b) => b.score - a.score);
  return withoutDuplicates(ranked);
}

/**
 * The same product listed more than once (a cached duplicate, the same name in another letter
 * case): a key from what the user would see, so the duplicates count as one choice.
 */
function duplicateKey(candidate: SourceCandidate): string {
  const basis = candidate.basis;
  const nutrients = basis.nutrients;
  const serving = basis.kind === 'per_100g' ? '100g' : `${basis.size} ${basis.unit}`;
  return [
    candidate.matchedName.trim().toLowerCase(),
    (candidate.brand ?? '').trim().toLowerCase(),
    serving,
    nutrients.calories,
    nutrients.proteinG,
    nutrients.carbsG,
    nutrients.fatG,
  ].join('|');
}

/** Drops later copies of a product already ranked higher, keeping the best-ranked one. */
export function withoutDuplicates(ranked: ScoredCandidate[]): ScoredCandidate[] {
  const seen = new Set<string>();
  return ranked.filter((scored) => {
    const key = duplicateKey(scored.candidate);
    if (seen.has(key)) return false;
    seen.add(key);
    return true;
  });
}
