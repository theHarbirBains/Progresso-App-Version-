import { createContext, useCallback, useContext, useMemo, type PropsWithChildren } from 'react';
import { useAuth } from '../auth/AuthProvider';
import { useSignedInResource } from '../lib/useSignedInResource';
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

  refetch: () => Promise<boolean>;
}

const AllTimeStatsContext = createContext<AllTimeStatsContextValue | undefined>(undefined);

interface StatsGroup {
  allWorkouts: WorkoutSummary[];
  allSetHistory: HistoricalSetWithExercise[];
}

interface PrsGroup {
  repPRs: RepPRWithExercise[];
  oneRepMaxes: OneRepMaxWithExercise[];
}

const EMPTY_STATS: StatsGroup = { allWorkouts: [], allSetHistory: [] };
const EMPTY_PRS: PrsGroup = { repPRs: [], oneRepMaxes: [] };

async function fetchStatsGroup(userId: string): Promise<StatsGroup> {
  const [allWorkouts, allSetHistory] = await Promise.all([
    fetchAllCompletedWorkouts(userId),
    fetchAllExerciseHistory(userId),
  ]);
  return { allWorkouts, allSetHistory };
}

async function fetchPrsGroup(userId: string): Promise<PrsGroup> {
  const [repPRs, oneRepMaxes] = await Promise.all([
    fetchAllRepPRs(userId),
    fetchAllOneRepMaxes(userId),
  ]);
  return { repPRs, oneRepMaxes };
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

  const {
    data: stats,
    loading: statsLoading,
    error: statsError,
    refetch: refetchStats,
  } = useSignedInResource(userId, fetchStatsGroup, EMPTY_STATS, 'Something went wrong');

  const {
    data: prs,
    loading: prsLoading,
    error: prsError,
    refetch: refetchPrs,
  } = useSignedInResource(userId, fetchPrsGroup, EMPTY_PRS, 'Something went wrong');

  // Both groups fetch independently (a failure in one doesn't block the
  // other, matching ProfileScreen's separate Stats/PRs tabs), but
  // ActiveWorkoutScreen only knows about "the user's history changed" after
  // completing a workout, not which group -- so this refetches both.
  const refetch = useCallback(async () => {
    const [statsOk, prsOk] = await Promise.all([refetchStats(), refetchPrs()]);
    return statsOk && prsOk;
  }, [refetchStats, refetchPrs]);

  const value = useMemo<AllTimeStatsContextValue>(
    () => ({
      allWorkouts: stats.allWorkouts,
      allSetHistory: stats.allSetHistory,
      statsLoading,
      statsError,
      repPRs: prs.repPRs,
      oneRepMaxes: prs.oneRepMaxes,
      prsLoading,
      prsError,
      refetch,
    }),
    [stats, statsLoading, statsError, prs, prsLoading, prsError, refetch],
  );

  return <AllTimeStatsContext.Provider value={value}>{children}</AllTimeStatsContext.Provider>;
}

export function useAllTimeStats(): AllTimeStatsContextValue {
  const ctx = useContext(AllTimeStatsContext);
  if (!ctx) throw new Error('useAllTimeStats must be used within an AllTimeStatsProvider');
  return ctx;
}
