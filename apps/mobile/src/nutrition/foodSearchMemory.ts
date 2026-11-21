import type { FoodSearchResponse, FoodSearchResult } from '../lib/foodsApi';

// What makes Search Food feel instant (FoodSearchScreen). Pure, apart from the session's memory.
//
// - A search answered once this session is remembered: typed again -- or come back to after
//   backspacing -- it shows at once, with nothing asked again. Only for the session, and only the
//   latest MAX_REMEMBERED searches; foods don't change in that time in any way that matters.
// - Typing on from a search ("chick" to "chicken") narrows the rows on screen to those that still
//   match every word, while the new answer is on its way -- never adding a food, never re-ranking.

/** How long typing must pause before Search Food asks: short, since answers are remembered. */
export const SEARCH_TYPING_PAUSE_MS = 220;

const MAX_REMEMBERED = 40;

interface Remembered {
  /** Without branded products: Progresso's catalogue and USDA's whole foods. */
  quick?: FoodSearchResponse;
  /** With them: the answer the screen keeps. */
  full?: FoodSearchResponse;
}

const memory = new Map<string, Remembered>();

const keyOf = (query: string) => query.trim().toLowerCase().replace(/\s+/g, ' ');

/** What a search was answered with this session, if it was. */
export function recallSearch(query: string): Remembered | undefined {
  const key = keyOf(query);
  const found = memory.get(key);
  if (found) {
    // The latest used stays.
    memory.delete(key);
    memory.set(key, found);
  }
  return found;
}

/** Keeps a search's answer (its quick one, its full one, or both) for the session. */
export function rememberSearch(query: string, answer: Remembered): void {
  const key = keyOf(query);
  const kept = { ...memory.get(key), ...answer };
  memory.delete(key);
  memory.set(key, kept);
  while (memory.size > MAX_REMEMBERED) {
    memory.delete(memory.keys().next().value as string);
  }
}

/** Forgets every search -- at sign-out, and for tests. */
export function forgetSearches(): void {
  memory.clear();
}

/** The words of a search, lowercased, without the punctuation people type between them. */
function wordsOf(text: string): string[] {
  return text
    .toLowerCase()
    .split(/[^\p{L}\p{N}%]+/u)
    .filter(Boolean);
}

/**
 * The rows on screen that still match `next`, when it carries on from the search they answer
 * (`shownFor`): each of its words is the start of a word in a food's name or brand. Otherwise --
 * a new search, or one that took words away -- none, so nothing stale is shown for it.
 */
export function narrowResults(
  shown: FoodSearchResult[],
  shownFor: string | null,
  next: string,
): FoodSearchResult[] {
  if (!shownFor || !keyOf(next).startsWith(keyOf(shownFor))) return [];
  const words = wordsOf(next);
  return shown.filter((food) => {
    const own = wordsOf(`${food.name} ${food.brand ?? ''}`);
    return words.every((word) => own.some((candidate) => candidate.startsWith(word)));
  });
}
