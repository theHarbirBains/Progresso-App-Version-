import { TRAINER_MENU_SECTIONS, APP_MENU_FOOTER_ITEM, APP_MENU_SECTIONS } from './appMenuSections';

// Three sections -- Training, Nutrition, and (since Social v1) Social --
// the app's real domains, rather than the finer PROGRESSO/TRAINING·TOOLS/
// NUTRITION/MORE split this used to have. Settings lives outside all of
// them, in APP_MENU_FOOTER_ITEM, not as a section of its own.
describe('APP_MENU_SECTIONS', () => {
  function findItem(label: string) {
    for (const section of APP_MENU_SECTIONS) {
      const item = section.items.find((i) => i.label === label);
      if (item) return item;
    }
    return undefined;
  }

  it('groups every Training, Nutrition and Social destination into exactly those sections -- no Home entry, since Feed is already one tap away via the bottom nav', () => {
    expect(APP_MENU_SECTIONS.map((s) => s.title)).toEqual(['TRAINING', 'NUTRITION', 'SOCIAL']);

    const allLabels = APP_MENU_SECTIONS.flatMap((section) => section.items.map((i) => i.label));
    expect(allLabels).toEqual(
      expect.arrayContaining([
        'Workouts',
        'Log a Past Workout',
        'Progress',
        'Workout Splits',
        'Exercise Library',
        'Food Library',
        'Nutrition Goals',
        'Nutrition History',
        'Phases',
        'Find People',
      ]),
    );
    expect(allLabels).not.toContain('Home');
    expect(allLabels).not.toContain('Feed');
    // Settings is APP_MENU_FOOTER_ITEM, not a section item -- see below.
    expect(allLabels).not.toContain('Settings');
  });

  it("doesn't list Group Workouts -- it's reached from Feed's live group card, not the menu", () => {
    const allRoutes = APP_MENU_SECTIONS.flatMap((section) =>
      section.items.map((i) => ('route' in i ? i.route : null)),
    );
    expect(allRoutes).not.toContain('Groups');
  });

  it("routes the 'Log a Past Workout' item to the LogPastWorkout screen", () => {
    expect(findItem('Log a Past Workout')).toEqual({
      route: 'LogPastWorkout',
      label: 'Log a Past Workout',
      icon: 'edit-3',
    });
  });

  it("routes the 'Find People' item to the FindPeople screen", () => {
    expect(findItem('Find People')).toEqual({
      route: 'FindPeople',
      label: 'Find People',
      icon: 'user-plus',
    });
  });

  it("routes the 'Nutrition Goals' item to the NutritionGoals screen (the calorie-target page) -- CalorieEstimation is its Edit sub-screen, not a primary menu destination", () => {
    expect(findItem('Nutrition Goals')).toMatchObject({ route: 'NutritionGoals' });
  });

  it("routes the 'Nutrition History' item to the NutritionHistory screen", () => {
    expect(findItem('Nutrition History')).toEqual({
      route: 'NutritionHistory',
      label: 'Nutrition History',
      icon: 'clock',
    });
  });

  it('opens Phases from the Nutrition section; Recipes live in the Food Library now', () => {
    expect(findItem('Phases')).toEqual({ route: 'Phases', label: 'Phases', icon: 'flag' });
    expect(findItem('Recipes')).toBeUndefined();
  });
});

describe('APP_MENU_FOOTER_ITEM', () => {
  it('keeps Settings available via the existing app-level AccountSettings route', () => {
    expect(APP_MENU_FOOTER_ITEM).toMatchObject({ route: 'AccountSettings', label: 'Settings' });
  });
});

describe('TRAINER_MENU_SECTIONS', () => {
  it("is the side menu in the Trainer Workspace: its three tabs' pages, and adding a client", () => {
    const items = TRAINER_MENU_SECTIONS.flatMap((section) => section.items);
    expect(items.map((item) => ('route' in item ? item.route : null))).toEqual([
      'TrainerClients',
      'TrainerActivity',
      'TrainerSessions',
      'TrainerClientForm',
    ]);
  });
});
