import { createContext, useContext } from 'react';

interface AppMenuContextValue {
  /**
   * Opens the app-level side menu -- one universal list (APP_MENU_SECTIONS),
   * the same regardless of which screen opens it. No mode argument: there
   * is no more Workout/Nutrition toggle for the menu's content to switch
   * on (see DESIGN.md §11).
   */
  openMenu: () => void;
  /**
   * The app's current effective mode, as computed by Root (route-derived
   * for screens with an unambiguous mode identity, a shared "most
   * recently visited" flag for the mode-agnostic root screens -- Feed,
   * Progress, You). Purely cosmetic now (which accent tints a screen's own
   * background glow) -- it no longer gates what any screen shows.
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
