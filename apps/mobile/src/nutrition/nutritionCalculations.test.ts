import type { FoodLogRow } from './foodLogQueries';
import {
  calculateLogTotals,
  calculateRemaining,
  recalculateForQuantity,
  sumDailyTotals,
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
