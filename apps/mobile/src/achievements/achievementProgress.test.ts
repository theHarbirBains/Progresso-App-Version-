import {
  achievementStatuses,
  describe as describeAchievement,
  lifetimePoints,
} from './achievementProgress';
import type { AchievementDefinition } from './achievementQueries';

function definition(extra: Partial<AchievementDefinition>): AchievementDefinition {
  return {
    id: 'dedicated',
    category: 'workouts',
    title: 'Dedicated',
    description: 'Finish 25 workouts',
    icon: 'activity',
    ap: 125,
    repeats: 'once',
    metric: 'workouts',
    threshold: 25,
    unit: 'count',
    visibility: 'public',
    sort: 40,
    ...extra,
  };
}

const heavy = definition({
  id: 'heavy-lifter',
  category: 'volume',
  title: 'Heavy Lifter',
  description: 'Lift 10,000 lb in all',
  metric: 'volume_kg',
  threshold: 4535.9237,
  unit: 'kg',
  ap: 100,
});
const weekly = definition({
  id: 'weekly-warrior',
  category: 'consistency',
  title: 'Weekly Warrior',
  repeats: 'weekly',
  metric: 'week_goal',
  threshold: 1,
  ap: 25,
});

describe('achievementStatuses', () => {
  it('says how far along a locked achievement is, exactly against what it takes', () => {
    const [status] = achievementStatuses([definition({})], [], { workouts: 12 }, 'lb');

    expect(status).toMatchObject({ earned: false, current: 12, target: 25, progress: 0.48 });
    expect(status!.progressLabel).toBe('12 / 25');
  });

  it('says when an achievement was earned and the AP it brought', () => {
    const [status] = achievementStatuses(
      [definition({})],
      [
        {
          achievementId: 'dedicated',
          periodKey: 'once',
          ap: 125,
          awardedAt: '2026-11-01T10:00:00Z',
        },
      ],
      { workouts: 30 },
      'lb',
    );

    expect(status).toMatchObject({
      earned: true,
      times: 1,
      firstAwardedAt: '2026-11-01T10:00:00Z',
      apEarned: 125,
      progressLabel: '25 / 25',
    });
  });

  it('reads weight in the reader’s own unit', () => {
    expect(achievementStatuses([heavy], [], { volume_kg: 2000 }, 'lb')[0]!.progressLabel).toBe(
      '4,409 / 10,000 lb',
    );
    expect(achievementStatuses([heavy], [], { volume_kg: 2000 }, 'kg')[0]!.progressLabel).toBe(
      '2,000 / 4,536 kg',
    );
    expect(describeAchievement(heavy, 'kg')).toBe('Lift 4,536 kg in all');
    expect(describeAchievement(heavy, 'lb')).toBe('Lift 10,000 lb in all');
  });

  it("counts a repeatable one's times, and shows this week's progress toward the next", () => {
    const [status] = achievementStatuses(
      [weekly],
      [
        { achievementId: 'weekly-warrior', periodKey: 'W:2026-11-02', ap: 25, awardedAt: 'a' },
        { achievementId: 'weekly-warrior', periodKey: 'W:2026-11-09', ap: 25, awardedAt: 'b' },
      ],
      { week_workouts: 1, goal: 4 },
      'lb',
    );

    expect(status).toMatchObject({
      times: 2,
      apEarned: 50,
      lastAwardedAt: 'b',
      current: 1,
      target: 4,
    });
    expect(status!.progressLabel).toBe('1 / 4');
  });
});

describe('lifetimePoints', () => {
  it('is the sum of every award', () => {
    expect(
      lifetimePoints([
        { achievementId: 'a', periodKey: 'once', ap: 25, awardedAt: 'x' },
        { achievementId: 'b', periodKey: 'W:2026-11-02', ap: 25, awardedAt: 'y' },
        { achievementId: 'c', periodKey: 'once', ap: 350, awardedAt: 'z' },
      ]),
    ).toBe(400);
  });
});
