import AsyncStorage from '@react-native-async-storage/async-storage';
import type { FitnessGoal } from '../lib/api';
import { EMPTY_DRAFT, type OnboardingDraft } from './onboardingDraft';
import { isOfferedGoal } from './onboardingOptions';

const STORAGE_KEY = '@progresso/onboardingDraft';

interface StoredDraft {
  draft: OnboardingDraft;
  stepIndex: number;
}

/**
 * On-device persistence for the in-progress onboarding draft -- account
 * creation is now the LAST step, so there's no signed-in account to tie
 * resumability to until the flow is nearly done (see onboardingDraft.ts's
 * own comment). Without this, an app kill mid-flow would silently lose
 * everything answered so far; this is what makes it resumable again, the
 * same guarantee the old profile-backed onboarding had.
 */
export async function saveOnboardingDraft(
  draft: OnboardingDraft,
  stepIndex: number,
): Promise<void> {
  const stored: StoredDraft = { draft, stepIndex };
  await AsyncStorage.setItem(STORAGE_KEY, JSON.stringify(stored));
}

/** Null when nothing was ever saved, or the saved JSON is corrupt/unreadable. */
export async function loadOnboardingDraft(): Promise<StoredDraft | null> {
  try {
    const raw = await AsyncStorage.getItem(STORAGE_KEY);
    if (!raw) return null;
    const parsed = JSON.parse(raw) as Partial<StoredDraft>;
    if (!parsed.draft || typeof parsed.stepIndex !== 'number') return null;
    // Spread over EMPTY_DRAFT so a draft saved before a future field was
    // added (a new onboarding step ships) still loads with that field
    // sensibly defaulted, rather than crashing or leaving it as `undefined`.
    const stored = parsed.draft as Partial<OnboardingDraft> & { fitnessGoal?: FitnessGoal | null };
    const draft = { ...EMPTY_DRAFT, ...stored };
    // A draft from before several goals could be picked kept its one goal on its own.
    if (stored.fitnessGoal && !stored.fitnessGoals) draft.fitnessGoals = [stored.fitnessGoal];
    delete (draft as { fitnessGoal?: unknown }).fitnessGoal;
    // Goals onboarding no longer offers (General Health, Other) can't be unticked, so they go.
    draft.fitnessGoals = draft.fitnessGoals.filter(isOfferedGoal);
    return { draft, stepIndex: parsed.stepIndex };
  } catch {
    return null;
  }
}

export async function clearOnboardingDraft(): Promise<void> {
  await AsyncStorage.removeItem(STORAGE_KEY);
}
