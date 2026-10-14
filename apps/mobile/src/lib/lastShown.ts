// What each section page last showed, per signed-in user, kept in memory so
// that opening the page again -- a section is opened fresh on every switch,
// see navigation/sectionNavigation.ts -- shows it at once instead of a blank
// page and a spinner, while the page refreshes in the background exactly as
// before. Not a cache of record: every page still fetches as CLAUDE.md's
// freshness rules say; this only decides what's on screen in the meantime.
// Never persisted, and forgotten on sign-out (or when another user signs in).

const shown = new Map<string, unknown>();
let shownFor: string | null = null;

/** Remembers what a page just showed for `userId` (ignored without a user). */
export function rememberShown<T>(userId: string | undefined, key: string, value: T): void {
  if (!userId) return;
  if (shownFor !== userId) {
    shown.clear();
    shownFor = userId;
  }
  shown.set(key, value);
}

/** What the page last showed for `userId`, or undefined if it hasn't shown anything yet. */
export function recallShown<T>(userId: string | undefined, key: string): T | undefined {
  if (!userId || shownFor !== userId) return undefined;
  return shown.get(key) as T | undefined;
}

/** Forgets everything -- on sign-out. */
export function forgetShown(): void {
  shown.clear();
  shownFor = null;
}
