import type { AppMenuSection } from './appMenuSections';

/**
 * Contents of the app-level side menu while in Nutrition Mode -- kept
 * separate from APP_MENU_SECTIONS (the Workout-mode menu) so each can evolve
 * independently, while both are still rendered by the same AppSideMenu
 * component (same drawer/dismissal/navigation behavior, same visual
 * language). Nutrition History and Recipes have no screen yet, so they're
 * comingSoon rows -- visible for the right information architecture, not a
 * broken link to an unbuilt feature. Settings/Help reuse the existing
 * AccountSettings screen (which already has a Help category) rather than
 * inventing a second destination for the same content.
 *
 * "Nutrition Goals" routes to the NutritionGoals screen (the calorie-target
 * reference-image page) -- CalorieEstimation is no longer a primary
 * destination of its own; it's the "Edit" sub-screen NutritionGoals routes
 * to for editing the personal info its calculation needs, same as any other
 * edit-detail screen reached by pushing forward rather than from this menu.
 * No "Home" entry -- Dashboard (Home) is already one tap away via the
 * bottom nav in both modes, same reasoning as Profile never appearing here.
 */
export const NUTRITION_MENU_SECTIONS: AppMenuSection[] = [
  {
    title: 'NUTRITION',
    items: [
      { route: 'FoodLibrary', label: 'Food', icon: 'pie-chart' },
      { route: 'NutritionGoals', label: 'Nutrition Goals', icon: 'target' },
      { label: 'Nutrition History', icon: 'clock', comingSoon: true },
      { label: 'Recipes', icon: 'book-open', comingSoon: true },
    ],
  },
  {
    title: 'MORE',
    items: [{ route: 'AccountSettings', label: 'Settings', icon: 'settings' }],
  },
];

/** Every route that's part of Nutrition Mode -- drives which side-menu section list and accent color App.tsx shows for the current screen. */
const NUTRITION_ROUTE_NAMES = new Set([
  'Nutrition',
  'FoodLibrary',
  'FoodSearch',
  'BarcodeScanner',
  'NutritionGoals',
  'CalorieEstimation',
  'NutritionColorSettings',
]);

export function isNutritionRoute(routeName: string | undefined): boolean {
  return routeName !== undefined && NUTRITION_ROUTE_NAMES.has(routeName);
}
