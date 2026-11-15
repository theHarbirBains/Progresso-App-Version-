import { useEffect, useState } from 'react';

/** The longest a page waits for every part of it before showing what it has. */
export const SHOW_ALL_WITHIN_MS = 3000;

/**
 * Whether a page shows its content yet: once every part of it is in (`ready`), so it all shows
 * together rather than piece by piece -- or SHOW_ALL_WITHIN_MS after it opened, so one slow part
 * never holds the rest back for long. Once shown it stays shown: a later refresh never puts the
 * placeholders back.
 */
export function useShowAllAtOnce(ready: boolean, withinMs = SHOW_ALL_WITHIN_MS): boolean {
  const [shown, setShown] = useState(ready);
  useEffect(() => {
    if (ready) setShown(true);
  }, [ready]);
  useEffect(() => {
    const timer = setTimeout(() => setShown(true), withinMs);
    return () => clearTimeout(timer);
  }, [withinMs]);
  return shown || ready;
}
