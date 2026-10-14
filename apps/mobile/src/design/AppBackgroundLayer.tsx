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

// The warm gym photo behind every screen (Warm Minimal -- see DESIGN.md §3a).
// Exported for the one other place it appears: the top of the workout share card.
export const BACKGROUND_IMAGE = require('../../assets/background-gym-warm.jpg');
// The photo's own width / height, so it keeps its proportions.
const BACKGROUND_ASPECT = 852 / 900;
// Shown a little larger than the screen and pinned to the top-left, so the bright lake glare
// sits toward the right edge, clear of the left-aligned text over it -- the way the bright
// window sits beside the text in the Warm Minimal reference.
const PHOTO_ZOOM = 1.25;
// How dark the photo is kept, and how far down it starts fading into the solid fill. Chosen by
// measurement on a phone-sized screen: textPrimary keeps WCAG AA (4.5:1) even over the photo's
// brightest pixel, and so does textSecondary inside a translucent card, so text can sit on the
// background anywhere at the top of a screen.
const PHOTO_DIM = 0.6;
const FADE_START = 0.45;
// While a photo hero (Card `hero` -- Feed's Next Workout, Train's start/resume card) is on the
// screen, the photo is lighter and stays visible lower, behind the whole hero, so it shows
// through the hero the way it does in the reference. Measured the same way: the header and the
// hero's title keep AA at every pixel, the hero's smaller lines over all but the photo's
// brightest specks, and so does a translucent card's textSecondary.
const HERO_PHOTO_DIM = 0.45;
const HERO_FADE_START = 0.6;
// The difference between the two, as one extra layer over the hero darkening: at full opacity
// it adds back exactly the everyday darkening (1 - (1 - hero)(1 - extra) = everyday at every
// point), and fading it out brightens the photo smoothly. Piecewise linear between its stops.
const EXTRA_DIM = 1 - (1 - PHOTO_DIM) / (1 - HERO_PHOTO_DIM);
const EVERYDAY_AT_HERO_FADE =
  PHOTO_DIM + (1 - PHOTO_DIM) * ((HERO_FADE_START - FADE_START) / (1 - FADE_START));
const EXTRA_DIM_LOW = 1 - (1 - EVERYDAY_AT_HERO_FADE) / (1 - HERO_PHOTO_DIM);
const BRIGHTEN_MS = 300;

// How a hero tells the backdrop behind its screen to brighten (see useHeroBackdrop).
const HeroBackdropContext = createContext<(() => () => void) | null>(null);

/**
 * Lightens the photo behind the current screen while `active` (and the caller) is mounted --
 * Card calls it for `hero`. A no-op outside a ScreenBackdrop.
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
// fill, the gym photo across the top fading into it, and the accent glow and shade
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
  // How many photo heroes are on this screen right now; the photo is lighter while any is.
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

// The gym photo pinned to the top-left, held at a steady darkness through its upper part
// (behind the header and the first widgets) and then fading into the fill, so the rest of the
// screen is the plain warm background. `bright` (a hero is on screen) eases it lighter.
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
    <View testID={`${testIDPrefix}-photo`} style={styles.photo} pointerEvents="none">
      <Image source={BACKGROUND_IMAGE} style={StyleSheet.absoluteFill} contentFit="cover" />
      <LinearGradient
        testID={`${testIDPrefix}-photo-fade`}
        colors={[
          withAlpha(colors.background, HERO_PHOTO_DIM),
          withAlpha(colors.background, HERO_PHOTO_DIM),
          colors.background,
        ]}
        locations={[0, HERO_FADE_START, 1]}
        style={StyleSheet.absoluteFill}
      />
      <Animated.View
        testID={`${testIDPrefix}-photo-everyday`}
        style={[StyleSheet.absoluteFill, { opacity: everydayOpacity }]}
      >
        <LinearGradient
          colors={[
            withAlpha(colors.background, EXTRA_DIM),
            withAlpha(colors.background, EXTRA_DIM),
            withAlpha(colors.background, EXTRA_DIM_LOW),
            withAlpha(colors.background, EXTRA_DIM_LOW),
          ]}
          locations={[0, FADE_START, HERO_FADE_START, 1]}
          style={StyleSheet.absoluteFill}
        />
      </Animated.View>
    </View>
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
  // The zoomed photo runs past the right edge; never let it draw outside the screen.
  clip: {
    overflow: 'hidden',
  },
});
