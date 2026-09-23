import { Feather } from '@expo/vector-icons';
import type { RootStackParamList } from './types';

/** Any route safely navigable with no params object at all -- either it
 *  takes none (`undefined`), or every field it does take is optional (e.g.
 *  FoodLibrary's `{ openCreate?: boolean; barcode?: string } | undefined`,
 *  used by the Scan Barcode flow but not by this generic menu). The only
 *  kind safe to list here, since there's no per-item params to supply. */
type NoParamRoute = {
  [K in keyof RootStackParamList]: undefined extends RootStackParamList[K] ? K : never;
}[keyof RootStackParamList];

export type AppMenuRoute = NoParamRoute;

export interface AppMenuItem {
  route: AppMenuRoute;
  label: string;
  icon: keyof typeof Feather.glyphMap;
}

/** A menu row for a destination that doesn't have a screen yet -- visible (for correct information architecture) but not navigable, same "real placeholder, never a fake action" precedent as Settings' ComingSoonRow. */
export interface AppMenuComingSoonItem {
  label: string;
  icon: keyof typeof Feather.glyphMap;
  comingSoon: true;
}

export type AppMenuEntry = AppMenuItem | AppMenuComingSoonItem;

export interface AppMenuSection {
  title: string;
  items: AppMenuEntry[];
}

/**
 * Contents of the app-level side menu (AppSideMenu) -- one single, universal
 * list, the same regardless of which screen it's opened from. This is the
 * single place to add a future destination -- once its screen actually
 * exists -- without touching AppSideMenu itself. Every entry here must
 * point at a real, already-registered screen; never add a placeholder for
 * an unbuilt feature (the exception is a `comingSoon` entry -- visible for
 * correct information architecture, never a broken link). No "Home" entry
 * -- Feed (Home) is already one tap away via the bottom nav, same reasoning
 * as Profile never appearing here.
 *
 * Previously split into this (Workout Mode) and a separate
 * NUTRITION_MENU_SECTIONS, switched by which mode the app was in -- merged
 * into one list once the Workout/Nutrition toggle was removed (see
 * DESIGN.md §11): there is no more "mode" for the menu to switch on, so
 * every destination -- workout and nutrition alike -- belongs in the one
 * menu every screen opens.
 */
export const APP_MENU_SECTIONS: AppMenuSection[] = [
  {
    title: 'PROGRESSO',
    items: [
      { route: 'WorkoutHistory', label: 'Workouts', icon: 'activity' },
      { route: 'ProgressOverview', label: 'Progress', icon: 'trending-up' },
      { route: 'FoodLibrary', label: 'Food', icon: 'pie-chart' },
    ],
  },
  {
    title: 'TRAINING / TOOLS',
    items: [
      { route: 'WorkoutSplits', label: 'Workout Splits', icon: 'layers' },
      { route: 'ExerciseLibrary', label: 'Exercise Library', icon: 'list' },
    ],
  },
  {
    title: 'NUTRITION',
    items: [
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
