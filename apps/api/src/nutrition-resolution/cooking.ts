// Cooking-state words (how a food was prepared). They are kept in a query because they tell
// preparations apart ("baked potato" against "Potato (boiled)"). When no food data exists for the
// preparation at all, the resolver can retry without them, and records that it did.

export const COOKING_STATE_WORDS: ReadonlySet<string> = new Set([
  'air',
  'baked',
  'boiled',
  'cooked',
  'fried',
  'grilled',
  'poached',
  'raw',
  'roasted',
  'sauteed',
  'scrambled',
  'steamed',
  'toasted',
]);

/** The query with its cooking-state words removed, e.g. "air fried potato" becomes "potato". */
export function withoutCookingWords(term: string): string {
  return term
    .split(/\s+/)
    .filter((word) => word.length > 0 && !COOKING_STATE_WORDS.has(word.toLowerCase()))
    .join(' ');
}

/** The cooking-state words the query carried, in order, for the note shown to the user. */
export function cookingWordsIn(term: string): string[] {
  return term
    .split(/\s+/)
    .filter((word) => COOKING_STATE_WORDS.has(word.toLowerCase()))
    .map((word) => word.toLowerCase());
}
