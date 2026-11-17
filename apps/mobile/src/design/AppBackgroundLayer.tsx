import type { ReactNode } from 'react';
import { StyleSheet, useWindowDimensions, View } from 'react-native';
import { colors } from './theme';

// Every screen's background is one plain colour: the warm near-black fill (`colors.background`)
// that the text colours were chosen against, so text reads the same everywhere on a screen. No
// photo, glow or shade behind it (DESIGN.md §3a). A theme's photo shows only where it's the
// picture itself -- the home-screen widgets, the share card and the launch screen.

// The one background, mounted once behind the whole app (see App.tsx's AppShell): what the
// signed-out screens sit on. Every screen inside the navigator draws the same fill itself through
// ScreenBackdrop.
export function AppBackgroundLayer() {
  // Explicit window size rather than relying on inherited flex/absoluteFill sizing through
  // SafeAreaProvider et al -- `useWindowDimensions` is the one value guaranteed to match the
  // device's actual full screen (and it updates live on rotation).
  const { width, height } = useWindowDimensions();
  return (
    <View
      style={[styles.fill, { position: 'absolute', top: 0, left: 0, width, height }]}
      pointerEvents="none"
      testID="app-background-layer"
    />
  );
}

/**
 * Every signed-in screen's backdrop: the same plain fill as AppBackgroundLayer, painted by the
 * screen itself. Because it is opaque and part of the screen, it moves with the screen during a
 * push/pop, so a page transition never shows the layer behind it (or waits on JS to change it).
 * Applied once, to every route, by the navigator's `screenLayout` in App.tsx.
 */
export function ScreenBackdrop({ children }: { children: ReactNode }) {
  return (
    <View testID="screen-backdrop" style={[styles.backdrop, styles.fill]}>
      {children}
    </View>
  );
}

const styles = StyleSheet.create({
  backdrop: {
    flex: 1,
  },
  fill: {
    backgroundColor: colors.background,
  },
});
