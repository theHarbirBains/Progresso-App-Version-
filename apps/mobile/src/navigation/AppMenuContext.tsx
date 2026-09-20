import { createContext, useContext } from 'react';

interface AppMenuContextValue {
  /**
   * Opens the app-level side menu. `mode` picks which menu content
   * (Workout or Nutrition sections/accent) is shown -- pass it from a
   * screen whose own Workout/Nutrition mode isn't reflected in the current
   * route (Dashboard/Progress/Profile: none of them navigate on mode
   * change, so the menu can't infer mode from the route the way it does
   * for every other screen). Omit it anywhere else; the menu falls back to
   * inferring mode from the current route.
   */
  openMenu: (mode?: 'workout' | 'nutrition') => void;
  /**
   * Every primary/root screen that renders the shared `ModeToggle`
   * (Dashboard, Progress, Profile -- none of which navigate on mode
   * change) calls this whenever the toggle changes, so the shared mode
   * flag (App.tsx's `Root`) stays in sync for whichever of those screens
   * the user visits next, and so the background layer (mounted outside the
   * navigator) follows along. Workouts/Food also call it on their own
   * toggle for the same reason, even though their own mode is otherwise
   * inferred from the route (see isNutritionRoute) -- keeping the shared
   * flag current is still needed for Progress/Profile's sake. Optional so
   * call sites/tests that only care about opening the menu don't need to
   * supply it.
   */
  reportMode?: (mode: 'workout' | 'nutrition') => void;
  /**
   * The app's current effective mode, as computed by Root (route-derived
   * for screens with an unambiguous mode identity, the shared flag above
   * for mode-agnostic root screens). Read by any screen rendering the
   * shared `ModeToggle` so its selected segment reflects reality.
   */
  currentMode: 'workout' | 'nutrition';
}

export const AppMenuContext = createContext<AppMenuContextValue | null>(null);

/**
 * Lets any signed-in screen open the app-level side menu (AppSideMenu)
 * without owning its state or rendering it locally. AppSideMenu itself is
 * mounted once, at the root, alongside the navigator -- not inside any
 * individual screen -- so it renders above the entire app (header, content,
 * bottom nav) instead of being clipped to one screen's own content bounds.
 */
export function useAppMenu(): AppMenuContextValue {
  const context = useContext(AppMenuContext);
  if (!context) {
    throw new Error('useAppMenu must be used within AppMenuContext.Provider');
  }
  return context;
}
