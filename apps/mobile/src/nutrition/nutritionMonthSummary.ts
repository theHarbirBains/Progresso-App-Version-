import { isoToLocalDateKey } from '../design/calendarGrid';
import type { FoodLogRow } from './foodLogQueries';

export interface NutritionMonthSummary {
  daysLogged: number;
  totalCalories: number;
  /** 0 when nothing was logged this month, rather than dividing by zero. */
  avgCaloriesPerLoggedDay: number;
}

/** Pure aggregation over one month's already-fetched food logs -- no query
 * of its own, same reasoning as workoutMonthSummary's computeMonthSummary:
 * switching months only needs a new fetch of the same shape. */
export function computeNutritionMonthSummary(logs: FoodLogRow[]): NutritionMonthSummary {
  const totalCalories = logs.reduce((sum, log) => sum + log.calories, 0);
  const daysLogged = new Set(logs.map((log) => isoToLocalDateKey(log.loggedAt))).size;

  return {
    daysLogged,
    totalCalories,
    avgCaloriesPerLoggedDay: daysLogged > 0 ? Math.round(totalCalories / daysLogged) : 0,
  };
}
