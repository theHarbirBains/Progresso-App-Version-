import { measurementTypeOf } from '../exercises/movementTypes';
import { getGroup } from '../lib/api';
import { loggedSets } from './setValues';
import { fetchWorkoutDetail, type WorkoutDetail } from './workoutQueries';

// A past group workout, as everyone in it did it. Each person's workout is their own record;
// a joined member can read every workout in the group (the database's group policies), and the
// group itself -- who was in it, and their names -- comes from the API.

export interface GroupWorkoutPerson {
  userId: string;
  displayName: string | null;
  workout: WorkoutDetail;
}

/** "Jashan" from "Jashan Singh"; "Member" without a name. */
export function firstName(name: string | null): string {
  return name?.trim().split(/\s+/)[0] || 'Member';
}

/** The sets actually logged in a workout -- each holding what its exercise records. */
export function loggedSetCount(workout: WorkoutDetail): number {
  return workout.exercises.reduce(
    (sum, exercise) => sum + loggedSets(exercise.sets, measurementTypeOf(exercise)).length,
    0,
  );
}

/**
 * Everyone's workout in the group `shown` belongs to, in the group's order -- `shown` itself as
 * it was read. Someone who logged nothing (a trainer who only coached, say) is left out, unless
 * it's `shown`; so is a workout that wasn't finished or can't be read. Null when the group can't
 * be read at all -- the viewer isn't in it (a trainer looking at a client's workout from a group
 * they weren't part of) -- and the page shows `shown` alone.
 */
export async function fetchGroupWorkouts(
  accessToken: string,
  groupId: string,
  shown: WorkoutDetail,
): Promise<GroupWorkoutPerson[] | null> {
  let members;
  try {
    members = (await getGroup(accessToken, groupId)).members;
  } catch {
    return null;
  }
  const people = await Promise.all(
    members.map(async (member): Promise<GroupWorkoutPerson | null> => {
      if (!member.workoutId) return null;
      if (member.workoutId === shown.id) {
        return { userId: member.userId, displayName: member.displayName, workout: shown };
      }
      try {
        const workout = await fetchWorkoutDetail(member.workoutId);
        if (!workout.completedAt || loggedSetCount(workout) === 0) return null;
        return { userId: member.userId, displayName: member.displayName, workout };
      } catch {
        return null;
      }
    }),
  );
  return people.filter((person): person is GroupWorkoutPerson => person !== null);
}

/** Whether a workout has any set logged in it -- worth a share card. False if it can't be read. */
export async function hasLoggedSets(workoutId: string): Promise<boolean> {
  try {
    return loggedSetCount(await fetchWorkoutDetail(workoutId)) > 0;
  } catch {
    return false;
  }
}
