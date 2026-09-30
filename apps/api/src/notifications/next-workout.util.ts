// Pure derivation, no data fetching -- the server-side mirror of the
// mobile app's own computeNextWorkout (apps/mobile/src/workouts/
// nextWorkout.ts): given a split's ordered days and which day (if any) the
// user's most recently completed workout was tagged with, advance to the
// next day, cycling back to day 1 after the last one. Duplicated rather
// than shared because the two apps have no shared package to put it in --
// see that file's own comment for the exact same "no days -> null,
// no/stale last-tagged day -> day 1" rules this follows.

export interface SplitDayForReminder {
  id: string;
  name: string;
  orderIndex: number;
  muscleGroups: string[];
}

export function computeNextWorkoutDay(
  days: SplitDayForReminder[],
  lastCompletedDayId: string | null,
): SplitDayForReminder | null {
  const ordered = [...days].sort((a, b) => a.orderIndex - b.orderIndex);
  if (ordered.length === 0) return null;

  const lastIndex =
    lastCompletedDayId !== null ? ordered.findIndex((d) => d.id === lastCompletedDayId) : -1;

  if (lastIndex === -1) return ordered[0]!;

  const nextIndex = (lastIndex + 1) % ordered.length;
  return ordered[nextIndex]!;
}

function humanizeMuscleGroup(group: string): string {
  return group.replace(/_/g, ' ');
}

/** "chest, back, & abs" -- an Oxford-comma-with-ampersand join, matching how this reminder's own copy reads. */
function joinWithAmpersand(items: string[]): string {
  if (items.length === 0) return '';
  if (items.length === 1) return items[0]!;
  if (items.length === 2) return `${items[0]} & ${items[1]}`;
  return `${items.slice(0, -1).join(', ')}, & ${items[items.length - 1]}`;
}

/** "Come on Harbir, you've got chest, back, & abs waiting to be crushed." -- falls back to the day's own name when it has no muscle groups tagged. */
export function buildNextWorkoutMessage(
  displayName: string | null,
  day: SplitDayForReminder,
): string {
  const name = displayName?.trim() || 'there';
  if (day.muscleGroups.length === 0) {
    return `Come on ${name}, your ${day.name} workout is waiting to be crushed.`;
  }
  const labels = day.muscleGroups.map(humanizeMuscleGroup);
  return `Come on ${name}, you've got ${joinWithAmpersand(labels)} waiting to be crushed.`;
}
