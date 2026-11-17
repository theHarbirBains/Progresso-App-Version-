import type { ExerciseRow } from './exerciseQueries';

/** Someone you follow who shares exercises with you, and how many. */
export interface SharingFriend {
  id: string;
  name: string;
  count: number;
}

/** The people you follow who share exercises with you, by name -- the Friends tab's filter. */
export function sharingFriends(shared: ExerciseRow[]): SharingFriend[] {
  const friends = new Map<string, SharingFriend>();
  for (const row of shared) {
    if (row.shared?.source !== 'friend') continue;
    const { ownerId, ownerName } = row.shared;
    const friend = friends.get(ownerId) ?? { id: ownerId, name: ownerName, count: 0 };
    friend.count += 1;
    friends.set(ownerId, friend);
  }
  return [...friends.values()].sort((a, b) => a.name.localeCompare(b.name));
}
