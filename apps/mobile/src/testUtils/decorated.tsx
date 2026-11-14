import type { PropsWithChildren } from 'react';
import { AppThemeContext, useAppTheme } from '../theme/appThemeContext';

// The app as it looks through the holidays with Holiday Decorations on -- the original look
// otherwise, as without a provider.
export function Decorated({ children }: PropsWithChildren) {
  const theme = useAppTheme();
  return (
    <AppThemeContext.Provider value={{ ...theme, snowSeason: true, decorating: true }}>
      {children}
    </AppThemeContext.Provider>
  );
}
