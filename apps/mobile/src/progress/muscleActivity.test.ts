import type { MuscleGroup } from '../exercises/muscleGroups';
import {
  ACTIVITY_GROUPS,
  lessTrained,
  muscleActivity,
  periodStart,
  sinceText,
  trendBuckets,
} from './muscleActivity';
import type { ActivityEntry } from './muscleActivityQueries';

// Wednesday Nov 25 2026, mid-afternoon, local time.
const NOW = new Date(2026, 10, 25, 15, 0);

function daysAgo(days: number, hour = 10): string {
  return new Date(2026, 10, 25 - days, hour).toISOString();
}

let workout = 0;
function entry(over: Partial<ActivityEntry> & { daysAgo: number; sets?: number }): ActivityEntry {
  const count = over.sets ?? 3;
  workout += 1;
  return {
    workoutId: over.workoutId ?? `w${workout}`,
    performedAt: daysAgo(over.daysAgo),
    exerciseId: over.exerciseId ?? 'bench',
    exerciseName: over.exerciseName ?? 'Bench Press',
    muscleGroup: over.muscleGroup ?? 'chest',
    measurementType: over.measurementType ?? 'weight_reps',
    sets: Array.from({ length: count }, () => ({ weightKg: 100, reps: 5, isDrop: false })),
  };
}

const SECONDARY: Record<string, MuscleGroup[]> = {
  bench: ['shoulders', 'triceps'],
  row: ['biceps'],
};
const secondaryOf = (id: string) => SECONDARY[id] ?? [];

function groupOf(activity: ReturnType<typeof muscleActivity>, group: MuscleGroup) {
  return activity.find((g) => g.group === group)!;
}

