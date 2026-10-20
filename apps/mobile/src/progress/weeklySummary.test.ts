import {
  computeWeeklySummary,
  weekRange,
  type SummarySet,
  type WeeklySummaryInput,
} from './weeklySummary';

// Wednesday 21 October 2026, mid-afternoon: the week is Mon 19 Oct to Mon 26 Oct.
const NOW = new Date(2026, 9, 21, 15, 0);
const WEEK = weekRange(NOW);

/** An ISO instant `day` days into October 2026, at `hour` o'clock local time. */
function at(day: number, hour = 9): string {
  return new Date(2026, 9, day, hour, 0).toISOString();
}

function set(overrides: Partial<SummarySet> & { performedAt: string }): SummarySet {
  return {
    workoutId: `w-${overrides.performedAt}`,
    exerciseId: 'bench',
    exerciseName: 'Bench Press',
    muscleGroup: 'chest',
    measurementType: 'weight_reps',
    weightKg: 80,
    reps: 8,
    ...overrides,
  };
}

function input(overrides: Partial<WeeklySummaryInput> = {}): WeeklySummaryInput {
  return {
    week: WEEK,
    workouts: [],
    sets: [],
    foodLogs: [],
    dailyCalorieTarget: null,
    dailyProteinTarget: null,
    weeklyWorkoutGoal: null,
    ...overrides,
  };
}

describe('weekRange', () => {
  it('runs Monday to the next Monday, local time', () => {
    expect(WEEK.start).toEqual(new Date(2026, 9, 19));
    expect(WEEK.end).toEqual(new Date(2026, 9, 26));
  });

  it('counts back whole weeks', () => {
    expect(weekRange(NOW, 1)).toEqual({ start: new Date(2026, 9, 12), end: new Date(2026, 9, 19) });
  });

  it('puts a Sunday in the week that started the Monday before', () => {
    expect(weekRange(new Date(2026, 9, 25, 22, 0)).start).toEqual(new Date(2026, 9, 19));
  });
});

describe('computeWeeklySummary -- training', () => {
  it('counts workout days, workouts and sets in the week only, against the weekly goal', () => {
    const summary = computeWeeklySummary(
      input({
        weeklyWorkoutGoal: 4,
        workouts: [
          { id: 'a', performedAt: at(19, 7) },
          // Two workouts on one day are one workout day.
          { id: 'b', performedAt: at(19, 18) },
          { id: 'c', performedAt: at(21) },
          // Last week.
          { id: 'd', performedAt: at(16) },
        ],
        sets: [
          set({ performedAt: at(19) }),
          set({ performedAt: at(21) }),
          set({ performedAt: at(16) }),
        ],
      }),
    );

    expect(summary.training).toEqual({ workoutDays: 2, workouts: 3, sets: 2, goalDays: 4 });
    expect(summary.isEmpty).toBe(false);
  });

  it('is empty with nothing trained or eaten', () => {
    expect(computeWeeklySummary(input()).isEmpty).toBe(true);
  });
});

describe('computeWeeklySummary -- nutrition', () => {
  const day = (date: number, calories: number, proteinG: number) => ({
    loggedAt: at(date, 12),
    calories,
    proteinG,
  });

  it('averages over the days food was logged, and counts days within 10% of the target', () => {
    const summary = computeWeeklySummary(
      input({
        dailyCalorieTarget: 2000,
        dailyProteinTarget: 150,
        foodLogs: [
          // Monday: 2,150 over two logs -- within 10%.
          day(19, 1500, 100),
          day(19, 650, 60),
          // Tuesday: 2,250 -- 12.5% over.
          day(20, 2250, 140),
          // Wednesday: 1,800 -- exactly 10% under.
          day(21, 1800, 150),
          // Last week: not counted.
          day(18, 5000, 300),
        ],
      }),
    );

    expect(summary.nutrition).toMatchObject({
      loggedDays: 3,
      avgCalories: 2067,
      avgProteinG: 150,
      daysWithinCalories: 2,
      daysProteinMet: 2,
    });
    expect(summary.nutrition.budget).toMatchObject({
      consumed: 6200,
      target: 14000,
      remaining: 7800,
    });
  });

  it('leaves out what needs a target when there is none', () => {
    const summary = computeWeeklySummary(input({ foodLogs: [day(19, 1800, 120)] }));

    expect(summary.nutrition).toEqual({
      loggedDays: 1,
      avgCalories: 1800,
      avgProteinG: 120,
      daysWithinCalories: null,
      daysProteinMet: null,
      budget: null,
    });
  });

  it('has no averages without food logged', () => {
    const summary = computeWeeklySummary(input({ dailyCalorieTarget: 2000 }));

    expect(summary.nutrition).toMatchObject({
      loggedDays: 0,
      avgCalories: null,
      daysWithinCalories: 0,
    });
  });
});

