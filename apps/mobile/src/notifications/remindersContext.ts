import { createContext, useContext } from 'react';
import type { ReminderSettings } from './reminderSettings';

export interface RemindersContextValue {
  /** Null until read for the signed-in person. */
  settings: ReminderSettings | null;
  /** Saves new settings on the phone; the reminders follow. */
  update: (next: ReminderSettings) => void;
  /** Whether the phone allows Progresso's notifications; null until known. */
  allowed: boolean | null;
  /** Asks the phone again -- after coming back from its Settings, say. */
  refreshAllowed: () => Promise<void>;
  /** Reminders are being scheduled: signed in, said yes to notifications, and allowed. */
  active: boolean;
}

// Its own file (no provider imports), so a screen reading it doesn't pull in the provider's
// queries -- the same split as membership/useMembership.ts.
export const RemindersContext = createContext<RemindersContextValue | null>(null);

const NONE: RemindersContextValue = {
  settings: null,
  update: () => undefined,
  allowed: null,
  refreshAllowed: async () => undefined,
  active: false,
};

/** The reminders' settings and state; outside RemindersProvider, nothing is on. */
export function useReminders(): RemindersContextValue {
  return useContext(RemindersContext) ?? NONE;
}
