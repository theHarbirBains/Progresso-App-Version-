import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
  type PropsWithChildren,
} from 'react';
import { useAuth } from '../auth/AuthProvider';
import { fetchNutritionGoals, saveNutritionGoals, type NutritionGoals } from './nutritionGoalQueries';

export interface NutritionGoalsContextValue {
  goals: NutritionGoals | null;
  loading: boolean;
  error: string | null;
  refetch: () => Promise<void>;
  saveGoals: (goals: NutritionGoals) => Promise<NutritionGoals>;
}

const NutritionGoalsContext = createContext<NutritionGoalsContextValue | undefined>(undefined);

// Same shape as ProfileProvider: one goals row is shared by every screen
// that reads it (Nutrition tab, You tab, the edit screen itself) instead of
// each fetching its own copy, and a save flows straight back into the
// cache -- no consumer ever needs to re-fetch after one of them writes.
export function NutritionGoalsProvider({ children }: PropsWithChildren) {
  const { user } = useAuth();
  const userId = user?.id;
  const [goals, setGoals] = useState<NutritionGoals | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(async () => {
    if (!userId) return;
    setError(null);
    try {
      const result = await fetchNutritionGoals(userId);
      setGoals(result);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to load nutrition goals');
    } finally {
      setLoading(false);
    }
  }, [userId]);

  useEffect(() => {
    if (!userId) {
      setGoals(null);
      setError(null);
      setLoading(true);
      return;
    }
    void load();
  }, [userId, load]);

  const value = useMemo<NutritionGoalsContextValue>(
    () => ({
      goals,
      loading,
      error,
      refetch: load,
      saveGoals: async (updates) => {
        if (!userId) throw new Error('Not signed in');
        const saved = await saveNutritionGoals(userId, updates);
        setGoals(saved);
        return saved;
      },
    }),
    [goals, loading, error, load, userId],
  );

  return (
    <NutritionGoalsContext.Provider value={value}>{children}</NutritionGoalsContext.Provider>
  );
}

export function useNutritionGoals(): NutritionGoalsContextValue {
  const ctx = useContext(NutritionGoalsContext);
  if (!ctx) throw new Error('useNutritionGoals must be used within a NutritionGoalsProvider');
  return ctx;
}
