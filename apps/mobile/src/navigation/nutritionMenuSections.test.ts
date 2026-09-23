import { isNutritionRoute } from './nutritionMenuSections';

describe('isNutritionRoute', () => {
  it.each([
    'Nutrition',
    'FoodLibrary',
    'FoodSearch',
    'BarcodeScanner',
    'NutritionGoals',
    'CalorieEstimation',
    'NutritionColorSettings',
  ])('treats %s as a Nutrition Mode route', (route) => {
    expect(isNutritionRoute(route)).toBe(true);
  });

  it.each(['Dashboard', 'WorkoutHistory', 'Profile', 'WorkoutColorSettings'])(
    'treats %s as a Workout Mode route',
    (route) => {
      expect(isNutritionRoute(route)).toBe(false);
    },
  );

  it('treats an unresolved current route (undefined) as not Nutrition', () => {
    expect(isNutritionRoute(undefined)).toBe(false);
  });
});
