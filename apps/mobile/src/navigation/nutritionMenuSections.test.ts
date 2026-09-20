import { isNutritionRoute, NUTRITION_MENU_SECTIONS } from './nutritionMenuSections';

describe('NUTRITION_MENU_SECTIONS', () => {
  it('includes the specified nav structure, in order, in the Nutrition section -- no Home entry, since Dashboard is already one tap away via the bottom nav', () => {
    const items = NUTRITION_MENU_SECTIONS[0]!.items;
    expect(items.map((item) => item.label)).toEqual([
      'Food',
      'Nutrition Goals',
      'Nutrition History',
      'Recipes',
    ]);
  });

  it("routes the 'Nutrition Goals' item to the NutritionGoals screen (the calorie-target page) -- CalorieEstimation is now its Edit sub-screen, not a primary menu destination", () => {
    const item = NUTRITION_MENU_SECTIONS[0]!.items.find((i) => i.label === 'Nutrition Goals');
    expect(item).toMatchObject({ route: 'NutritionGoals' });
  });

  it('marks Nutrition History and Recipes as coming-soon placeholders, not routes to a nonexistent screen', () => {
    const history = NUTRITION_MENU_SECTIONS[0]!.items.find((i) => i.label === 'Nutrition History');
    const recipes = NUTRITION_MENU_SECTIONS[0]!.items.find((i) => i.label === 'Recipes');
    expect(history).toEqual({ label: 'Nutrition History', icon: 'clock', comingSoon: true });
    expect(recipes).toEqual({ label: 'Recipes', icon: 'book-open', comingSoon: true });
  });

  it('keeps Settings available via the existing app-level AccountSettings route', () => {
    const settings = NUTRITION_MENU_SECTIONS[1]!.items.find((i) => i.label === 'Settings');
    expect(settings).toMatchObject({ route: 'AccountSettings' });
  });
});

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
