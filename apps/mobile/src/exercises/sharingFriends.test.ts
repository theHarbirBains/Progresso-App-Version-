import type { ExerciseRow } from './exerciseQueries';
import { sharingFriends } from './sharingFriends';

describe('sharingFriends', () => {
  const row = (
    id: string,
    source: 'friend' | 'trainer',
    ownerId: string,
    ownerName: string,
  ): ExerciseRow => ({
    id,
    name: id,
    muscleGroup: 'back',
    movementType: 'bilateral',
    loggingStyle: null,
    measurementType: 'weight_reps',
    photoUrl: null,
    isActive: true,
    createdBy: ownerId,
    shared: { source, ownerId, ownerName, inLibrary: false },
  });

  it('lists each friend who shares once, A-Z, and never a trainer or client', () => {
    expect(
      sharingFriends([
        row('a', 'friend', 'sam', 'Sam'),
        row('b', 'trainer', 'coach', 'Coach'),
        row('c', 'friend', 'lisa', 'Lisa'),
        row('d', 'friend', 'sam', 'Sam'),
      ]),
    ).toEqual([
      { id: 'lisa', name: 'Lisa', count: 1 },
      { id: 'sam', name: 'Sam', count: 2 },
    ]);
  });
});
