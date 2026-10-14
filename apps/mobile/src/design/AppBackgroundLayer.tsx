import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useRef,
  useState,
  type ReactNode,
} from 'react';
import { Animated, StyleSheet, useWindowDimensions, View } from 'react-native';
import { Image } from 'expo-image';
import { LinearGradient } from 'expo-linear-gradient';
import { useReduceMotionPreference } from '../navigation/navigationTransitions';
import { withAlpha } from '../theme/accentColor';
import { colors } from './theme';

// The sunset gym photo behind every screen (Warm Minimal -- see DESIGN.md §3a): the bright
// window of the original workout photo, warm-graded, softly defocused and with the sun's glow
// bloomed, so text over it sits on smooth colour rather than detail. Exported for the one other
// place it appears: the top of the workout share card.
export const BACKGROUND_IMAGE = require('../../assets/background-gym-sunset.jpg');
// The photo's own width / height, so it keeps its proportions.
export const BACKGROUND_ASPECT = 852 / 1300;
// Shown a little larger than the screen and pinned to the top-left, so the sun sits at the
// right edge, beside the left-aligned text -- the way the bright window sits beside the text in
// the Warm Minimal reference.
const PHOTO_ZOOM = 1.25;

// Every darkening layer below paints colors.background at some opacity. They were chosen by
// measurement over the photo on a phone-sized screen; don't lighten any of them without
// re-measuring.
type Stops = readonly (readonly [location: number, darkness: number])[];

// The text side: heaviest on the left, where text starts, clear on the right, where the sun is.
const SIDE_SCRIM: Stops = [
  [0, 0.62],
  [0.55, 0.45],
  [1, 0],
];
// Behind the header (points from the top of the screen).
const HEADER_BAND_HEIGHT = 140;
const HEADER_BAND: Stops = [
  [0, 0.5],
  [110 / HEADER_BAND_HEIGHT, 0.25],
  [1, 0],
];
// Down the photo, every day: dark enough that textPrimary keeps WCAG AA (4.5:1) even over the
// photo's brightest pixel, textSecondary over all but its brightest specks, and text in a card
// at every pixel -- so text and widgets can sit anywhere at the top of a screen.
const EVERYDAY: Stops = [
  [0, 0.7],
  [0.42, 0.7],
  [0.55, 0.8],
  [1, 1],
];
// Down the photo while Feed's Next Workout shows (useHeroBackdrop): the sunset in full behind
// the whole hero, down past its button, darkening below it. Measured the same way: the header
// and the hero's title keep AA at every pixel, its smaller lines over all but the brightest
// specks, and text in a card at every pixel, wherever a card scrolls to.
const HERO: Stops = [
  [0, 0.1],
  [0.35, 0.1],
  [0.5, 0.62],
  [1, 1],
];
const BRIGHTEN_MS = 300;

function darknessAt(stops: Stops, y: number): number {
  for (let i = 1; i < stops.length; i++) {
    const [y0, a0] = stops[i - 1];
    const [y1, a1] = stops[i];
    if (y <= y1) return a0 + ((a1 - a0) * (y - y0)) / (y1 - y0);
  }
  return stops[stops.length - 1][1];
}

// The difference between the two, as one extra layer over the hero darkening: at full opacity
// it adds back exactly the everyday darkening (1 - (1 - hero)(1 - extra) = everyday), and
// fading it out brightens the photo smoothly. Sampled finely where the two curves differ in
// shape; elsewhere the extra layer is exactly linear. (At the very bottom both are fully dark,
// so it takes its value from just above.)
const EXTRA_LOCATIONS: GradientLocations = [0, 0.35, 0.39, 0.42, 0.46, 0.5, 0.525, 0.55, 1];
// LinearGradient takes at least two colours and locations.
type GradientColors = readonly [string, string, ...string[]];
type GradientLocations = readonly [number, number, ...number[]];

