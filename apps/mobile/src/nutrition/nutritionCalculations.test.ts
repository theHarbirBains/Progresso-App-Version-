import type { FoodLogRow } from './foodLogQueries';
import {
  calculateLogTotals,
  calculateRemaining,
  computeWeeklyCalorieSummary,
  daysLeftInWeek,
  recalculateForQuantity,
  sumDailyTotals,
  calorieGoalFor,
  calorieGoalLabel,
  weekGoalNote,
} from './nutritionCalculations';

function log(overrides: Partial<FoodLogRow> = {}): FoodLogRow {
  return {
    id: 'log-1',
    foodId: 'food-1',
    foodNameSnapshot: 'Chicken Breast',
    servingSize: 100,
    servingUnit: 'g',
    quantity: 1,
    calories: 165,
    proteinG: 31,
    carbsG: 0,
    fatG: 3.6,
    mealType: null,
    loggedAt: '2026-01-01T12:00:00Z',
    ...overrides,
  };
}

describe('sumDailyTotals', () => {
  it('sums the already-computed totals on each log, not per-serving values', () => {
    const logs = [
      log({ calories: 165, proteinG: 31, carbsG: 0, fatG: 3.6 }),
      log({ id: 'log-2', calories: 200, proteinG: 20, carbsG: 30, fatG: 5 }),
    ];

    expect(sumDailyTotals(logs)).toEqual({
      calories: 365,
      proteinG: 51,
      carbsG: 30,
      fatG: 8.6,
    });
  });

  it('returns all zeros for an empty day', () => {
    expect(sumDailyTotals([])).toEqual({ calories: 0, proteinG: 0, carbsG: 0, fatG: 0 });
  });
});

describe('calculateRemaining', () => {
  it('computes remaining only for macros that have a target', () => {
    const consumed = { calories: 1500, proteinG: 100, carbsG: 150, fatG: 40 };
    const goals = { calories: 2000, proteinG: 180, carbsG: null, fatG: null };

    expect(calculateRemaining(consumed, goals)).toEqual({
      calories: 500,
      proteinG: 80,
      carbsG: null,
      fatG: null,
    });
  });

  it('never invents a remaining value when no goals exist at all', () => {
    const consumed = { calories: 1500, proteinG: 100, carbsG: 150, fatG: 40 };
    const goals = { calories: null, proteinG: null, carbsG: null, fatG: null };

    expect(calculateRemaining(consumed, goals)).toEqual({
      calories: null,
      proteinG: null,
      carbsG: null,
      fatG: null,
    });
  });

  it('allows remaining to go negative when the target has been exceeded', () => {
    const consumed = { calories: 2200, proteinG: 0, carbsG: 0, fatG: 0 };
    const goals = { calories: 2000, proteinG: null, carbsG: null, fatG: null };

    expect(calculateRemaining(consumed, goals).calories).toBe(-200);
  });
});

describe('computeWeeklyCalorieSummary', () => {
  it('returns null (never a fabricated target) when no daily calorie target has been set', () => {
    expect(computeWeeklyCalorieSummary(7000, null)).toBeNull();
  });

  it('computes the weekly target as exactly 7x the saved daily target -- never a separate value', () => {
    const summary = computeWeeklyCalorieSummary(7000, 2000);

    expect(summary?.target).toBe(14000);
  });

  it('computes real consumed/remaining/percent from the weekly total', () => {
    const summary = computeWeeklyCalorieSummary(7000, 2000);

    expect(summary).toEqual({ consumed: 7000, target: 14000, remaining: 7000, percent: 0.5 });
  });

  it('lets remaining go negative when the week is over budget, same as the daily calculation', () => {
    const summary = computeWeeklyCalorieSummary(15000, 2000);

    expect(summary?.remaining).toBe(-1000);
  });

  it('clamps the progress-bar percent at 1 even when over budget -- remaining still reports the real overage', () => {
    const summary = computeWeeklyCalorieSummary(20000, 2000);

    expect(summary?.percent).toBe(1);
    expect(summary?.remaining).toBe(-6000);
  });

  it('returns 0% with nothing consumed yet', () => {
    expect(computeWeeklyCalorieSummary(0, 2000)?.percent).toBe(0);
  });
});

describe('calculateLogTotals', () => {
  it('multiplies a food per-serving values by the chosen quantity', () => {
    const food = { calories: 165, proteinG: 31, carbsG: 0, fatG: 3.6 };

    expect(calculateLogTotals(food, 2)).toEqual({
      calories: 330,
      proteinG: 62,
      carbsG: 0,
      fatG: 7.2,
    });
  });
});

