import type { ReactNode } from 'react';
import { StyleSheet, useWindowDimensions, View } from 'react-native';
import { useAppTheme } from '../theme/appThemeContext';
import { BackgroundPattern } from './BackgroundPattern';

// Every screen's background is the theme's plain colour (theme/appThemes.ts `background`): a
// near-black with a hint of the theme's hue, chosen so the app's text colours keep their contrast
// on it. Over its top, the theme's quiet design (design/BackgroundPattern.tsx), fading out down the
// screen. Never a photo (DESIGN.md §3a): a theme's photo shows only where it's the picture itself
// -- the home-screen widgets, the share card and the launch screen.

/** The theme's background and its design, filling whatever it's laid in. */
function ThemeBackground({ testIDPrefix }: { testIDPrefix: string }) {
  const { theme, accent } = useAppTheme();
  return (
    <BackgroundPattern
      testID={`${testIDPrefix}-pattern`}
      pattern={theme.pattern}
      color={accent.accent}
      background={theme.background}
    />
  );
}

// The one background, mounted once behind the whole app (see App.tsx's AppShell): what the
// signed-out screens sit on. Every screen inside the navigator draws the same thing itself through
// ScreenBackdrop.
export function AppBackgroundLayer() {
  const { theme } = useAppTheme();
  // Explicit window size rather than relying on inherited flex/absoluteFill sizing through
  // SafeAreaProvider et al -- `useWindowDimensions` is the one value guaranteed to match the
  // device's actual full screen (and it updates live on rotation).
  const { width, height } = useWindowDimensions();
  return (
    <View
      style={{
        position: 'absolute',
        top: 0,
        left: 0,
        width,
        height,
        backgroundColor: theme.background,
      }}
      pointerEvents="none"
      testID="app-background-layer"
    >
      <ThemeBackground testIDPrefix="app-background" />
    </View>
  );
}

/**
 * Every signed-in screen's backdrop: the same background and design as AppBackgroundLayer, painted
 * by the screen itself. Because it is opaque and part of the screen, it moves with the screen
 * during a push/pop, so a page transition never shows the layer behind it (or waits on JS to
 * change it). Applied once, to every route, by the navigator's `screenLayout` in App.tsx.
 */
export function ScreenBackdrop({ children }: { children: ReactNode }) {
  const { theme } = useAppTheme();
  return (
    <View testID="screen-backdrop" style={[styles.backdrop, { backgroundColor: theme.background }]}>
      <ThemeBackground testIDPrefix="screen-backdrop" />
      {children}
    </View>
  );
}

const styles = StyleSheet.create({
  backdrop: {
    flex: 1,
  },
});
