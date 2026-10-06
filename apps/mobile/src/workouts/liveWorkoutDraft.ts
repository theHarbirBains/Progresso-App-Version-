import AsyncStorage from '@react-native-async-storage/async-storage';

// Values typed into a live workout's sets, kept on this device until the set is completed.
// The workout itself is already saved on the server (it stays open until it is finished or
// cancelled). This only covers what was typed but not yet completed, which would otherwise be
// lost if the app is closed or reset mid-set. Completing a set saves it to the server, so the
// server copy always wins for a completed set.

export interface SetDraft {
  weight: string;
  reps: string;
}

const keyFor = (workoutId: string) => `@progresso/liveWorkoutDraft/${workoutId}`;

/** Writes the drafts for one workout. A storage failure is never shown: the draft is a convenience. */
export async function saveLiveWorkoutDraft(
  workoutId: string,
  drafts: Record<string, SetDraft>,
): Promise<void> {
  try {
    await AsyncStorage.setItem(keyFor(workoutId), JSON.stringify(drafts));
  } catch {
    // Non-critical: the workout itself is saved on the server.
  }
}

/** The saved drafts for one workout. Empty when none exist or the stored value is unreadable. */
export async function loadLiveWorkoutDraft(workoutId: string): Promise<Record<string, SetDraft>> {
  try {
    const raw = await AsyncStorage.getItem(keyFor(workoutId));
    if (!raw) return {};
    const parsed: unknown = JSON.parse(raw);
    return parsed && typeof parsed === 'object' ? (parsed as Record<string, SetDraft>) : {};
  } catch {
    return {};
  }
}

/** Removes the drafts once a workout is finished or cancelled. */
export async function clearLiveWorkoutDraft(workoutId: string): Promise<void> {
  try {
    await AsyncStorage.removeItem(keyFor(workoutId));
  } catch {
    // Non-critical.
  }
}

/**
 * The inputs to show after a reload: the saved values, with any draft typed into a set that is
 * still open put over them. A completed set keeps its saved values, since it is locked and was
 * written to the server when it was completed.
 */
export function mergeLiveWorkoutDrafts(
  saved: Record<string, SetDraft>,
  drafts: Record<string, SetDraft>,
  openSetIds: ReadonlySet<string>,
): Record<string, SetDraft> {
  const merged = { ...saved };
  for (const [setId, draft] of Object.entries(drafts)) {
    if (!openSetIds.has(setId)) continue;
    if (draft.weight === '' && draft.reps === '') continue;
    merged[setId] = draft;
  }
  return merged;
}

/** The drafts worth keeping: open sets with something typed in them. */
export function pendingDraftsFor(
  inputs: Record<string, SetDraft>,
  openSetIds: ReadonlySet<string>,
): Record<string, SetDraft> {
  const pending: Record<string, SetDraft> = {};
  for (const [setId, input] of Object.entries(inputs)) {
    if (!openSetIds.has(setId)) continue;
    if (input.weight === '' && input.reps === '') continue;
    pending[setId] = input;
  }
  return pending;
}
