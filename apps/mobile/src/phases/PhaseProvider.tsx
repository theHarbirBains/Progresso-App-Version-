import { createContext, useContext, useMemo, type PropsWithChildren } from 'react';
import { useAuth } from '../auth/AuthProvider';
import { useNutritionGoals } from '../nutrition/NutritionGoalsProvider';
import type { TargetValues } from '../nutrition/targetMath';
import { useSignedInResource } from '../lib/useSignedInResource';
import {
  createPhase,
  deletePhase,
  endPhase,
  fetchPhases,
  updatePhase,
  type PhaseInput,
  type TrainingPhase,
} from './phaseQueries';
import { activePhase, effectiveTargets, hasOwnTargets, phaseLabel } from './phaseRules';

export interface PhaseContextValue {
  /** Newest first. */
  phases: TrainingPhase[];
  /** The phase going today, if any. */
  active: TrainingPhase | null;
  loading: boolean;
  error: string | null;
  createPhase: (input: PhaseInput) => Promise<TrainingPhase>;
  updatePhase: (phaseId: string, input: PhaseInput) => Promise<TrainingPhase>;
  endPhase: (phaseId: string, endDate: string) => Promise<TrainingPhase>;
  deletePhase: (phaseId: string) => Promise<void>;
}

const PhaseContext = createContext<PhaseContextValue | undefined>(undefined);

function sorted(phases: TrainingPhase[]): TrainingPhase[] {
  return [...phases].sort((a, b) => b.startDate.localeCompare(a.startDate));
}

// Same shape as NutritionGoalsProvider: the person's phases are read once per sign-in and shared
// by every screen that shows them (Today, Nutrition Goals, Progress, the Phases page), and each
// save flows straight back into the cache -- no screen re-fetches after another one writes.
export function PhaseProvider({ children }: PropsWithChildren) {
  const { user } = useAuth();
  const userId = user?.id;
  const {
    data: phases,
    loading,
    error,
    setData: setPhases,
  } = useSignedInResource(userId, fetchPhases, [] as TrainingPhase[], 'Failed to load phases');

  const value = useMemo<PhaseContextValue>(() => {
    const replace = (phase: TrainingPhase) =>
      setPhases((prev) => sorted([...prev.filter((p) => p.id !== phase.id), phase]));
    return {
      phases,
      active: activePhase(phases),
      loading,
      error,
      createPhase: async (input) => {
        if (!userId) throw new Error('Not signed in');
        const created = await createPhase(userId, input);
        replace(created);
        return created;
      },
      updatePhase: async (phaseId, input) => {
        const updated = await updatePhase(phaseId, input);
        replace(updated);
        return updated;
      },
      endPhase: async (phaseId, endDate) => {
        const ended = await endPhase(phaseId, endDate);
        replace(ended);
        return ended;
      },
      deletePhase: async (phaseId) => {
        await deletePhase(phaseId);
        setPhases((prev) => prev.filter((p) => p.id !== phaseId));
      },
    };
  }, [phases, loading, error, setPhases, userId]);

  return <PhaseContext.Provider value={value}>{children}</PhaseContext.Provider>;
}

export function usePhases(): PhaseContextValue {
  const ctx = useContext(PhaseContext);
  if (!ctx) throw new Error('usePhases must be used within a PhaseProvider');
  return ctx;
}

/**
 * The day's targets as they apply: the active phase's own where it has them, the daily targets
 * everywhere else (phaseRules.ts). `phaseName` is set when the phase has targets of its own, so
 * a screen can say whose targets these are.
 */
export function useDailyTargets(): {
  targets: TargetValues;
  phaseName: string | null;
  loading: boolean;
} {
  const { goals, loading } = useNutritionGoals();
  const { active } = usePhases();
  // Phases never hold a screen up: until they're read (or if the read fails), the daily
  // targets apply.
  return useMemo(
    () => ({
      targets: effectiveTargets(goals, active),
      phaseName: hasOwnTargets(active) && active ? phaseLabel(active) : null,
      loading,
    }),
    [goals, active, loading],
  );
}
