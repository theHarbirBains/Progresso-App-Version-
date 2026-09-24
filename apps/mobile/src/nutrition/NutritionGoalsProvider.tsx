import { createContext, useContext, useMemo, type PropsWithChildren } from 'react';
import { useAuth } from '../auth/AuthProvider';
import { useSignedInResource } from '../lib/useSignedInResource';
import { fetchNutritionGoals, saveNutritionGoals, type NutritionGoals } from './nutritionGoalQueries';

export interface NutritionGoalsContextValue {
  goals: NutritionGoals | null;
  loading: boolean;
  error: string | null;
  refetch: () => Promise<boolean>;
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
  const { data: goals, loading, error, refetch, setData: setGoals } = useSignedInResource(
    userId,
    fetchNutritionGoals,
    null as NutritionGoals | null,
    'Failed to load nutrition goals',
  );

  const value = useMemo<NutritionGoalsContextValue>(
    () => ({
      goals,
      loading,
      error,
      refetch,
      saveGoals: async (updates) => {
        if (!userId) throw new Error('Not signed in');
        const saved = await saveNutritionGoals(userId, updates);
        setGoals(saved);
        return saved;
      },
    }),
    [goals, loading, error, refetch, setGoals, userId],
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
