import AsyncStorage from '@react-native-async-storage/async-storage';
import { useCallback, useEffect, useState } from 'react';
import type { LifeStage, ReferenceChoices, ReferenceSex } from './referenceValues';

// What a person tells the Micronutrients page so the right reference values apply: which of
// Health Canada's sex categories to use when their profile's gender isn't one the tables have,
// and whether they're pregnant or breastfeeding. Health details only the recommendations need,
// so they're kept on the phone, per person -- never sent anywhere or added to the account.

function storageKey(userId: string): string {
  return `progresso.micronutrients.${userId}`;
}

const SEXES: readonly ReferenceSex[] = ['male', 'female'];
const STAGES: readonly LifeStage[] = ['pregnant', 'breastfeeding'];

/** What was saved; anything missing or unreadable is simply not chosen. */
export function readStoredChoices(raw: string | null): ReferenceChoices {
  if (!raw) return {};
  try {
    const stored = JSON.parse(raw) as Record<string, unknown>;
    return {
      sex: SEXES.includes(stored.sex as ReferenceSex) ? (stored.sex as ReferenceSex) : null,
      lifeStage: STAGES.includes(stored.lifeStage as LifeStage)
        ? (stored.lifeStage as LifeStage)
        : null,
    };
  } catch {
    return {};
  }
}

export async function loadReferenceChoices(userId: string): Promise<ReferenceChoices> {
  try {
    return readStoredChoices(await AsyncStorage.getItem(storageKey(userId)));
  } catch {
    return {};
  }
}

export async function saveReferenceChoices(
  userId: string,
  choices: ReferenceChoices,
): Promise<void> {
  await AsyncStorage.setItem(storageKey(userId), JSON.stringify(choices));
}

/** The signed-in person's choices, read once the page opens, and a way to change them. */
export function useReferenceChoices(userId: string | undefined): {
  choices: ReferenceChoices;
  loaded: boolean;
  save: (next: ReferenceChoices) => Promise<void>;
} {
  const [state, setState] = useState<{ choices: ReferenceChoices; loaded: boolean }>({
    choices: {},
    loaded: false,
  });
  useEffect(() => {
    if (!userId) return;
    let cancelled = false;
    void loadReferenceChoices(userId).then((choices) => {
      if (!cancelled) setState({ choices, loaded: true });
    });
    return () => {
      cancelled = true;
    };
  }, [userId]);
  const save = useCallback(
    async (next: ReferenceChoices) => {
      if (!userId) return;
      setState({ choices: next, loaded: true });
      await saveReferenceChoices(userId, next);
    },
    [userId],
  );
  return { ...state, loaded: state.loaded || !userId, save };
}
