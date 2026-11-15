import type { LoadType, Pulley } from '../exercises/machineLoad';
import type { LoggingStyle, MeasurementType, MovementType } from '../exercises/movementTypes';
import type { MuscleGroup } from '../exercises/muscleGroups';
import { request } from './apiClient';

// Exercise writes (create/edit/deactivate) go through the backend for the
// same reason profile writes do: centralized validation and a clean 409 on
// a duplicate custom-exercise name instead of a raw Postgres error. Reads
// (search/list/filter) go direct to Supabase instead — see exerciseQueries.
export interface ExerciseResponse {
  id: string;
  name: string;
  muscleGroup: MuscleGroup;
  movementType: MovementType;
  loggingStyle: LoggingStyle | null;
  measurementType: MeasurementType;
  photoUrl: string | null;
  /** Where the machine is, how it feels next to others like it, its bar or handle. */
  gym: string | null;
  feelNotes: string | null;
  attachment: string | null;
  /** How it's loaded and its pulley (exercises/machineLoad.ts). */
  loadType: LoadType | null;
  pulley: Pulley | null;
  isActive: boolean;
  createdBy: string | null;
  createdAt: string;
  updatedAt: string;
}

export interface CreateExerciseInput {
  name: string;
  muscleGroup: MuscleGroup;
  movementType: MovementType;
  /** Required when movementType is 'unilateral', omitted otherwise -- see ExerciseFormScreen. */
  loggingStyle?: LoggingStyle;
  /** What a set records; the API defaults to weight and reps. */
  measurementType?: MeasurementType;
  photoUrl?: string;
  gym?: string | null;
  feelNotes?: string | null;
  attachment?: string | null;
  loadType?: LoadType | null;
  pulley?: Pulley | null;
}

export interface UpdateExerciseInput {
  name?: string;
  muscleGroup?: MuscleGroup;
  movementType?: MovementType;
  loggingStyle?: LoggingStyle;
  /** Workouts already logged keep what they were logged as. */
  measurementType?: MeasurementType;
  isActive?: boolean;
  /** Omit to leave the stored photo alone; null clears it, a string sets/replaces it -- editable any time, not just at create. */
  photoUrl?: string | null;
  /** Each: omit to leave it, a blank or null clears it. */
  gym?: string | null;
  feelNotes?: string | null;
  attachment?: string | null;
  loadType?: LoadType | null;
  pulley?: Pulley | null;
}

export function createExercise(
  accessToken: string,
  input: CreateExerciseInput,
): Promise<ExerciseResponse> {
  return request<ExerciseResponse>('/api/v1/exercises', accessToken, {
    method: 'POST',
    body: JSON.stringify(input),
  });
}

export function updateExercise(
  accessToken: string,
  id: string,
  input: UpdateExerciseInput,
): Promise<ExerciseResponse> {
  return request<ExerciseResponse>(`/api/v1/exercises/${id}`, accessToken, {
    method: 'PATCH',
    body: JSON.stringify(input),
  });
}

/** How someone's library is shared with you: your trainer's, a client's, or someone you follow. */
export type ShareSource = 'trainer' | 'client' | 'friend';

/** Someone else's custom exercise, shared with you (GET /exercises/shared). */
export interface SharedExerciseResponse extends ExerciseResponse {
  source: ShareSource;
  owner: {
    id: string;
    username: string | null;
    displayName: string | null;
    avatarUrl: string | null;
  };
  /** You already have one of your own by that name at that gym. */
  inLibrary: boolean;
}

/** The custom exercises your trainer, your clients and the people you follow share with you. */
export async function fetchSharedExercises(accessToken: string): Promise<SharedExerciseResponse[]> {
  const result = await request<{ exercises: SharedExerciseResponse[] }>(
    '/api/v1/exercises/shared',
    accessToken,
  );
  return result.exercises;
}

/**
 * Makes a shared exercise yours -- your own by that name at that gym, or a copy in your library
 * (with its photo, gym, how it feels and handle). A built-in or your own comes back as it is.
 */
export function copyExercise(accessToken: string, id: string): Promise<ExerciseResponse> {
  return request<ExerciseResponse>(`/api/v1/exercises/${id}/copy`, accessToken, {
    method: 'POST',
  });
}
