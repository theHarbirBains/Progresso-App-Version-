import type { LoggingStyle, MovementType } from '../exercises/movementTypes';
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
  photoUrl: string | null;
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
  photoUrl?: string;
}

export interface UpdateExerciseInput {
  name?: string;
  muscleGroup?: MuscleGroup;
  movementType?: MovementType;
  loggingStyle?: LoggingStyle;
  isActive?: boolean;
  /** Omit to leave the stored photo alone; null clears it, a string sets/replaces it -- editable any time, not just at create. */
  photoUrl?: string | null;
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
