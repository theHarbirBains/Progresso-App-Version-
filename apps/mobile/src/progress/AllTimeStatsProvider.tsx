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
import {
  fetchAllExerciseHistory,
  type HistoricalSetWithExercise,
} from '../workouts/allExerciseHistoryQueries';
import {
  fetchAllOneRepMaxes,
  fetchAllRepPRs,
  type OneRepMaxWithExercise,
  type RepPRWithExercise,
} from '../workouts/prSummaryQueries';
import type { WorkoutSummary } from '../workouts/workoutQueries';
import { fetchAllCompletedWorkouts } from './progressStatsQueries';

export interface AllTimeStatsContextValue {
  allWorkouts: WorkoutSummary[];
  allSetHistory: HistoricalSetWithExercise[];
  statsLoading: boolean;
  statsError: string | null;

  repPRs: RepPRWithExercise[];
  oneRepMaxes: OneRepMaxWithExercise[];
  prsLoading: boolean;
  prsError: string | null;

  refetch: () => Promise<void>;
}

const AllTimeStatsContext = createContext<AllTimeStatsContextValue | undefined>(undefined);

function errorMessage(err: unknown): string {
  return err instanceof Error ? err.message : 'Something went wrong';
}

// The user's entire completed-workout/set/PR history -- unbounded, and
// previously fetched independently by both ProfileScreen (the You tab) and
// ProgressOverviewScreen (the Progress tab) on every focus, duplicating the
// same full-history scan on every switch between those two tabs. Fetched
// once here instead and shared, the same shape as ProfileProvider.
//
// Unlike profile/nutrition goals there is no single in-app "save" to write
// through: the only thing that changes what this data contains is
// completing a workout (ActiveWorkoutScreen's completeWorkout) -- editing or
// deleting a set only matters once that happens, and cancelling a workout
// never sets completed_at, so it never touches this data at all (see
// cancelWorkout's own comment). ActiveWorkoutScreen calls `refetch()` right
// after completeWorkout succeeds, so this cache is current the moment the
// user lands back on Feed/History -- before Profile or Progress are even
// visited.
//
// Kept as two independent groups (stats: workouts+set history, prs: rep
// PRs+1RMs), matching the two screens' own existing error granularity --
// ProfileScreen shows each on a different tab (Stats vs PRs), so a failure
// in one must not block the other.
export function AllTimeStatsProvider({ children }: PropsWithChildren) {
  const { user } = useAuth();
  const userId = user?.id;

  const [allWorkouts, setAllWorkouts] = useState<WorkoutSummary[]>([]);
  const [allSetHistory, setAllSetHistory] = useState<HistoricalSetWithExercise[]>([]);
  const [statsLoading, setStatsLoading] = useState(true);
  const [statsError, setStatsError] = useState<string | null>(null);

  const [repPRs, setRepPRs] = useState<RepPRWithExercise[]>([]);
  const [oneRepMaxes, setOneRepMaxes] = useState<OneRepMaxWithExercise[]>([]);
  const [prsLoading, setPrsLoading] = useState(true);
  const [prsError, setPrsError] = useState<string | null>(null);

  const load = useCallback(async () => {
    if (!userId) return;
    setStatsError(null);
    setPrsError(null);

    const [statsResult, prsResult] = await Promise.allSettled([
      Promise.all([fetchAllCompletedWorkouts(userId), fetchAllExerciseHistory(userId)]),
      Promise.all([fetchAllRepPRs(userId), fetchAllOneRepMaxes(userId)]),
    ]);

    if (statsResult.status === 'fulfilled') {
      setAllWorkouts(statsResult.value[0]);
      setAllSetHistory(statsResult.value[1]);
    } else {
      setStatsError(errorMessage(statsResult.reason));
    }
    setStatsLoading(false);

    if (prsResult.status === 'fulfilled') {
      setRepPRs(prsResult.value[0]);
      setOneRepMaxes(prsResult.value[1]);
    } else {
      setPrsError(errorMessage(prsResult.reason));
    }
    setPrsLoading(false);
  }, [userId]);

  useEffect(() => {
    if (!userId) {
      setAllWorkouts([]);
      setAllSetHistory([]);
      setRepPRs([]);
      setOneRepMaxes([]);
      setStatsError(null);
      setPrsError(null);
      setStatsLoading(true);
      setPrsLoading(true);
      return;
    }
    void load();
  }, [userId, load]);

  const value = useMemo<AllTimeStatsContextValue>(
    () => ({
      allWorkouts,
      allSetHistory,
      statsLoading,
      statsError,
      repPRs,
      oneRepMaxes,
      prsLoading,
      prsError,
      refetch: load,
    }),
    [
      allWorkouts,
      allSetHistory,
      statsLoading,
      statsError,
      repPRs,
      oneRepMaxes,
      prsLoading,
      prsError,
      load,
    ],
  );

  return <AllTimeStatsContext.Provider value={value}>{children}</AllTimeStatsContext.Provider>;
}

export function useAllTimeStats(): AllTimeStatsContextValue {
  const ctx = useContext(AllTimeStatsContext);
  if (!ctx) throw new Error('useAllTimeStats must be used within an AllTimeStatsProvider');
  return ctx;
}
