import { useCallback, useEffect, useState, type Dispatch, type SetStateAction } from 'react';

export interface SignedInResource<T> {
  data: T;
  loading: boolean;
  error: string | null;
  /** Resolves true on a successful fetch, false if it errored -- most
   * callers just `await` it, but FoodLogProvider's own day-rollover
   * tracking needs to know which happened without a state-closure
   * staleness trap. */
  refetch: () => Promise<boolean>;
  /** How a write path (updateProfile, saveGoals, logFoodEntry, ...) updates
   * the cache directly from its own save's response, with no second fetch. */
  setData: Dispatch<SetStateAction<T>>;
}

/**
 * The shared shape behind every "fetch once per sign-in, cache, reset on
 * sign-out" context provider in the app (ProfileProvider,
 * NutritionGoalsProvider, FoodLogProvider, and AllTimeStatsProvider's own
 * two independent groups) -- previously reimplemented from scratch in each
 * one: a fetch keyed on some auth-derived identifier (userId, accessToken,
 * ...), reset to `emptyValue` when that key disappears (sign-out), and
 * refetchable on demand.
 *
 * `fetcher`/`emptyValue`/`errorFallback` are expected to be stable across
 * renders -- a module-level query function, a literal/constant -- so
 * they're deliberately left out of the dependency arrays below, the same
 * way every provider this replaces already only ever depended on its own
 * auth key.
 */
export function useSignedInResource<TKey extends string, TData>(
  key: TKey | undefined,
  fetcher: (key: TKey) => Promise<TData>,
  emptyValue: TData,
  errorFallback: string,
): SignedInResource<TData> {
  const [data, setData] = useState<TData>(emptyValue);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(async (): Promise<boolean> => {
    if (!key) return false;
    setError(null);
    try {
      setData(await fetcher(key));
      return true;
    } catch (err) {
      setError(err instanceof Error ? err.message : errorFallback);
      return false;
    } finally {
      setLoading(false);
    }
  }, [key]);

  useEffect(() => {
    if (!key) {
      setData(emptyValue);
      setError(null);
      setLoading(true);
      return;
    }
    void load();
  }, [key, load]);

  return { data, loading, error, refetch: load, setData };
}
