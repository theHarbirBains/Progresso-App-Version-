import type {
  FoodQuery,
  NutritionSource,
  SourceCandidate,
} from '../../nutrition-resolution/source.interface';

/**
 * The same source, allowed at most `limitMs` per search and never past `deadline` (the time the
 * whole request must answer by). A search that runs out of time fails, and the resolver skips a
 * source that fails, so one slow source can't use up the request. The search it started may
 * still finish in the background; its result is ignored.
 */
export function timeLimited(
  source: NutritionSource,
  limitMs: number,
  deadline: number,
  onTimeout: (source: NutritionSource, waitedMs: number) => void,
): NutritionSource {
  return {
    kind: source.kind,
    licence: source.licence,
    storable: source.storable,
    attribution: (candidate) => source.attribution(candidate),
    search: async (query: FoodQuery): Promise<SourceCandidate[]> => {
      const waitMs = Math.min(limitMs, deadline - Date.now());
      if (waitMs <= 0) throw new Error(`No time left to search ${source.kind}`);

      let timer: ReturnType<typeof setTimeout> | undefined;
      const timedOut = new Promise<never>((_, reject) => {
        timer = setTimeout(() => {
          onTimeout(source, waitMs);
          reject(new Error(`${source.kind} took longer than ${waitMs} ms`));
        }, waitMs);
      });
      try {
        return await Promise.race([source.search(query), timedOut]);
      } finally {
        clearTimeout(timer);
      }
    },
  };
}
