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

/** The add/edit form is opened from a client's page or from Clients, never from the side menu directly. */
type FormOnlyRoute = 'TrainerClientForm' | 'TrainerClaim';

export type AppMenuRoute = Exclude<NoParamRoute, FormOnlyRoute>;

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
 * Exactly two sections -- Training and Nutrition, the app's two real
 * domains -- rather than the finer PROGRESSO/TRAINING·TOOLS/NUTRITION/MORE
 * split this used to have. Settings isn't a Training or Nutrition
 * destination, so it isn't a third section here at all -- see
 * APP_MENU_FOOTER_ITEM below, rendered by AppSideMenu as a standalone final
 * row with no section header of its own.
 */
export const APP_MENU_SECTIONS: AppMenuSection[] = [
  {
    title: 'TRAINING',
    items: [
      { route: 'WorkoutHistory', label: 'Workouts', icon: 'activity' },
      { route: 'LogPastWorkout', label: 'Log a Past Workout', icon: 'edit-3' },
      { route: 'ProgressOverview', label: 'Progress', icon: 'trending-up' },
      { route: 'WorkoutSplits', label: 'Workout Splits', icon: 'layers' },
      { route: 'ExerciseLibrary', label: 'Exercise Library', icon: 'list' },
    ],
  },
  {
    title: 'NUTRITION',
    items: [
      { route: 'FoodLibrary', label: 'Food Library', icon: 'pie-chart' },
      { route: 'NutritionGoals', label: 'Nutrition Goals', icon: 'target' },
      { route: 'NutritionHistory', label: 'Nutrition History', icon: 'clock' },
      { label: 'Recipes', icon: 'book-open', comingSoon: true },
    ],
  },
  {
    title: 'SOCIAL',
    items: [
      { route: 'FindPeople', label: 'Find People', icon: 'user-plus' },
      // Everyone sees this: requests from trainers, and who can log for them.
      { route: 'TrainerAccess', label: 'Trainer Access', icon: 'user-check' },
    ],
  },
];

/**
 * The menu for this person. A trainer also gets Clients under TRAINING, which is
 * how they reach their clients from anywhere in the app. Everyone else sees the
 * same menu without it.
 */
export function appMenuSectionsFor(isTrainer: boolean): AppMenuSection[] {
  if (!isTrainer) return APP_MENU_SECTIONS;
  return APP_MENU_SECTIONS.map((section) =>
    section.title === 'TRAINING'
      ? {
          ...section,
          items: [...section.items, { route: 'TrainerClients', label: 'Clients', icon: 'users' }],
        }
      : section,
  );
}

/** Rendered by AppSideMenu as a standalone row below every section, with no
 * section header -- Settings applies to the whole app, not to Training or
 * Nutrition specifically, so it doesn't belong grouped under either one. */
export const APP_MENU_FOOTER_ITEM: AppMenuItem = {
  route: 'AccountSettings',
  label: 'Settings',
  icon: 'settings',
};
