import { useEffect, useRef, useState } from 'react';
import { Animated, Image, StyleSheet, View } from 'react-native';
import { colors } from '../design/theme';
import { useReduceMotionPreference } from '../navigation/navigationTransitions';
import { withAlpha } from '../theme/accentColor';
import type { AppTheme } from '../theme/appThemes';

const logo = require('../../assets/progresso-mark-light.png');
// Through the holidays: a gym dressed for Christmas, cut to a phone's height (512 x 1024).
const holidayPhoto = require('../../assets/launch/holiday-launch.jpg');

/** How long the holiday launch stays, from the moment the app starts, before Progresso opens. */
export const HOLIDAY_LAUNCH_MS = 3000;

// The mark's own picture is 720 x 598 (the P with room for its shadow).
const LOGO_WIDTH = 260;
const LOGO_HEIGHT = Math.round((LOGO_WIDTH * 598) / 720);

/** Whether HOLIDAY_LAUNCH_MS have passed since the app started (App.tsx's AppShell). */
export function useHolidayLaunchHeld(): boolean {
  const [held, setHeld] = useState(false);
  useEffect(() => {
    const timer = setTimeout(() => setHeld(true), HOLIDAY_LAUNCH_MS);
    return () => clearTimeout(timer);
  }, []);
  return held;
}

interface Props {
  /** True once it can go: fonts are loaded, the auth session check has resolved and the theme is
   * read -- and through the holidays, once HOLIDAY_LAUNCH_MS have passed (App.tsx's AppShell). */
  ready: boolean;
  /** The theme on this phone, once it's read; null until then. */
  theme: AppTheme | null;
  /** The holidays, with their decorations on: the holiday photo instead of the theme's. */
  holiday?: boolean;
}

// The branded launch state shown every time the app opens, while fonts load and the Supabase
// session check resolves: the white P (and its soft shadow) centred full screen, over the photo
// of the theme chosen on this phone. Full-bleed on purpose: the logo is centred in the entire
// screen, not the safe area -- a splash has nothing pinned near an edge, so there's no
// hardcoded offset to replace with useSafeAreaInsets here (unlike every real screen's Screen).
//
// It takes over from the native splash -- the same P on the flat warm brown, which can't know
// the theme, since it shows before any of the app runs -- with that same brown, so the hand-over
// can't be seen; the theme is read a moment later (AppThemeProvider), and its photo eases in
// behind the P under a light shade that keeps the P clear. The P eases in too, growing
// slightly. Under Reduce Motion both simply appear.
//
// Through the holidays (November 1 to January 6, theme/snowSeason.ts), unless Holiday
// Decorations are off, the photo is a gym dressed for Christmas instead, and it stays about three
// seconds from the start (HOLIDAY_LAUNCH_MS) -- the app opens behind it meanwhile, so it's ready
// the moment it fades.
//
// Stays mounted for the app's whole lifetime rather than unmounting after its exit fade: once
// `ready` is true it settles at opacity 0 with pointerEvents "none", so it's invisible and
// inert -- cheaper and simpler than tearing it down, and avoids a state update racing the
// animation's completion callback.
export function LaunchScreen({ ready, theme, holiday = false }: Props) {
  const reduceMotion = useReduceMotionPreference();
  const opacity = useRef(new Animated.Value(1)).current;
  const logoOpacity = useRef(new Animated.Value(0)).current;
  const scale = useRef(new Animated.Value(0.92)).current;
  const photoOpacity = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    if (reduceMotion) {
      logoOpacity.setValue(1);
      scale.setValue(1);
      return;
    }
    Animated.parallel([
      Animated.timing(logoOpacity, { toValue: 1, duration: 450, useNativeDriver: true }),
      Animated.timing(scale, { toValue: 1, duration: 450, useNativeDriver: true }),
    ]).start();
  }, [reduceMotion, logoOpacity, scale]);

  const hasTheme = theme !== null;
  useEffect(() => {
    if (!hasTheme) return;
    if (reduceMotion) {
      photoOpacity.setValue(1);
      return;
    }
    Animated.timing(photoOpacity, { toValue: 1, duration: 220, useNativeDriver: true }).start();
  }, [hasTheme, reduceMotion, photoOpacity]);

  useEffect(() => {
    if (!ready) return;
    // Interrupts the entrance animation gracefully if it's still in flight
    // (Animated.Value continues smoothly from its current position) --
    // outside the holidays there's no minimum-visible delay, only the fade itself.
    Animated.timing(opacity, { toValue: 0, duration: 280, useNativeDriver: true }).start();
  }, [ready, opacity]);

  return (
    <Animated.View
      testID="launch-screen"
      pointerEvents="none"
      style={[styles.container, { opacity }]}
    >
      {theme ? (
        <Animated.View
          testID="launch-photo"
          style={[StyleSheet.absoluteFill, { opacity: photoOpacity }]}
        >
          <Image
            testID="launch-photo-image"
            source={holiday ? holidayPhoto : theme.photo}
            resizeMode="cover"
            style={styles.photo}
          />
          <View style={[StyleSheet.absoluteFill, styles.shade]} />
        </Animated.View>
      ) : null}
      <Animated.Image
        testID="launch-logo"
        source={logo}
        resizeMode="contain"
        style={[styles.logo, { opacity: logoOpacity, transform: [{ scale }] }]}
      />
    </Animated.View>
  );
}

const styles = StyleSheet.create({
  container: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    backgroundColor: colors.launchWood,
    alignItems: 'center',
    justifyContent: 'center',
  },
  photo: {
    width: '100%',
    height: '100%',
  },
  // Enough to keep the white P clear over a bright sky or snow; the P has its own shadow too.
  shade: {
    backgroundColor: withAlpha(colors.background, 0.35),
  },
  logo: {
    width: LOGO_WIDTH,
    height: LOGO_HEIGHT,
  },
});
