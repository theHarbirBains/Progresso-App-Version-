import type { FoodLogRow } from './foodLogQueries';
import { computeNutritionMonthSummary } from './nutritionMonthSummary';

function log(overrides: Partial<FoodLogRow>): FoodLogRow {
  return {
    id: 'log-1',
    foodId: 'food-1',
    foodNameSnapshot: 'Chicken Breast',
    servingSize: 100,
    servingUnit: 'g',
    quantity: 1,
    calories: 0,
    proteinG: 0,
    carbsG: 0,
    fatG: 0,
    mealType: null,
    loggedAt: '2026-02-01T12:00:00Z',
    ...overrides,
  };
}

describe('computeNutritionMonthSummary', () => {
  it('is all zero for an empty month', () => {
    expect(computeNutritionMonthSummary([])).toEqual({
      daysLogged: 0,
      totalCalories: 0,
      avgCaloriesPerLoggedDay: 0,
    });
  });

  it('sums calories and counts distinct logged days, not log rows', () => {
    const logs = [
      log({ id: 'l1', calories: 400, loggedAt: '2026-02-01T08:00:00Z' }),
      log({ id: 'l2', calories: 600, loggedAt: '2026-02-01T18:00:00Z' }), // same day as l1
      log({ id: 'l3', calories: 500, loggedAt: '2026-02-03T12:00:00Z' }),
    ];

    expect(computeNutritionMonthSummary(logs)).toEqual({
      daysLogged: 2,
      totalCalories: 1500,
      avgCaloriesPerLoggedDay: 750,
    });
  });

  it('rounds the per-day average rather than returning a fraction', () => {
    const logs = [
      log({ id: 'l1', calories: 500, loggedAt: '2026-02-01T12:00:00Z' }),
      log({ id: 'l2', calories: 500, loggedAt: '2026-02-02T12:00:00Z' }),
      log({ id: 'l3', calories: 501, loggedAt: '2026-02-03T12:00:00Z' }),
    ];

    expect(computeNutritionMonthSummary(logs).avgCaloriesPerLoggedDay).toBe(500);
  });
});
