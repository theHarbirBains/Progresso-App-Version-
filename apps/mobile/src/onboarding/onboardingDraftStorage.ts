import AsyncStorage from '@react-native-async-storage/async-storage';
import { EMPTY_DRAFT, type OnboardingDraft } from './onboardingDraft';

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
    return { draft: { ...EMPTY_DRAFT, ...parsed.draft }, stepIndex: parsed.stepIndex };
  } catch {
    return null;
  }
}

export async function clearOnboardingDraft(): Promise<void> {
  await AsyncStorage.removeItem(STORAGE_KEY);
}
