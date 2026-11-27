import { useStepsHistory } from '../useStepsHistory';
import type { StepsAccess } from '../steps';

/**
 * Steps are the real part of the Health prototype (Harbir, 2026-11-27: "the only real data section
 * of the health section"): today's count and the last 7 days, from Apple Health on this phone --
 * the same read as the Health tab's, made as the page opens and whenever the app comes back to the
 * front, kept nowhere. Everything else in the prototype is sample data.
 */
export interface RealSteps {
  /** Today's count, once Apple Health has given it; never a made-up 0 before then. */
  today: number | null;
  /** The last 7 days, today last; null until read. */
  week: number[] | null;
  /** Where the figure is from, or why there's none. */
  note: string;
}

/** What the steps say about where they're from -- or why there are none. */
export function realStepsNote(access: StepsAccess | null, failure: string | null): string {
  if (failure) return 'Apple Health couldn’t be reached';
  if (access === 'unavailable') return 'Apple Health isn’t available here';
  if (access === 'notAsked') return 'Connect Apple Health';
  return 'From Apple Health';
}

export function useRealSteps(): RealSteps {
  const { access, days, failure } = useStepsHistory(7);
  const read = access === 'asked' && days && days.length > 0 ? days : null;
  return {
    today: read ? read[read.length - 1].steps : null,
    week: read ? read.map((day) => day.steps) : null,
    note: realStepsNote(access, failure),
  };
}
