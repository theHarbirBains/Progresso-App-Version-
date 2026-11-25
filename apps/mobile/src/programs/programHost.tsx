import { createContext, useContext, useMemo, type ReactNode } from 'react';
import { useAuth } from '../auth/AuthProvider';
import { useProfile } from '../profile/ProfileProvider';
import { activateProgram } from './programActivation';
import { preferencesFromProfile } from './programPreferences';
import { programById, variationById } from './programs';
import type { ProgramPreferences } from './recommendations';

/** A program and the variation of it chosen. */
export interface ProgramChoice {
  programId: string;
  variationId: string;
}

/**
 * Where the program pages are open, and what Use Program does there. The same pages are the
 * app's (Workout Splits > Workout Programs, routes of the app's own navigator) and onboarding's
 * (a sheet over Choose your workout split, before there's an account).
 */
export interface ProgramHost {
  mode: 'app' | 'onboarding';
  /** The one chosen already (onboarding, coming back to it), to mark it. */
  chosen: ProgramChoice | null;
  /** What recommendations are worked out from: the profile's answers, or onboarding's so far. */
  preferences: ProgramPreferences;
  /** Uses a program: in the app, makes it a split of their own and the active one (the split's
   * id); in onboarding, remembers it for when the account's made (null). */
  use: (choice: ProgramChoice) => Promise<string | null>;
  /** Leaves the programs from their first page (onboarding: closes the sheet). */
  close?: () => void;
  /** Program Added's way on, in onboarding: on to the next question. */
  finish?: () => void;
}

const ProgramHostContext = createContext<ProgramHost | null>(null);

/** Onboarding's: the program pages in a sheet, choosing for later. */
export function ProgramHostProvider({
  host,
  children,
}: {
  host: ProgramHost;
  children: ReactNode;
}) {
  return <ProgramHostContext.Provider value={host}>{children}</ProgramHostContext.Provider>;
}

/** The program pages' host: onboarding's when they're open there, else the app's. */
export function useProgramHost(): ProgramHost {
  const { user } = useAuth();
  const { profile, updateProfile } = useProfile();
  const provided = useContext(ProgramHostContext);
  const preferences = useMemo(() => preferencesFromProfile(profile), [profile]);
  if (provided) return provided;
  return {
    mode: 'app',
    chosen: null,
    preferences,
    use: async ({ programId, variationId }) => {
      const program = programById(programId);
      if (!program || !user) throw new Error("That program couldn't be found.");
      const split = await activateProgram(user.id, program, variationById(program, variationId));
      await updateProfile({ activeWorkoutSplitId: split.id });
      return split.id;
    },
  };
}
