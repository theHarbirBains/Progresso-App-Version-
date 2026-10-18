import { createContext, useContext } from 'react';

/**
 * Which side of the app a trainer is using: their own (`personal` -- Feed,
 * Workouts, Nutrition, Progress, You) or coaching (`trainer` -- their clients).
 * Everyone who isn't a trainer is always in `personal`.
 */
export type Workspace = 'personal' | 'trainer';

export interface WorkspaceValue {
  workspace: Workspace;
  /** Whether this person can switch at all -- only trainers have a trainer workspace. */
  isTrainer: boolean;
  /** Switches workspace and goes to its home: Feed, or the trainer's Clients page. */
  switchTo: (workspace: Workspace) => void;
}

export const WorkspaceContext = createContext<WorkspaceValue | null>(null);

/** The workspace, or null outside the signed-in app (e.g. in a test). */
export function useWorkspace(): WorkspaceValue | null {
  return useContext(WorkspaceContext);
}

/** The workspaces as the switcher shows them. */
export const WORKSPACES: Record<
  Workspace,
  { title: string; subtitle: string; description: string }
> = {
  personal: {
    title: 'My Workspace',
    subtitle: 'Personal',
    description: 'Your personal workouts, nutrition, and progress.',
  },
  trainer: {
    title: 'Trainer Workspace',
    subtitle: 'Clients & Coaching',
    description: 'Manage your clients, log their workouts and run live sessions.',
  },
};
