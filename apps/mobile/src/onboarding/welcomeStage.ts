import { useSyncExternalStore } from 'react';

/**
 * Where a new account is between onboarding and the app (App.tsx's Root):
 * - 'saving' -- the account exists and onboarding's answers are being saved (submitOnboardingDraft);
 *   the app waits, so it never opens on half a profile.
 * - 'welcome' -- they're saved: the welcome (screens/WelcomeScreen.tsx) -- a profile photo, then
 *   friends from contacts -- before the app.
 * - 'none' -- everyone else, and a new account once its welcome is done.
 * Kept in memory only: an app closed mid-welcome simply opens as usual next time.
 */
export type WelcomeStage = 'none' | 'saving' | 'welcome';

let stage: WelcomeStage = 'none';
const listeners = new Set<() => void>();

export function setWelcomeStage(next: WelcomeStage): void {
  if (next === stage) return;
  stage = next;
  listeners.forEach((listener) => listener());
}

export function getWelcomeStage(): WelcomeStage {
  return stage;
}

function subscribe(listener: () => void): () => void {
  listeners.add(listener);
  return () => listeners.delete(listener);
}

export function useWelcomeStage(): WelcomeStage {
  return useSyncExternalStore(subscribe, getWelcomeStage);
}
