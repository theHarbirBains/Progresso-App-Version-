// How Search Food orders what it finds. Every food is scored against the query the same way
// whichever source it came from, so a plain whole food ("Onions, raw") comes before a product
// that only mentions it ("Sour Cream & Onion Chips"). Deterministic: each part of a score can be
// traced to a word that matched, a word that didn't, or what kind of food it is.

import { splitName, tokenize } from '../nutrition-resolution/scoring';
import { canonicalWord, matchStem, type SearchTerms } from './search-terms';

/** Where a found food comes from. */
export type SearchSource = 'builtin' | 'usda' | 'branded';

export interface RankableFood {
  name: string;
  brand: string | null;
  source: SearchSource;
}

/** A food matching under this share of the query's words is not shown. */
export const MIN_RECALL = 0.5;

// A query word found only as the start of a longer word ("oat" in "Oatmeal") counts this much.
const PARTIAL_MATCH = 0.6;
// The share of a score lost when every one of a name's own words is one the query didn't ask for.
const EXTRA_WORD_PENALTY = 0.5;

// Progresso's own built-in foods are the common forms people log ("White Rice (cooked)"), so they
// lead whenever they match, even with a describing word of their own the query didn't have.
const BUILTIN_BONUS = 0.45;
// USDA reference foods are plain, verified whole foods.
const USDA_BONUS = 0.1;
// A food with no brand is the food itself rather than one maker's product.
const GENERIC_BONUS = 0.08;
// The query's first word naming the food itself ("Onions, raw" for "onion").
const HEAD_WORD_BONUS = 0.05;
// The preparation asked for ("baked") is the one the food is in.
const COOKING_MATCH_BONUS = 0.1;
// With no preparation asked for, the plain raw food is the likeliest one meant.
const RAW_BONUS = 0.03;
// A food that is a product made with the one asked for (chips, a sauce, a mix), when the query
// didn't ask for that product.
const PRODUCT_PENALTY = 0.2;
// A restaurant's or a maker's dish in the USDA data ("BURGER KING, Onion Rings").
const BRANDED_DISH_PENALTY = 0.15;
// Each describing word past the first two: the more specific a variant, the further down it goes.
const DESCRIPTOR_PENALTY = 0.015;

// Words naming a product made from a food rather than the food itself.
const PRODUCT_WORDS = new Set([
  'babyfood',
  'bar',
  'candy',
  'chip',
  'cracker',
  'crisp',
  'dip',
  'dressing',
  'flavor',
  'flavored',
  'flavour',
  'flavoured',
  'gravy',
  'mix',
  'pickle',
  'powder',
  'restaurant',
  'sauce',
  'seasoning',
  'snack',
  'soup',
  'spread',
]);

function words(text: string): string[] {
  return tokenize(text).map(canonicalWord);
}

/** How well one query word is found among a name's words: 1 exactly, PARTIAL_MATCH as a word's start. */
function wordMatch(queryWord: string, nameWords: readonly string[]): number {
  const stem = matchStem(queryWord);
  let best = 0;
  for (const nameWord of nameWords) {
    const nameStem = matchStem(nameWord);
    if (nameStem === stem) return 1;
    if (stem.length >= 3 && nameStem.startsWith(stem)) best = PARTIAL_MATCH;
  }
  return best;
}

/** "BURGER KING, Onion Rings", "APPLEBEE'S, crunchy onion rings": a capitalised maker first. */
function startsWithMaker(name: string): boolean {
  const head = name.split(',')[0] ?? '';
  const letters = head.replace(/[^A-Za-z]/g, '');
  return letters.length >= 3 && letters === letters.toUpperCase();
}

/**
 * How relevant a food is to a query, higher first; null when it matches under MIN_RECALL of the
 * query's words, so it isn't shown. A brand the query names counts as matching words too.
 */
export function searchRelevance(terms: SearchTerms, food: RankableFood): number | null {
  if (terms.words.length === 0) return null;
  const { core: rawCore, descriptors: rawDescriptors } = splitName(food.name);
  const core = rawCore.map(canonicalWord);
  const descriptors = rawDescriptors.map(canonicalWord);
  const nameWords = [...core, ...descriptors];
  const brandWords = food.brand ? words(food.brand) : [];

  let matched = 0;
  for (const word of terms.words) {
    const inName = wordMatch(word, nameWords);
    matched += inName > 0 ? inName : wordMatch(word, brandWords);
  }
  const recall = matched / terms.words.length;
  if (recall < MIN_RECALL) return null;

  const extra = core.filter((word) => terms.words.every((q) => wordMatch(q, [word]) === 0));
  const extraShare = core.length === 0 ? 0 : extra.length / core.length;
  let score = recall * (1 - EXTRA_WORD_PENALTY * extraShare);

  if (food.source === 'builtin') score += BUILTIN_BONUS;
  if (food.source === 'usda') score += USDA_BONUS;
  if (!food.brand) score += GENERIC_BONUS;
  if (core.length > 0 && wordMatch(terms.words[0]!, [core[0]!]) === 1) score += HEAD_WORD_BONUS;

  if (terms.cooking.length > 0) {
    if (terms.cooking.some((word) => nameWords.includes(word))) score += COOKING_MATCH_BONUS;
  } else if (descriptors.includes('raw')) {
    score += RAW_BONUS;
  }

  const asked = new Set(terms.words);
  if (nameWords.some((word) => PRODUCT_WORDS.has(word) && !asked.has(word))) {
    score -= PRODUCT_PENALTY;
  }
  if (food.source === 'usda' && startsWithMaker(food.name)) score -= BRANDED_DISH_PENALTY;
  score -= DESCRIPTOR_PENALTY * Math.max(0, descriptors.length - 2);
  return score;
}

/** The foods in order, most relevant first, leaving out what doesn't match. Ties: the shorter name. */
export function rankFoods<T extends RankableFood>(terms: SearchTerms, foods: readonly T[]): T[] {
  return foods
    .map((food, index) => ({ food, index, score: searchRelevance(terms, food) }))
    .filter((entry): entry is { food: T; index: number; score: number } => entry.score !== null)
    .sort(
      (a, b) => b.score - a.score || a.food.name.length - b.food.name.length || a.index - b.index,
    )
    .map((entry) => entry.food);
}
