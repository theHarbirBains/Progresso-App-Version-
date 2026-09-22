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
   * Unused now that there is no Workout/Nutrition toggle -- App.tsx's
   * `Root` keeps its shared mode flag current automatically, by watching
   * which route the user navigates to (see Root's own effect). Kept
   * optional on the type for now rather than removed, since a number of
   * screens' tests still construct a full context value; nothing in the
   * app calls it any more.
   */
  reportMode?: (mode: 'workout' | 'nutrition') => void;
  /**
   * The app's current effective mode, as computed by Root (route-derived
   * for screens with an unambiguous mode identity, the shared flag above
   * for the mode-agnostic root screens -- Feed, Progress, You). Read by
   * Feed and by anything opening the side menu without an explicit mode.
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