const EXTRA_COLORS = EXTRA_LOCATIONS.map((y) => {
  const at = Math.min(y, 0.999);
  const extra = 1 - (1 - darknessAt(EVERYDAY, at)) / (1 - darknessAt(HERO, at));
  return withAlpha(colors.background, Math.round(extra * 1000) / 1000);
}) as unknown as GradientColors;

const gradient = (stops: Stops) => ({
  colors: stops.map(([, darkness]) =>
    withAlpha(colors.background, darkness),
  ) as unknown as GradientColors,
  locations: stops.map(([location]) => location) as unknown as GradientLocations,
});

// How Feed tells the backdrop behind it to brighten (see useHeroBackdrop).
const HeroBackdropContext = createContext<(() => () => void) | null>(null);

/**
 * Brightens the photo behind the current screen while `active` (and the caller) is mounted --
 * Feed calls it while its Next Workout hero shows. A no-op outside a ScreenBackdrop.
 */
export function useHeroBackdrop(active: boolean) {
  const register = useContext(HeroBackdropContext);
  useEffect(() => {
    if (!active || !register) return undefined;
    return register();
  }, [active, register]);
}

interface Props {
  /**
   * The current mode's accent (soft amber -- the app has one fixed accent), which tints the
   * soft glow. App.tsx picks it from whichever mode the current route belongs to (see
   * isNutritionRoute). Omit for no glow (sign-in and the other screens shown before a mode
   * exists).
   */
  accentColor?: string;
  /**
   * Whether the glow and shade show at all. Default true. App.tsx passes true whenever the
   * user is signed in and leaves it on for the whole session; it is off only before sign-in.
   * Kept mounted either way, with only its opacity changing.
   */
  showAtmosphere?: boolean;
}

// The one background, mounted once behind the whole app (see App.tsx's AppShell): the warm
// fill, the sunset photo across the top fading into it, and the accent glow and shade
// (`Atmosphere`). It is what the signed-out screens sit on; every screen inside the navigator
// draws the same thing itself through ScreenBackdrop.
export function AppBackgroundLayer({ accentColor, showAtmosphere = true }: Props) {
  // Explicit window size rather than relying on inherited flex/absoluteFill sizing through
  // SafeAreaProvider et al -- `useWindowDimensions` is the one value guaranteed to match the
  // device's actual full screen (and it updates live on rotation).
  const { width, height } = useWindowDimensions();
  const fullScreenStyle = { position: 'absolute' as const, top: 0, left: 0, width, height };

  return (
    <View style={[fullScreenStyle, styles.clip]} pointerEvents="none" testID="app-background-layer">
      <View style={[StyleSheet.absoluteFill, styles.fill]} />
      <Photo testIDPrefix="app-background" />
      <View
        testID="app-background-atmosphere"
        style={[StyleSheet.absoluteFill, { opacity: showAtmosphere ? 1 : 0 }]}
      >
        <Atmosphere accentColor={accentColor} testIDPrefix="app-background" />
      </View>
    </View>
  );
}

/**
 * Every signed-in screen's backdrop: the same fill, photo and atmosphere as
 * AppBackgroundLayer, painted by the screen itself. Because it is opaque and part of the
 * screen, it moves with the screen during a push/pop, so a page transition never shows the
 * layer behind it (or waits on JS to change it). Applied once, to every route, by the
 * navigator's `screenLayout` in App.tsx.
 */
export function ScreenBackdrop({
  children,
  accentColor,
}: {
  children: ReactNode;
  /** The screen's mode accent (soft amber). Tints a soft glow in the top corner; omit for none. */
  accentColor?: string;
}) {
  // How many callers want the photo bright right now (see useHeroBackdrop).
  const [heroCount, setHeroCount] = useState(0);
  const registerHero = useCallback(() => {
    setHeroCount((count) => count + 1);
    return () => setHeroCount((count) => count - 1);
  }, []);

  return (
    <View testID="screen-backdrop" style={[styles.backdrop, styles.fill]}>
      <View style={[StyleSheet.absoluteFill, styles.clip]} pointerEvents="none">
        <Photo testIDPrefix="screen-backdrop" bright={heroCount > 0} />
        <Atmosphere accentColor={accentColor} testIDPrefix="screen-backdrop" />
      </View>
      <HeroBackdropContext.Provider value={registerHero}>{children}</HeroBackdropContext.Provider>
    </View>
  );
}

