import { colors } from '../design/theme';
import { mixHex } from '../theme/accentColor';
import { DEFAULT_THEME_ID, themeById, type AppTheme } from '../theme/appThemes';
import type { WidgetLook } from './widgetProps';

// The app theme the home-screen widgets and the Lock Screen card wear (Settings > Appearance):
// its accent, a glow worked from it for a widget without its photo, and the photo itself once
// it's been kept where the widgets can read it (widgetPhotos.ts). Set by WidgetSync whenever the
// theme changes, and added to everything handed to a widget (widgetUpdates.ts).

/** The theme's accent, and its glow on the app's own fill (opaque, as a widget's background must be). */
export function themeLook(theme: AppTheme): WidgetLook {
  return { accent: theme.accent, glow: mixHex(theme.accent, colors.background, 0.8) };
}

let current: WidgetLook = themeLook(themeById(DEFAULT_THEME_ID));

/** What the widgets wear now: the original look until the app's theme has been read. */
export function widgetLook(): WidgetLook {
  return current;
}

export function setWidgetLook(look: WidgetLook): void {
  current = look;
}
