import type { ProgramContent } from './programTypes';

// The programming itself -- Harbir's, written by hand, never generated: each program's words
// (description, tags, benefits, guidance) and each variation's days, exercises, sets, reps, rest,
// notes, tips and alternatives, keyed by the program's and variation's ids in programCatalog.ts.
// A variation shows in the app once its days are here, each with its exercises; until then it's
// left out, and a program with none ready isn't shown at all. docs/WORKOUT_PROGRAMS.md says how
// it's written; programCatalog.test.ts checks every entry.
//
// Empty until the programming is written.
export const PROGRAM_CONTENT: Readonly<Record<string, ProgramContent>> = {};
