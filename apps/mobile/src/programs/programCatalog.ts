import type { WorkoutProgram } from './programTypes';

// Every workout program in Progresso, in the order the library lists them. Each is written by
// hand -- its days, exercises, sets, reps and alternatives -- and added here as it's ready; none
// is generated. docs/WORKOUT_PROGRAMS.md says how one is written, and programCatalog.test.ts
// checks each one (every exercise an active built-in, sets a split day can hold, one default per
// schedule, ...).
//
// Empty until the first programs are written: the library says they're on their way.
export const WORKOUT_PROGRAMS: readonly WorkoutProgram[] = [];
