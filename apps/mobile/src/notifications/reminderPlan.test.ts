import { checkInBody, planReminders, type ReminderContext } from './reminderPlan';
import { defaultReminderSettings, type ReminderSettings } from './reminderSettings';

// Saturday, November 14, 2026, 10:00 AM.
const NOW = new Date(2026, 10, 14, 10, 0);

function context(overrides: Partial<ReminderContext> = {}): ReminderContext {
  return {
    now: NOW,
    nextWorkout: { name: 'Push Day', muscles: 'Chest • Shoulders • Triceps' },
    workedOutToday: false,
    nutrition: true,
    today: { logged: false, calories: 0, proteinG: 0, calorieTarget: 2200, proteinTarget: 160 },
    ...overrides,
  };
}

function settings(overrides: Partial<ReminderSettings> = {}): ReminderSettings {
  // Saturday is a workout day here, so today has one.
  const base = defaultReminderSettings(3);
  return { ...base, workout: { ...base.workout, days: [1, 3, 5, 6] }, ...overrides };
}

const ids = (plan: ReturnType<typeof planReminders>) => plan.map((reminder) => reminder.id);

describe('planReminders', () => {
  it('schedules the next 7 days, soonest first, each at its own time', () => {
    const plan = planReminders(settings(), context());

    expect(plan[0]).toMatchObject({
      id: 'progresso-reminder-meals-2026-11-14',
      at: new Date(2026, 10, 14, 12, 30),
      title: 'Log your meals',
      path: 'nutrition',
    });
    expect(plan.at(-1)?.at.getTime()).toBeLessThan(new Date(2026, 10, 21).getTime());
    expect(plan.map((r) => r.at.getTime())).toEqual(
      [...plan.map((r) => r.at.getTime())].sort((a, b) => a - b),
    );
  });

  it('puts the next split day on the days they train, and nowhere else', () => {
    const plan = planReminders(settings(), context());
    const workout = plan.filter((r) => r.kind === 'workout');

    // Saturday the 14th, then Monday, Wednesday and Friday.
    expect(ids(workout)).toEqual([
      'progresso-reminder-workout-2026-11-14',
      'progresso-reminder-workout-2026-11-16',
      'progresso-reminder-workout-2026-11-18',
      'progresso-reminder-workout-2026-11-20',
    ]);
    expect(workout[0]).toMatchObject({
      at: new Date(2026, 10, 14, 17, 0),
      title: 'Push Day today',
      body: "Chest • Shoulders • Triceps. Tap to start when you're ready.",
      path: 'workouts/new',
    });
  });

  it("drops today's workout reminder once a workout is finished today", () => {
    const plan = planReminders(settings(), context({ workedOutToday: true }));
    expect(ids(plan)).not.toContain('progresso-reminder-workout-2026-11-14');
    expect(ids(plan)).toContain('progresso-reminder-workout-2026-11-16');
  });

  it('still reminds without a split, without naming a day', () => {
    const [first] = planReminders(settings(), context({ nextWorkout: null })).filter(
      (r) => r.kind === 'workout',
    );
    expect(first).toMatchObject({
      title: 'Workout day',
      body: expect.stringMatching(/Time to train/),
    });
  });

  it("drops today's meal reminder once anything is logged, and redoes the check-in's figures", () => {
    const plan = planReminders(
      settings(),
      context({
        today: {
          logged: true,
          calories: 1640.7,
          proteinG: 112.4,
          calorieTarget: 2200,
          proteinTarget: 160,
        },
      }),
    );

    expect(ids(plan)).not.toContain('progresso-reminder-meals-2026-11-14');
    expect(ids(plan)).toContain('progresso-reminder-meals-2026-11-15');
    expect(plan.find((r) => r.id === 'progresso-reminder-checkIn-2026-11-14')?.body).toBe(
      '1,640 of 2,200 calories and 112 of 160 g protein so far today. 48 g of protein to go.',
    );
    // A day ahead has nothing logged yet.
    expect(plan.find((r) => r.id === 'progresso-reminder-checkIn-2026-11-15')?.body).toMatch(
      /^Nothing logged yet today/,
    );
  });

  it('leaves out a time already gone today', () => {
    const evening = planReminders(settings(), context({ now: new Date(2026, 10, 14, 19, 0) }));
    expect(ids(evening)).not.toContain('progresso-reminder-meals-2026-11-14');
    expect(ids(evening)).not.toContain('progresso-reminder-workout-2026-11-14');
    expect(ids(evening)).toContain('progresso-reminder-checkIn-2026-11-14');
  });

  it('has no nutrition reminders without Nutrition in the membership', () => {
    const plan = planReminders(settings(), context({ nutrition: false }));
    expect(plan.some((r) => r.kind === 'meals' || r.kind === 'checkIn')).toBe(false);
    expect(plan.find((r) => r.kind === 'weekly')?.body).not.toMatch(/nutrition/);
  });

  it('sends the weekly summary on Sunday only', () => {
    const weekly = planReminders(settings(), context()).filter((r) => r.kind === 'weekly');
    expect(weekly).toEqual([
      expect.objectContaining({
        id: 'progresso-reminder-weekly-2026-11-15',
        at: new Date(2026, 10, 15, 18, 0),
        path: 'progress',
      }),
    ]);
  });

  it('leaves out every reminder that is turned off', () => {
    const base = settings();
    const plan = planReminders(
      {
        ...base,
        workout: { ...base.workout, on: false },
        meals: { ...base.meals, on: false },
        checkIn: { ...base.checkIn, on: false },
        weekly: { ...base.weekly, on: false },
      },
      context(),
    );
    expect(plan).toEqual([]);
  });
});

describe('checkInBody', () => {
  it('says the day so far without targets, and when protein is reached', () => {
    expect(
      checkInBody({
        logged: true,
        calories: 900,
        proteinG: 60,
        calorieTarget: null,
        proteinTarget: null,
      }),
    ).toBe('900 calories and 60 g protein so far today.');
    expect(
      checkInBody({
        logged: true,
        calories: 2100,
        proteinG: 165,
        calorieTarget: 2200,
        proteinTarget: 160,
      }),
    ).toBe(
      '2,100 of 2,200 calories and 165 of 160 g protein so far today. Protein target reached.',
    );
  });
});
