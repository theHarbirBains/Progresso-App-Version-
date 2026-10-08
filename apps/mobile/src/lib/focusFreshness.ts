/**
 * How long a focus-triggered reload is skipped for data that only needs to feel
 * "recent" when a root screen (Feed, say) regains focus after a quick hop to another
 * tab and back -- not data a one-hop screen right next to it (an edit, a response, a
 * log) can change and have the user return from well within this window. That kind
 * always reloads on every focus, ungated; see each call site's own comment for why
 * it's safe to gate the ones that use this.
 */
export const FOCUS_REFRESH_STALE_MS = 45_000;

/**
 * True once more than `ttlMs` has passed since `lastLoadedAt`, or it has never
 * loaded at all (null) -- so the very first load is always "stale" and happens.
 * `lastLoadedAt` is a plain `Date.now()` timestamp, set by the caller only after a
 * load actually succeeds, so a failed load is retried on the next focus rather
 * than being treated as fresh.
 */
export function isStale(
  lastLoadedAt: number | null,
  ttlMs: number = FOCUS_REFRESH_STALE_MS,
): boolean {
  return lastLoadedAt === null || Date.now() - lastLoadedAt > ttlMs;
}