// The sunset photo pinned to the top-left, darkened on its text side and behind the header,
// held at a steady darkness through its upper part and then fading into the fill, so the rest
// of the screen is the plain warm background. `bright` (Feed's hero is showing) eases it to
// the lighter hero darkening.
function Photo({ testIDPrefix, bright = false }: { testIDPrefix: string; bright?: boolean }) {
  const reduceMotion = useReduceMotionPreference();
  const everydayOpacity = useRef(new Animated.Value(bright ? 0 : 1)).current;
  useEffect(() => {
    const toValue = bright ? 0 : 1;
    if (reduceMotion) {
      everydayOpacity.setValue(toValue);
      return undefined;
    }
    const animation = Animated.timing(everydayOpacity, {
      toValue,
      duration: BRIGHTEN_MS,
      useNativeDriver: true,
    });
    animation.start();
    return () => animation.stop();
  }, [bright, reduceMotion, everydayOpacity]);

  return (
    <>
      <View testID={`${testIDPrefix}-photo`} style={styles.photo} pointerEvents="none">
        <Image source={BACKGROUND_IMAGE} style={StyleSheet.absoluteFill} contentFit="cover" />
        <LinearGradient
          testID={`${testIDPrefix}-photo-fade`}
          {...gradient(HERO)}
          style={StyleSheet.absoluteFill}
        />
        <Animated.View
          testID={`${testIDPrefix}-photo-everyday`}
          style={[StyleSheet.absoluteFill, { opacity: everydayOpacity }]}
        >
          <LinearGradient
            colors={EXTRA_COLORS}
            locations={EXTRA_LOCATIONS}
            style={StyleSheet.absoluteFill}
          />
        </Animated.View>
      </View>
      <LinearGradient
        testID={`${testIDPrefix}-side-scrim`}
        {...gradient(SIDE_SCRIM)}
        start={{ x: 0, y: 0 }}
        end={{ x: 1, y: 0 }}
        style={StyleSheet.absoluteFill}
      />
      <LinearGradient
        testID={`${testIDPrefix}-header-band`}
        {...gradient(HEADER_BAND)}
        style={styles.headerBand}
      />
    </>
  );
}

// Two quiet layers over the photo, and nothing more: a soft glow of the accent easing in from
// the top-left corner, and a gentle shade toward the bottom edge for depth. Both are static
// and low-contrast, so content on top stays the focus.
function Atmosphere({ accentColor, testIDPrefix }: { accentColor?: string; testIDPrefix: string }) {
  return (
    <>
      {accentColor ? (
        <LinearGradient
          testID={`${testIDPrefix}-glow`}
          colors={[withAlpha(accentColor, 0.08), withAlpha(accentColor, 0)]}
          start={{ x: 0, y: 0 }}
          end={{ x: 0.55, y: 0.35 }}
          style={StyleSheet.absoluteFill}
        />
      ) : null}
      <LinearGradient
        testID={`${testIDPrefix}-shade`}
        colors={['rgba(0,0,0,0)', 'rgba(0,0,0,0.28)']}
        locations={[0.55, 1]}
        style={StyleSheet.absoluteFill}
      />
    </>
  );
}

const styles = StyleSheet.create({
  backdrop: {
    flex: 1,
  },
  fill: {
    backgroundColor: colors.background,
  },
  photo: {
    position: 'absolute',
    top: 0,
    left: 0,
    width: `${PHOTO_ZOOM * 100}%`,
    aspectRatio: BACKGROUND_ASPECT,
  },
  headerBand: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    height: HEADER_BAND_HEIGHT,
  },
  // The zoomed photo runs past the right edge; never let it draw outside the screen.
  clip: {
    overflow: 'hidden',
  },
});
