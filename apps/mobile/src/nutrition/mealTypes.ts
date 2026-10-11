// The meal-type catalog for the whole app -- food_logs.meal_type (see the
// food_log_meals_and_images migration) and defaultMealTypeForTime below
// share this same set, rather than each place hand-rolling its own. There
// is no meal-selector UI today (LogFoodStep always logs under whichever
// meal defaultMealTypeForTime picks for the current time) and no screen
// displays a meal's label -- if either is added back, MEAL_TYPES/
// mealTypeLabel-style helpers belong here again.
export type MealType = 'breakfast' | 'lunch' | 'dinner' | 'snack';

/**
 * A sensible starting selection based on the current time of day -- the
 * user can always change it before logging; this is only a default, never
 * the stored value itself. Boundaries: before 11am breakfast, before 3pm
 * lunch, before 9pm dinner, otherwise snack.
 */
export function defaultMealTypeForTime(now: Date = new Date()): MealType {
  const hour = now.getHours();
  if (hour < 11) return 'breakfast';
  if (hour < 15) return 'lunch';
  if (hour < 21) return 'dinner';
  return 'snack';
}
