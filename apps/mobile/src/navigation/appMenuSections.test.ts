import { APP_MENU_FOOTER_ITEM, APP_MENU_SECTIONS } from './appMenuSections';

// Exactly two sections -- Training and Nutrition, the app's two real
// domains -- rather than the finer PROGRESSO/TRAINING·TOOLS/NUTRITION/MORE
// split this used to have. Settings lives outside both, in
// APP_MENU_FOOTER_ITEM, not as a third section.
describe('APP_MENU_SECTIONS', () => {
  function findItem(label: string) {
    for (const section of APP_MENU_SECTIONS) {
      const item = section.items.find((i) => i.label === label);
      if (item) return item;
    }
    return undefined;
  }

  it('groups every Training and Nutrition destination into exactly those two sections -- no Home entry, since Feed is already one tap away via the bottom nav', () => {
    expect(APP_MENU_SECTIONS.map((s) => s.title)).toEqual(['TRAINING', 'NUTRITION']);

    const allLabels = APP_MENU_SECTIONS.flatMap((section) => section.items.map((i) => i.label));
    expect(allLabels).toEqual(
      expect.arrayContaining([
        'Workouts',
        'Progress',
        'Workout Splits',
        'Exercise Library',
        'Food Library',
        'Nutrition Goals',
        'Nutrition History',
        'Recipes',
      ]),
    );
    expect(allLabels).not.toContain('Home');
    expect(allLabels).not.toContain('Feed');
    // Settings is APP_MENU_FOOTER_ITEM, not a section item -- see below.
    expect(allLabels).not.toContain('Settings');
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
});

describe('APP_MENU_FOOTER_ITEM', () => {
  it('keeps Settings available via the existing app-level AccountSettings route', () => {
    expect(APP_MENU_FOOTER_ITEM).toMatchObject({ route: 'AccountSettings', label: 'Settings' });
  });
});
