import type { MuscleGroup } from '../exercises/muscleGroups';
import {
  ACTIVITY_GROUPS,
  ACTIVITY_LEVEL_NOTES,
  levelFor,
  muscleActivity,
  musclesTrained,
  periodStart,
  sessionShare,
  sinceText,
  sortBreakdown,
  trendBuckets,
} from './muscleActivity';
import type { ActivityEntry } from './muscleActivityQueries';

// Wednesday Nov 25 2026, mid-afternoon, local time.
const NOW = new Date(2026, 10, 25, 15, 0);

function daysAgo(days: number, hour = 10): string {
  return new Date(2026, 10, 25 - days, hour).toISOString();
}

let workout = 0;
function entry(
  over: Partial<Omit<ActivityEntry, 'sets'>> & { daysAgo: number; setCount?: number },
): ActivityEntry {
  const count = over.setCount ?? 3;
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
        entry({ daysAgo: 10, workoutId: 'b', setCount: 4 }),
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
    // Only as a muscle an exercise also works: never coloured as trained.
    expect(triceps.level).toBe('none');
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
    expect(groupOf(activity, 'core')).toMatchObject({ sets: 1, volumeKg: 0, level: 'frequent' });
  });

  it('colours each group by when it was last trained: 1–2, 3–7, 8–14 days, or longer', () => {
    const activity = muscleActivity(
      [
        entry({ daysAgo: 1, muscleGroup: 'back', exerciseId: 'row' }),
        // The last time counts, however often before it.
        entry({ daysAgo: 2, muscleGroup: 'quadriceps', exerciseId: 'squat' }),
        entry({ daysAgo: 20, muscleGroup: 'quadriceps', exerciseId: 'squat' }),
        entry({ daysAgo: 9, muscleGroup: 'calves', exerciseId: 'calf' }),
        entry({ daysAgo: 16, muscleGroup: 'glutes', exerciseId: 'thrust' }),
      ],
      30,
      NOW,
      secondaryOf,
    );
    expect(groupOf(activity, 'back').level).toBe('recent');
    expect(groupOf(activity, 'quadriceps').level).toBe('frequent');
    expect(groupOf(activity, 'calves').level).toBe('less');
    expect(groupOf(activity, 'glutes').level).toBe('none');
    expect(groupOf(activity, 'glutes').sets).toBe(3);
    expect(groupOf(activity, 'hamstrings').level).toBe('none');
    // Biceps only as a muscle a row also works: not trained.
    expect(groupOf(activity, 'biceps').level).toBe('none');
    expect(ACTIVITY_LEVEL_NOTES).toEqual({
      recent: '1–2 days',
      frequent: '3–7 days',
      less: '8–14 days',
      none: '15+ days',
    });
  });

  it('draws each band from the day, today its first', () => {
    expect(levelFor(daysAgo(0, 1), NOW)).toBe('recent');
    expect(levelFor(daysAgo(1, 0), NOW)).toBe('recent');
    expect(levelFor(daysAgo(2, 23), NOW)).toBe('frequent');
    expect(levelFor(daysAgo(6), NOW)).toBe('frequent');
    expect(levelFor(daysAgo(7), NOW)).toBe('less');
    expect(levelFor(daysAgo(13), NOW)).toBe('less');
    expect(levelFor(daysAgo(14), NOW)).toBe('none');
    expect(levelFor(null, NOW)).toBe('none');
  });

  it('colours only what was trained in the period chosen', () => {
    // Ten days ago: Less trained over 30 days, but not in the last 7 at all.
    const entries = [entry({ daysAgo: 10 })];
    expect(groupOf(muscleActivity(entries, 30, NOW, secondaryOf), 'chest').level).toBe('less');
    expect(groupOf(muscleActivity(entries, 7, NOW, secondaryOf), 'chest').level).toBe('none');
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

  it('gives sessions a week, on average over the period', () => {
    const eight = Array.from({ length: 8 }, (_, i) => entry({ daysAgo: 3 + i * 3 }));
    expect(groupOf(muscleActivity(eight, 30, NOW, secondaryOf), 'chest').perWeek).toBeCloseTo(
      8 / (30 / 7),
    );
  });

  it('buckets the trend by day for a week and by seven days for longer', () => {
    expect(trendBuckets(7, NOW)).toHaveLength(7);
    expect(trendBuckets(30, NOW)).toHaveLength(5);
    expect(trendBuckets(90, NOW)).toHaveLength(13);
    expect(trendBuckets(30, NOW)[0]).toEqual(periodStart(30, NOW));
    const activity = muscleActivity(
      [entry({ daysAgo: 0, setCount: 2 }), entry({ daysAgo: 8, setCount: 5 })],
      30,
      NOW,
      secondaryOf,
    );
    const trend = groupOf(activity, 'chest').trend.map((b) => b.sets);
    expect(trend).toEqual([0, 0, 0, 5, 2]);
  });
});

describe('Muscle Breakdown', () => {
  const activity = muscleActivity(
    [
      // Chest: three sessions, last 4 days ago. Back: one, yesterday. Quads: two, 2 days ago.
      entry({ daysAgo: 4, workoutId: 'c1' }),
      entry({ daysAgo: 8, workoutId: 'c2' }),
      entry({ daysAgo: 12, workoutId: 'c3' }),
      entry({ daysAgo: 1, muscleGroup: 'back', exerciseId: 'row', setCount: 5 }),
      entry({ daysAgo: 2, muscleGroup: 'quadriceps', exerciseId: 'squat', workoutId: 'q1' }),
      entry({ daysAgo: 9, muscleGroup: 'quadriceps', exerciseId: 'squat', workoutId: 'q2' }),
    ],
    30,
    NOW,
    secondaryOf,
  );
  const order = (sort: 'recent' | 'most' | 'least') =>
    sortBreakdown(activity, sort).map((g) => g.group);

  it('counts the muscles trained as the main muscle -- never one only also worked', () => {
    expect(musclesTrained(activity)).toBe(3);
  });

  it('sorts by the last trained, then the rest in the app’s order', () => {
    expect(order('recent').slice(0, 4)).toEqual(['back', 'quadriceps', 'chest', 'shoulders']);
    expect(order('recent')).toHaveLength(ACTIVITY_GROUPS.length);
  });

  it('sorts by most sessions, then sets -- and by fewest', () => {
    expect(order('most').slice(0, 3)).toEqual(['chest', 'quadriceps', 'back']);
    expect(order('least').slice(-3)).toEqual(['back', 'quadriceps', 'chest']);
    expect(order('least')[0]).toBe('shoulders');
  });

  it('gives each a share of the busiest muscle’s sessions', () => {
    const share = (group: MuscleGroup) => sessionShare(groupOf(activity, group), activity);
    expect(share('chest')).toBe(1);
    expect(share('quadriceps')).toBeCloseTo(2 / 3);
    expect(share('hamstrings')).toBe(0);
    const none = muscleActivity([], 30, NOW, secondaryOf);
    expect(sessionShare(none[0]!, none)).toBe(0);
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
