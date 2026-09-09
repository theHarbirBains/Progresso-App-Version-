import { createContext, useContext } from 'react';

interface AppMenuContextValue {
  openMenu: () => void;
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
