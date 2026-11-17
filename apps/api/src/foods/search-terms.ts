// What a Search Food query is matched with. A query is cut into words the same way the AI
// resolver's scoring does (tokenize: lower case, plurals made singular), each word's spelling
// variants are added ("yoghurt" also finds "yogurt"), and every word is matched as a stem, so
// "potatoes" finds "Potato (baked)" and "Potatoes, raw" alike.

import { COOKING_STATE_WORDS } from '../nutrition-resolution/cooking';
import { tokenize } from '../nutrition-resolution/scoring';

/** The most words of a query that are matched against the database. */
export const MAX_SEARCH_WORDS = 4;

// Spellings that name the same food. The first of each group is the one names are compared in.
const VARIANT_GROUPS: readonly (readonly string[])[] = [
  ['yogurt', 'yoghurt', 'yogourt'],
  ['chili', 'chilli', 'chile'],
  ['donut', 'doughnut'],
  ['ketchup', 'catsup'],
  ['zucchini', 'courgette'],
  ['eggplant', 'aubergine'],
  ['shrimp', 'prawn'],
  ['oatmeal', 'porridge'],
  ['filet', 'fillet'],
  ['hamburger', 'burger'],
  ['cilantro', 'coriander'],
  ['garbanzo', 'chickpea'],
];

const CANONICAL = new Map<string, string>();
const VARIANTS = new Map<string, readonly string[]>();
for (const group of VARIANT_GROUPS) {
  for (const word of group) {
    CANONICAL.set(word, group[0]!);
    VARIANTS.set(word, group);
  }
}

/** A word as names are compared in: "yoghurt" is "yogurt". Unchanged when it has no variants. */
export function canonicalWord(word: string): string {
  return CANONICAL.get(word) ?? word;
}

/** Every spelling of a word, itself first. */
export function spellingsOf(word: string): readonly string[] {
  const group = VARIANTS.get(word);
  return group ? [word, ...group.filter((variant) => variant !== word)] : [word];
}

/**
 * The part of a word matched against a name, so a singular finds its plural too: "berry"
 * (from "berries") is matched as "berr", which finds "Berry" and "Strawberries"; "potato" finds
 * "Potatoes". Only letters and digits are kept, so it is safe inside a LIKE pattern.
 */
export function matchStem(word: string): string {
  const plain = word.replace(/[^a-z0-9]/g, '');
  if (plain.length > 3 && plain.endsWith('y')) return plain.slice(0, -1);
  // tokenize leaves "peaches" as "peache": the stem is "peach", which "Peach" has too.
  if (plain.length > 4 && /(ch|sh|x|z)e$/.test(plain)) return plain.slice(0, -1);
  return plain;
}

/** A search query, read for matching. */
export interface SearchTerms {
  /** The query's words, singular, in canonical spelling, at most MAX_SEARCH_WORDS. */
  words: string[];
  /** For each word, the stems to match it by: one per spelling. */
  stems: string[][];
  /** The preparation the query asks for ("baked", "raw"), if any. */
  cooking: string[];
}

export function searchTermsFor(query: string): SearchTerms {
  const words = [...new Set(tokenize(query).map(canonicalWord))]
    .filter((word) => matchStem(word).length > 0)
    .slice(0, MAX_SEARCH_WORDS);
  return {
    words,
    stems: words.map((word) => [...new Set(spellingsOf(word).map(matchStem))]),
    cooking: words.filter((word) => COOKING_STATE_WORDS.has(word)),
  };
}

/** Optimal string alignment distance: insertions, deletions, substitutions and swaps of two letters. */
export function editDistance(a: string, b: string): number {
  const rows = a.length + 1;
  const cols = b.length + 1;
  const d: number[][] = Array.from({ length: rows }, (_, i) =>
    Array.from({ length: cols }, (_, j) => (i === 0 ? j : j === 0 ? i : 0)),
  );
  for (let i = 1; i < rows; i += 1) {
    for (let j = 1; j < cols; j += 1) {
      const cost = a[i - 1] === b[j - 1] ? 0 : 1;
      d[i]![j] = Math.min(d[i - 1]![j]! + 1, d[i]![j - 1]! + 1, d[i - 1]![j - 1]! + cost);
      if (i > 1 && j > 1 && a[i - 1] === b[j - 2] && a[i - 2] === b[j - 1]) {
        d[i]![j] = Math.min(d[i]![j]!, d[i - 2]![j - 2]! + 1);
      }
    }
  }
  return d[a.length]![b.length]!;
}

/** How far a word may be from the one it's corrected to: none under 4 letters, one up to 5, two past. */
function allowedDistance(word: string): number {
  if (word.length < 4) return 0;
  return word.length <= 5 ? 1 : 2;
}

/**
 * The closest known word to a misspelt one ("brocoli" -> "broccoli"), or null when the word is
 * known already or nothing is close enough. Among equally close words the most common wins.
 * Only ever used when the query as typed found nothing.
 */
export function correctWord(word: string, vocabulary: ReadonlyMap<string, number>): string | null {
  if (vocabulary.has(word)) return null;
  const limit = allowedDistance(word);
  if (limit === 0) return null;
  let best: { word: string; distance: number; count: number } | null = null;
  for (const [candidate, count] of vocabulary) {
    if (Math.abs(candidate.length - word.length) > limit) continue;
    // The first letter is almost always typed right; checking it first keeps this quick.
    if (candidate[0] !== word[0]) continue;
    const distance = editDistance(word, candidate);
    if (distance > limit) continue;
    if (
      best === null ||
      distance < best.distance ||
      (distance === best.distance && count > best.count)
    ) {
      best = { word: candidate, distance, count };
    }
  }
  return best?.word ?? null;
}
