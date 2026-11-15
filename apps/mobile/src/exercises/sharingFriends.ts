import type { ExerciseRow } from './exerciseQueries';

/** The people you follow who share exercises with you, by name -- the Friends tab's filter. */
export function sharingFriends(shared: ExerciseRow[]): { id: string; name: string }[] {
  const friends = new Map<string, string>();
  for (const row of shared) {
    if (row.shared?.source === 'friend') friends.set(row.shared.ownerId, row.shared.ownerName);
  }
  return [...friends]
    .map(([id, name]) => ({ id, name }))
    .sort((a, b) => a.name.localeCompare(b.name));
}
