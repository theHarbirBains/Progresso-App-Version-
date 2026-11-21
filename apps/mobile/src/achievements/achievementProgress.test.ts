import { achievementStatuses, goalText, levelText, lifetimePoints } from './achievementProgress';
import type { AchievementDefinition } from './achievementQueries';

const LB = 0.45359237;

function definition(extra: Partial<AchievementDefinition>): AchievementDefinition {
  return {
    id: 'iron-regular',
    category: 'workouts',
    kind: 'levels',
    title: 'Iron Regular',
    description: 'Finish workouts',
    icon: 'activity',
    metric: 'workouts',
    unit: 'count',
    goalLabel: 'workouts',
    visibility: 'public',
    sort: 90,
    levels: [
      { level: 1, goal: 5, ap: 50 },
      { level: 2, goal: 10, ap: 75 },
      { level: 3, goal: 25, ap: 125 },
    ],
    ...extra,
  };
}

const guns = definition({
  id: 'guns-blazin',
  category: 'muscles',
  title: "Guns Blazin'",
  description: 'Lift weight on biceps exercises',
  metric: 'muscle_volume_kg_biceps',
  unit: 'kg',
  goalLabel: 'lifted on biceps',
  levels: [
    { level: 1, goal: 1_000 * LB, ap: 20 },
    { level: 2, goal: 10_000 * LB, ap: 40 },
    { level: 3, goal: 40_000 * LB, ap: 75 },
  ],
});

const award = (
  achievementId: string,
  level: number,
  ap: number,
  awardedAt = '2026-11-01T10:00:00Z',
) => ({
  achievementId,
  level,
  ap,
  awardedAt,
});

describe('achievementStatuses', () => {
  it('starts at no level, measuring the way to level 1 exactly', () => {
    const [status] = achievementStatuses(
      [definition({})],
      [],
      [{ achievementId: 'iron-regular', value: 3, level: 0 }],
      'lb',
    );

    expect(status).toMatchObject({ level: 0, levels: 3, earned: false, maxed: false });
    expect(status!.next).toEqual({ level: 1, goal: 5, ap: 50 });
    expect(status!.progressLabel).toBe('3 / 5');
    expect(status!.progress).toBe(0.6);
    expect(status!.nextGoalLabel).toBe('5 workouts');
    expect(levelText(status!)).toBe('Not started');
  });

  it("measures the way from the last level reached to the next, and the AP it's brought", () => {
    const [status] = achievementStatuses(
      [definition({})],
      [award('iron-regular', 1, 50), award('iron-regular', 2, 75, '2026-11-08T10:00:00Z')],
      [{ achievementId: 'iron-regular', value: 16, level: 2 }],
      'lb',
    );

    expect(status).toMatchObject({
      level: 2,
      earned: true,
      apEarned: 125,
      lastAwardedAt: '2026-11-08T10:00:00Z',
    });
    // 16 of the way from 10 to 25.
    expect(status!.progress).toBeCloseTo(6 / 15);
    expect(status!.next).toEqual({ level: 3, goal: 25, ap: 125 });
    expect(levelText(status!)).toBe('Level 2 of 3');
  });

  it('never shows a level below one awarded, whatever the figure does after', () => {
    const [status] = achievementStatuses(
      [definition({})],
      [award('iron-regular', 1, 50), award('iron-regular', 2, 75)],
      [{ achievementId: 'iron-regular', value: 0, level: 0 }],
      'lb',
    );
    expect(status!.level).toBe(2);
  });

  it('says when every level is reached', () => {
    const [status] = achievementStatuses(
      [definition({})],
      [award('iron-regular', 1, 50), award('iron-regular', 2, 75), award('iron-regular', 3, 125)],
      [{ achievementId: 'iron-regular', value: 30, level: 3 }],
      'lb',
    );
    expect(status).toMatchObject({ maxed: true, next: null, progress: 1, apEarned: 250 });
  });

  it("reads weight in the reader's own unit, as the goal was set", () => {
    const progress = [{ achievementId: 'guns-blazin', value: 2_000, level: 1 }];
    const lb = achievementStatuses([guns], [award('guns-blazin', 1, 20)], progress, 'lb')[0]!;
    const kg = achievementStatuses([guns], [award('guns-blazin', 1, 20)], progress, 'kg')[0]!;

    expect(lb.progressLabel).toBe('4,409 / 10,000 lb');
    expect(lb.nextGoalLabel).toBe('10,000 lb lifted on biceps');
    expect(kg.progressLabel).toBe('2,000 / 4,536 kg');
    expect(goalText(guns, guns.levels[2]!.goal, 'lb')).toBe('40,000 lb lifted on biceps');
  });

  it('says a single unlock is unlocked or locked', () => {
    const single = definition({
      id: 'first-steps',
      kind: 'single',
      levels: [{ level: 1, goal: 1, ap: 25 }],
    });
    const [locked] = achievementStatuses([single], [], [], 'lb');
    const [unlocked] = achievementStatuses([single], [award('first-steps', 1, 25)], [], 'lb');
    expect(levelText(locked!)).toBe('Locked');
    expect(levelText(unlocked!)).toBe('Unlocked');
  });
});

describe('a distance achievement', () => {
  const MI = 1.609344;
  const mileMarker = definition({
    id: 'mile-marker',
    category: 'cardio',
    title: 'Mile Marker',
    metric: 'cardio_distance_km',
    unit: 'km',
    goalLabel: 'covered',
    levels: [
      { level: 1, goal: 5 * MI, ap: 20 },
      { level: 2, goal: 25 * MI, ap: 40 },
    ],
  });
  const progress = [{ achievementId: 'mile-marker', value: 12, level: 1 }];

  it('reads its goals in miles with pounds, and in km with kilograms', () => {
    expect(goalText(mileMarker, 25 * MI, 'lb')).toBe('25 mi covered');
    expect(goalText(mileMarker, 25 * MI, 'kg')).toBe('40.2 km covered');
    expect(goalText(mileMarker, 2500 * MI, 'lb')).toBe('2,500 mi covered');
  });

  it('shows where you are against the next goal, its unit once', () => {
    const [lb] = achievementStatuses([mileMarker], [award('mile-marker', 1, 20)], progress, 'lb');
    expect(lb.progressLabel).toBe('7.4 / 25 mi');
    const [kg] = achievementStatuses([mileMarker], [award('mile-marker', 1, 20)], progress, 'kg');
    expect(kg.progressLabel).toBe('12 / 40.2 km');
  });
});

describe('lifetimePoints', () => {
  it('is the sum of every award', () => {
    expect(
      lifetimePoints([award('a', 1, 25), award('b', 1, 20), award('b', 2, 40), award('c', 1, 350)]),
    ).toBe(435);
  });
});
