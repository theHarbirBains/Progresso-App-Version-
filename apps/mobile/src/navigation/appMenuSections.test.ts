import { APP_MENU_SECTIONS } from './appMenuSections';

// The app-level side menu is one universal list now -- these were
// previously split across this file (Workout Mode) and a separate
// NUTRITION_MENU_SECTIONS (Nutrition Mode), switched by the app's current
// mode. Merged into one list once the Workout/Nutrition toggle was removed
// (see DESIGN.md §11) -- there is no more mode for the menu to switch on.
describe('APP_MENU_SECTIONS', () => {
  function findItem(label: string) {
    for (const section of APP_MENU_SECTIONS) {
      const item = section.items.find((i) => i.label === label);
      if (item) return item;
    }
    return undefined;
  }

  it('includes both Workout and Nutrition destinations in the one list -- no Home entry, since Feed is already one tap away via the bottom nav', () => {
    const allLabels = APP_MENU_SECTIONS.flatMap((section) => section.items.map((i) => i.label));
    expect(allLabels).toEqual(
      expect.arrayContaining([
        'Workouts',
        'Progress',
        'Food',
        'Workout Splits',
        'Exercise Library',
        'Nutrition Goals',
        'Nutrition History',
        'Recipes',
        'Settings',
      ]),
    );
    expect(allLabels).not.toContain('Home');
    expect(allLabels).not.toContain('Feed');
  });

  it("routes the 'Nutrition Goals' item to the NutritionGoals screen (the calorie-target page) -- CalorieEstimation is its Edit sub-screen, not a primary menu destination", () => {
    expect(findItem('Nutrition Goals')).toMatchObject({ route: 'NutritionGoals' });
  });

  it('marks Nutrition History and Recipes as coming-soon placeholders, not routes to a nonexistent screen', () => {
    expect(findItem('Nutrition History')).toEqual({
      label: 'Nutrition History',
      icon: 'clock',
      comingSoon: true,
    });
    expect(findItem('Recipes')).toEqual({ label: 'Recipes', icon: 'book-open', comingSoon: true });
  });

  it('keeps Settings available via the existing app-level AccountSettings route', () => {
    expect(findItem('Settings')).toMatchObject({ route: 'AccountSettings' });
  });
});
