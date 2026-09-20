// The one meal-type catalog for the whole app -- LogFoodStep's meal
// selector, NutritionTodayScreen's per-row meal label, and food_logs.meal_type
// (see the food_log_meals_and_images migration) all share this same set,
// rather than each place hand-rolling its own list/labels.
export type MealType = 'breakfast' | 'lunch' | 'dinner' | 'snack';

export const MEAL_TYPES: { value: MealType; label: string }[] = [
  { value: 'breakfast', label: 'Breakfast' },
  { value: 'lunch', label: 'Lunch' },
  { value: 'dinner', label: 'Dinner' },
  { value: 'snack', label: 'Snack' },
];

const MEAL_TYPE_LABELS: Record<MealType, string> = {
  breakfast: 'Breakfast',
  lunch: 'Lunch',
  dinner: 'Dinner',
  snack: 'Snack',
};

export function mealTypeLabel(mealType: MealType): string {
  return MEAL_TYPE_LABELS[mealType];
}

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
