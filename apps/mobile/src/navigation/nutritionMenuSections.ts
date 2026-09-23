/**
 * Every route that's part of Nutrition Mode -- drives only which mode
 * accent tints a screen's own background glow / the bottom nav's Nutrition
 * tab (App.tsx's `screenMode`/`backgroundMode`), a purely cosmetic,
 * per-screen concern. NOT used for menu content any more: the app-level
 * side menu (AppSideMenu, appMenuSections.ts) is one universal list now,
 * the same regardless of mode -- there is no more Workout/Nutrition
 * toggle, so nothing should still branch what a screen SHOWS on that
 * distinction (see DESIGN.md §11).
 */
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
