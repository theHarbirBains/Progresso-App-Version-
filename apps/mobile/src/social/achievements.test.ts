import type { ProfileStats } from '../lib/api';
import {
  achievementsFor,
  byRank,
  compactNumber,
  rankFor,
  ranksEarned,
  reachedPerRank,
  type NutritionFigures,
} from './achievements';

function stats(extra: Partial<ProfileStats> = {}): ProfileStats {
  return {
    workouts: 0,
    lastThirtyDays: 0,
    totalVolumeKg: 0,
    prCount: 0,
    bestMonthWorkouts: 0,
    totalSets: 0,
    totalReps: 0,
    trainingMinutes: 0,
    oneRepMaxCount: 0,
    exerciseCount: 0,
    bestSessionVolumeKg: 0,
    bodyweightReps: 0,
    timedSeconds: 0,
    groupWorkouts: 0,
    committedMonths: 0,
    strongWeeks: 0,
    likesReceived: 0,
    likesGiven: 0,
    ...extra,
  };
}

const food: NutritionFigures = {
  daysLogged: 40,
  foodsLogged: 120,
  proteinG: 6_000,
  calories: 60_000,
  recipes: 2,
  savedMeals: 0,
};

const find = (list: ReturnType<typeof achievementsFor>, id: string) => {
  const found = list.find((a) => a.id === id);
  if (!found) throw new Error(`No ${id}`);
  return found;
};

describe('compactNumber', () => {
  it('shortens thousands and millions, never rounding up', () => {
    expect(compactNumber(950)).toBe('950');
    expect(compactNumber(42_800)).toBe('42.8K');
    expect(compactNumber(100_000)).toBe('100K');
    expect(compactNumber(1_250_000)).toBe('1.25M');
    expect(compactNumber(999.9)).toBe('999');
  });
});

describe('rankFor', () => {
  const goals = [10, 50, 100, 200, 350, 500, 750, 1_000, 1_500];

  it('is -1 before Bronze, then the highest goal reached, up to Legacy', () => {
    expect(rankFor(goals, 9)).toBe(-1);
    expect(rankFor(goals, 10)).toBe(0);
    expect(rankFor(goals, 120)).toBe(2);
    expect(rankFor(goals, 1_499)).toBe(7);
    expect(rankFor(goals, 9_999)).toBe(8);
  });
});

describe('achievementsFor', () => {
  it("ranks a profile's training and social figures -- nutrition only on your own page", () => {
    const profile = achievementsFor({ stats: stats(), followers: 0 }, 'kg');
    expect(profile).toHaveLength(18);
    expect(profile.some((a) => a.category === 'nutrition')).toBe(false);

    const own = achievementsFor({ stats: stats(), followers: 0, nutrition: food }, 'kg');
    expect(own).toHaveLength(24);
    expect(find(own, 'food-days')).toMatchObject({ rank: 2, valueLabel: '40 days' });
  });

  it('says where they are and how far to the next rank', () => {
    const workouts = find(
      achievementsFor({ stats: stats({ workouts: 120 }), followers: 0 }, 'kg'),
      'workouts',
    );

    expect(workouts).toMatchObject({
      title: 'Iron Regular',
      rank: 2,
      valueLabel: '120 workouts',
      progress: 0.2,
    });
    expect(workouts.goalLabels).toEqual([
      '10 workouts',
      '50 workouts',
      '100 workouts',
      '200 workouts',
      '350 workouts',
      '500 workouts',
      '750 workouts',
      '1,000 workouts',
      '1,500 workouts',
    ]);
  });

  it('starts every achievement unranked with no progress, and fills at Legacy', () => {
    const none = achievementsFor({ stats: stats(), followers: 0 }, 'kg');
    expect(none.every((a) => a.rank === -1 && a.progress === 0)).toBe(true);

    const legacy = find(
      achievementsFor({ stats: stats({ workouts: 2_000 }), followers: 0 }, 'kg'),
      'workouts',
    );
    expect(legacy).toMatchObject({ rank: 8, progress: 1 });
  });

  it('ranks weight on kilograms for everyone, reading it round in pounds', () => {
    const kg = find(
      achievementsFor({ stats: stats({ totalVolumeKg: 12_000 }), followers: 0 }, 'kg'),
      'volume',
    );
    const lb = find(
      achievementsFor({ stats: stats({ totalVolumeKg: 12_000 }), followers: 0 }, 'lb'),
      'volume',
    );

    expect(kg.rank).toBe(0);
    expect(lb.rank).toBe(0);
    expect(kg.goalLabels.slice(0, 2)).toEqual(['10K kg', '50K kg']);
    expect(lb.goalLabels.slice(0, 2)).toEqual(['22K lb', '110K lb']);
    expect(lb.valueLabel).toBe('26.5K lb');
  });

  it('reads time in hours and minutes, protein as weight and calories as cal', () => {
    const list = achievementsFor(
      {
        stats: stats({ trainingMinutes: 570, timedSeconds: 420 }),
        followers: 3,
        nutrition: food,
      },
      'lb',
    );

    expect(find(list, 'time')).toMatchObject({ rank: -1, valueLabel: '9.5 hours' });
    expect(find(list, 'time').goalLabels[0]).toBe('10 hours');
    expect(find(list, 'timed')).toMatchObject({ rank: 0, valueLabel: '7 min' });
    expect(find(list, 'protein').goalLabels[0]).toBe('2.2 lb');
    expect(find(list, 'calories')).toMatchObject({ rank: 1, valueLabel: '60K cal' });
    expect(find(list, 'followers')).toMatchObject({ rank: 0, valueLabel: '3 followers' });
  });

  it('says one of a thing without a plural', () => {
    const list = achievementsFor({ stats: stats({ prCount: 1 }), followers: 1 }, 'kg');
    expect(find(list, 'prs').valueLabel).toBe('1 PR');
    expect(find(list, 'followers').valueLabel).toBe('1 follower');
  });
});

describe('ranksEarned, reachedPerRank and byRank', () => {
  const list = achievementsFor(
    { stats: stats({ workouts: 120, prCount: 12, totalSets: 150 }), followers: 0 },
    'kg',
  );

  it('counts every rank earned, and how many reached each', () => {
    // Gold (3) + Silver (2) + Bronze (1).
    expect(ranksEarned(list)).toBe(6);
    expect(reachedPerRank(list)).toEqual([3, 2, 1, 0, 0, 0, 0, 0, 0]);
  });

  it('puts the highest rank first, then the usual order', () => {
    expect(
      byRank(list)
        .slice(0, 4)
        .map((a) => a.id),
    ).toEqual(['workouts', 'prs', 'sets', 'volume']);
  });
});
