import { Feather } from '@expo/vector-icons';
import type { RootStackParamList } from './types';

/** Any route that takes no params -- the only kind safe to list in a
 *  generic, config-driven navigation menu (no per-item params to supply). */
type NoParamRoute = {
  [K in keyof RootStackParamList]: RootStackParamList[K] extends undefined ? K : never;
}[keyof RootStackParamList];

export type AppMenuRoute = NoParamRoute;

export interface AppMenuItem {
  route: AppMenuRoute;
  label: string;
  icon: keyof typeof Feather.glyphMap;
}

export interface AppMenuSection {
  title: string;
  items: AppMenuItem[];
}

/**
 * Contents of the app-level side menu (AppSideMenu). This is the single
 * place to add a future destination -- once its screen actually exists --
 * without touching AppSideMenu itself. Every entry here must point at a
 * real, already-registered screen; never add a placeholder for an unbuilt
 * feature.
 */
export const APP_MENU_SECTIONS: AppMenuSection[] = [
  {
    title: 'PROGRESSO',
    items: [
      { route: 'Dashboard', label: 'Home', icon: 'home' },
      { route: 'WorkoutHistory', label: 'Workouts', icon: 'activity' },
      { route: 'ProgressOverview', label: 'Progress', icon: 'trending-up' },
      { route: 'Nutrition', label: 'Nutrition', icon: 'pie-chart' },
      { route: 'Social', label: 'Social', icon: 'users' },
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
    title: 'MORE',
    items: [{ route: 'AccountSettings', label: 'Settings', icon: 'settings' }],
  },
];