describe('computeWeeklySummary -- muscle groups', () => {
  it("counts this week's sets per group against the weekly average of the 4 weeks before", () => {
    const summary = computeWeeklySummary(
      input({
        sets: [
          set({ performedAt: at(19) }),
          set({ performedAt: at(20) }),
          // Bodyweight work counts: a push-up set is a chest set.
          set({
            performedAt: at(20),
            exerciseId: 'push-up',
            measurementType: 'bodyweight',
            weightKg: null,
          }),
          set({ performedAt: at(13), muscleGroup: 'back', exerciseId: 'row' }),
          set({ performedAt: at(13), muscleGroup: 'back', exerciseId: 'row' }),
          set({ performedAt: at(0), muscleGroup: 'back', exerciseId: 'row' }),
          set({ performedAt: at(7) }),
          // More than 4 weeks before: not counted.
          set({ performedAt: new Date(2026, 8, 20).toISOString(), muscleGroup: 'calves' }),
        ],
      }),
    );

    expect(summary.muscleGroups).toEqual([
      { group: 'chest', label: 'Chest', sets: 3, averageSets: 0.3 },
      { group: 'back', label: 'Back', sets: 0, averageSets: 0.8 },
    ]);
  });
});

describe('computeWeeklySummary -- strength', () => {
  it("compares this week's heaviest set with the best of the 4 weeks before", () => {
    const summary = computeWeeklySummary(
      input({
        sets: [
          set({ performedAt: at(19), weightKg: 85, reps: 5 }),
          set({ performedAt: at(21), weightKg: 85, reps: 6 }),
          set({ performedAt: at(21), weightKg: 80, reps: 10 }),
          set({ performedAt: at(12), weightKg: 82.5, reps: 6 }),
          set({ performedAt: at(5), weightKg: 82.5, reps: 8 }),
        ],
      }),
    );

    expect(summary.strength).toEqual([
      {
        exerciseId: 'bench',
        exerciseName: 'Bench Press',
        top: { weightKg: 85, reps: 6 },
        previousBest: { weightKg: 82.5, reps: 8 },
      },
    ]);
  });

  it('shows up to three lifts trained this week, the ones with the most sets lately first', () => {
    const lift = (id: string, sets: number, day = 21) =>
      Array.from({ length: sets }, () =>
        set({ performedAt: at(day), exerciseId: id, exerciseName: id }),
      );
    const summary = computeWeeklySummary(
      input({
        sets: [
          ...lift('squat', 4),
          ...lift('squat', 6, 14),
          ...lift('bench', 5),
          ...lift('row', 3),
          ...lift('curl', 2),
          // Lots of sets, but not this week.
          ...lift('deadlift', 20, 14),
        ],
      }),
    );

    expect(summary.strength.map((entry) => entry.exerciseId)).toEqual(['squat', 'bench', 'row']);
  });

  it('says when a lift was not done in the weeks before, and leaves out bodyweight and timed work', () => {
    const summary = computeWeeklySummary(
      input({
        sets: [
          set({ performedAt: at(20) }),
          set({
            performedAt: at(20),
            exerciseId: 'plank',
            measurementType: 'timed',
            weightKg: null,
            reps: null,
          }),
          set({
            performedAt: at(20),
            exerciseId: 'pull-up',
            measurementType: 'bodyweight',
            weightKg: null,
          }),
        ],
      }),
    );

    expect(summary.strength).toEqual([
      expect.objectContaining({ exerciseId: 'bench', previousBest: null }),
    ]);
  });
});