describe('recalculateForQuantity', () => {
  it('scales from the existing snapshot using the required example exactly (400cal/40g @ qty 2 -> qty 3)', () => {
    const existing = { calories: 400, proteinG: 40, carbsG: 20, fatG: 10, quantity: 2 };

    const result = recalculateForQuantity(existing, 3);

    expect(result).toEqual({ calories: 600, proteinG: 60, carbsG: 30, fatG: 15 });
  });

  it('scales down when quantity decreases', () => {
    const existing = { calories: 400, proteinG: 40, carbsG: 20, fatG: 10, quantity: 4 };

    const result = recalculateForQuantity(existing, 2);

    expect(result).toEqual({ calories: 200, proteinG: 20, carbsG: 10, fatG: 5 });
  });

  it('is a no-op when the quantity is unchanged', () => {
    const existing = { calories: 165, proteinG: 31, carbsG: 0, fatG: 3.6, quantity: 1 };

    expect(recalculateForQuantity(existing, 1)).toEqual({
      calories: 165,
      proteinG: 31,
      carbsG: 0,
      fatG: 3.6,
    });
  });

  it('never depends on any live food data -- only the log-shaped snapshot input', () => {
    // Deliberately does not accept or reference a `foods` row at all --
    // this is checked structurally: the function signature only takes the
    // log's own snapshot + quantity fields.
    const existing = { calories: 90, proteinG: 9, carbsG: 9, fatG: 9, quantity: 3 };

    const result = recalculateForQuantity(existing, 1);

    expect(result).toEqual({ calories: 30, proteinG: 3, carbsG: 3, fatG: 3 });
  });
});

describe('daysLeftInWeek', () => {
  it('counts the days left to Saturday, today included', () => {
    // 18 October 2026 is a Sunday.
    expect(daysLeftInWeek(new Date(2026, 9, 18, 8, 0))).toBe(7);
    expect(daysLeftInWeek(new Date(2026, 9, 21, 23, 0))).toBe(4);
    expect(daysLeftInWeek(new Date(2026, 9, 23, 12, 0))).toBe(2);
    expect(daysLeftInWeek(new Date(2026, 9, 24, 23, 59))).toBe(1);
  });
});

describe('calorieGoalFor', () => {
  it('reads a target 150 or more below maintenance as a cut, 150 or more above as a bulk', () => {
    expect(calorieGoalFor(2200, 2500)).toEqual({ goal: 'cut', offset: -300 });
    expect(calorieGoalFor(2350, 2500)).toEqual({ goal: 'cut', offset: -150 });
    expect(calorieGoalFor(2800, 2500)).toEqual({ goal: 'bulk', offset: 300 });
    expect(calorieGoalFor(2650, 2500)).toEqual({ goal: 'bulk', offset: 150 });
  });

  it('reads anything nearer as maintaining', () => {
    expect(calorieGoalFor(2500, 2500)?.goal).toBe('maintain');
    expect(calorieGoalFor(2400, 2500)?.goal).toBe('maintain');
    expect(calorieGoalFor(2600, 2500)?.goal).toBe('maintain');
  });

  it('reads nothing without a target or a maintenance estimate', () => {
    expect(calorieGoalFor(null, 2500)).toBeNull();
    expect(calorieGoalFor(2200, null)).toBeNull();
  });

  it('names it', () => {
    expect(calorieGoalLabel({ goal: 'cut', offset: -500 })).toBe('Cutting · 500 below maintenance');
    expect(calorieGoalLabel({ goal: 'bulk', offset: 300 })).toBe('Bulking · 300 above maintenance');
    expect(calorieGoalLabel({ goal: 'maintain', offset: 40 })).toBe('Maintaining');
  });
});

describe('weekGoalNote', () => {
  // Three days so far at 2,000 a day: 6,000.
  it('reads under the target as on track for a cut, and over it plainly', () => {
    expect(weekGoalNote('cut', 5400, 2000, 3)).toBe(
      'Under your target so far: on track for your cut.',
    );
    expect(weekGoalNote('cut', 6450, 2000, 3)).toBe(
      '450 cal over your target so far for your cut.',
    );
  });

  it('reads at or over the target as on track for a bulk, and under it as room to eat', () => {
    expect(weekGoalNote('bulk', 6600, 2000, 3)).toBe(
      'At or over your target so far: on track for your bulk.',
    );
    expect(weekGoalNote('bulk', 5200, 2000, 3)).toBe(
      '800 cal under your target so far: eat a little more for your bulk.',
    );
  });

  it('reads within 5% of the target as on track to maintain', () => {
    expect(weekGoalNote('maintain', 6250, 2000, 3)).toBe(
      'Close to your target so far: on track to maintain.',
    );
    expect(weekGoalNote('maintain', 5000, 2000, 3)).toBe('1,000 cal under your target so far.');
    expect(weekGoalNote('maintain', 6900, 2000, 3)).toBe('900 cal over your target so far.');
  });
});
