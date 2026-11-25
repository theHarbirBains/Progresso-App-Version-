import { measurementTypeOf } from '../exercises/movementTypes';
import { getFriendWorkout, getGroup, type FriendWorkout } from '../lib/api';
import { friendWorkoutDetail } from '../social/friendWorkout';
import { loggedSets } from './setValues';
import { fetchWorkoutDetail, type WorkoutDetail } from './workoutQueries';

// A past group workout, as everyone in it did it. Each person's workout is their own record;
// a joined member can read every workout in the group (the database's group policies), and the
// group itself -- who was in it, and their names -- comes from the API.

export interface GroupWorkoutPerson {
  userId: string;
  displayName: string | null;
  workout: WorkoutDetail;
  avatarUrl?: string | null;
}

/** Someone in a friend's group workout whose workout you may not see: who they are, only. */
export interface HiddenGroupPerson {
  userId: string;
  displayName: string | null;
  username: string | null;
  avatarUrl: string | null;
}

/** A friend's group workout, a tab a person in the group's order: theirs to read, or hidden. */
export type FriendGroupEntry =
  { kind: 'shown'; person: GroupWorkoutPerson } | { kind: 'hidden'; person: HiddenGroupPerson };

/**
 * Everyone in the group a friend's workout was part of, as the API says you may see them
 * (`group.participants`): each one you may see read through GET /workouts/:id -- which checks
 * again -- and the rest only by name and photo. Someone whose workout can't be read after all is
 * hidden too, never guessed at. Null when it wasn't a group workout, or only they trained in it.
 */
export async function fetchFriendGroupWorkouts(
  accessToken: string,
  theirs: FriendWorkout,
  shown: WorkoutDetail,
  viewerId: string,
): Promise<FriendGroupEntry[] | null> {
  const participants = theirs.group?.participants ?? [];
  if (participants.length < 2) return null;
  return Promise.all(
    participants.map(async (participant): Promise<FriendGroupEntry> => {
      const who = {
        userId: participant.user.id,
        displayName: participant.user.id === viewerId ? 'You' : participant.user.displayName,
        avatarUrl: participant.user.avatarUrl,
      };
      if (participant.isAuthor) {
        return { kind: 'shown', person: { ...who, workout: shown } };
      }
      if (participant.canSeeWorkout && participant.workoutId) {
        try {
          const workout = friendWorkoutDetail(
            await getFriendWorkout(accessToken, participant.workoutId),
          );
          return { kind: 'shown', person: { ...who, workout } };
        } catch {
          // Not to be read after all: who they are, only.
        }
      }
      return {
        kind: 'hidden',
        person: { ...who, username: participant.user.username },
      };
    }),
  );
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
