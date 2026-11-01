import { useEffect, useState } from 'react';

/** How long typing in a search box must pause before the search runs. */
export const SEARCH_DEBOUNCE_MS = 300;

/**
 * `value` once it has stopped changing for `delayMs` -- a search box's text, so every keystroke
 * doesn't fire its own read.
 */
export function useDebouncedValue<T>(value: T, delayMs: number = SEARCH_DEBOUNCE_MS): T {
  const [settled, setSettled] = useState(value);
  useEffect(() => {
    const timer = setTimeout(() => setSettled(value), delayMs);
    return () => clearTimeout(timer);
  }, [value, delayMs]);
  return settled;
}