describe('muscleActivity', () => {
  it('lists every group on the figure, trained or not', () => {
    const activity = muscleActivity([], 30, NOW, secondaryOf);
    expect(activity.map((g) => g.group)).toEqual(ACTIVITY_GROUPS);
    expect(activity.every((g) => g.level === 'none' && g.sets === 0)).toBe(true);
    expect(ACTIVITY_GROUPS).not.toContain('full_body');
    expect(ACTIVITY_GROUPS).not.toContain('other');
  });

  it('counts working sets, sessions and volume for the exercise’s own group', () => {
    const activity = muscleActivity(
      [
        entry({ daysAgo: 3, workoutId: 'a' }),
        entry({ daysAgo: 10, workoutId: 'b', sets: 4 }),
        // A drop adds its volume, never a set of its own.
        {
          ...entry({ daysAgo: 10, workoutId: 'b', exerciseId: 'fly', exerciseName: 'Fly' }),
          sets: [
            { weightKg: 20, reps: 10, isDrop: false },
            { weightKg: 10, reps: 10, isDrop: true },
          ],
        },
      ],
      30,
      NOW,
      secondaryOf,
    );
    const chest = groupOf(activity, 'chest');
    expect(chest.sets).toBe(3 + 4 + 1);
    expect(chest.sessions).toBe(2);
    expect(chest.volumeKg).toBe(7 * 500 + 200 + 100);
    expect(chest.lastTrainedAt).toBe(daysAgo(3));
    expect(chest.exercises.map((e) => e.name)).toEqual(['Bench Press', 'Fly']);
  });

  it('keeps the muscles an exercise also works apart -- never counted as its own sets', () => {
    const activity = muscleActivity([entry({ daysAgo: 3 })], 30, NOW, secondaryOf);
    const triceps = groupOf(activity, 'triceps');
    expect(triceps.sets).toBe(0);
    expect(triceps.secondarySets).toBe(3);
    expect(triceps.secondarySessions).toBe(1);
    expect(triceps.volumeKg).toBe(0);
    expect(triceps.lastTrainedAt).toBeNull();
    expect(triceps.lastWorkedAt).toBe(daysAgo(3));
    expect(triceps.level).toBe('less');
    expect(triceps.exercises[0]).toMatchObject({ name: 'Bench Press', primary: false });
  });

  it('gives bodyweight and timed sets their sets, never a volume', () => {
    const activity = muscleActivity(
      [
        {
          ...entry({ daysAgo: 4, muscleGroup: 'core', exerciseId: 'plank', exerciseName: 'Plank' }),
          measurementType: 'timed',
          sets: [{ weightKg: null, reps: null, isDrop: false }],
        },
      ],
      7,
      NOW,
      secondaryOf,
    );
    expect(groupOf(activity, 'core')).toMatchObject({ sets: 1, volumeKg: 0, level: 'less' });
  });

  it('says recently trained for today or yesterday, frequently for twice a week, less otherwise', () => {
    const activity = muscleActivity(
      [
        entry({ daysAgo: 1, muscleGroup: 'back', exerciseId: 'row' }),
        // Legs four times in 14 days... over 7 days, twice.
        entry({ daysAgo: 2, muscleGroup: 'quadriceps', exerciseId: 'squat' }),
        entry({ daysAgo: 5, muscleGroup: 'quadriceps', exerciseId: 'squat' }),
        entry({ daysAgo: 4, muscleGroup: 'calves', exerciseId: 'calf' }),
      ],
      7,
      NOW,
      secondaryOf,
    );
    expect(groupOf(activity, 'back').level).toBe('recent');
    expect(groupOf(activity, 'quadriceps').level).toBe('frequent');
    expect(groupOf(activity, 'calves').level).toBe('less');
    expect(groupOf(activity, 'hamstrings').level).toBe('none');
    // Biceps only as a muscle a row also works: less, not none.
    expect(groupOf(activity, 'biceps').level).toBe('less');
  });

  it('only counts the period chosen', () => {
    const entries = [entry({ daysAgo: 20 }), entry({ daysAgo: 60 })];
    expect(groupOf(muscleActivity(entries, 7, NOW, secondaryOf), 'chest').sets).toBe(0);
    expect(groupOf(muscleActivity(entries, 30, NOW, secondaryOf), 'chest').sets).toBe(3);
    expect(groupOf(muscleActivity(entries, 90, NOW, secondaryOf), 'chest').sets).toBe(6);
    // Six days ago is in the last 7 (today and the six before); seven days ago isn't.
    expect(
      groupOf(muscleActivity([entry({ daysAgo: 6 })], 7, NOW, secondaryOf), 'chest').sets,
    ).toBe(3);
    expect(
      groupOf(muscleActivity([entry({ daysAgo: 7 })], 7, NOW, secondaryOf), 'chest').sets,
    ).toBe(0);
  });

  it('ranks frequency per week whatever the period', () => {
    // Eight chest sessions in 30 days: 1.9 a week -- not quite twice.
    const eight = Array.from({ length: 8 }, (_, i) => entry({ daysAgo: 3 + i * 3 }));
    const nine = [...eight, entry({ daysAgo: 28 })];
    expect(groupOf(muscleActivity(eight, 30, NOW, secondaryOf), 'chest').level).toBe('less');
    expect(groupOf(muscleActivity(nine, 30, NOW, secondaryOf), 'chest').level).toBe('frequent');
  });

  it('buckets the trend by day for a week and by seven days for longer', () => {
    expect(trendBuckets(7, NOW)).toHaveLength(7);
    expect(trendBuckets(30, NOW)).toHaveLength(5);
    expect(trendBuckets(90, NOW)).toHaveLength(13);
    expect(trendBuckets(30, NOW)[0]).toEqual(periodStart(30, NOW));
    const activity = muscleActivity(
      [entry({ daysAgo: 0, sets: 2 }), entry({ daysAgo: 8, sets: 5 })],
      30,
      NOW,
      secondaryOf,
    );
    const trend = groupOf(activity, 'chest').trend.map((b) => b.sets);
    expect(trend).toEqual([0, 0, 0, 5, 2]);
  });
});

describe('lessTrained', () => {
  it('points out the main groups trained least, fewest sets first -- never adductors', () => {
    const activity = muscleActivity(
      [
        entry({ daysAgo: 3, muscleGroup: 'back', exerciseId: 'row', sets: 2 }),
        ...Array.from({ length: 10 }, (_, i) => entry({ daysAgo: 1 + i })),
      ],
      30,
      NOW,
      secondaryOf,
    );
    const fewest = lessTrained(activity).map((g) => g.group);
    expect(fewest).not.toContain('chest');
    expect(fewest).not.toContain('adductors');
    expect(fewest.indexOf('hamstrings')).toBeLessThan(fewest.indexOf('back'));
    // Untrained, then only as an also-worked muscle, then trained a little.
    expect(fewest.indexOf('hamstrings')).toBeLessThan(fewest.indexOf('triceps'));
    expect(fewest.indexOf('triceps')).toBeLessThan(fewest.indexOf('back'));
  });
});

describe('sinceText', () => {
  it('says how long ago, in plain words', () => {
    expect(sinceText(daysAgo(0), NOW)).toBe('Today');
    expect(sinceText(daysAgo(1), NOW)).toBe('Yesterday');
    expect(sinceText(daysAgo(5), NOW)).toBe('5 days ago');
    expect(sinceText(null, NOW)).toBeNull();
  });
});
