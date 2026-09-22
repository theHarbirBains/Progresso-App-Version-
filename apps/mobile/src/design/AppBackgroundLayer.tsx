import { useEffect, useMemo, useRef, type ReactNode } from 'react';
import { Animated, StyleSheet, useWindowDimensions, View, type DimensionValue } from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import Svg, { Line, Path } from 'react-native-svg';
import { useReduceMotionPreference } from '../navigation/navigationTransitions';
import { useBackgroundTheme } from './backgroundThemeStore';
import type { BackgroundThemeDefinition } from './backgroundThemes';
import { withAlpha } from '../theme/accentColor';

interface Props {
  /**
   * The current mode's accent (Workout blue / Nutrition green, the user's own
   * choice), which tints the soft glow. App.tsx picks it from the mode --
   * Dashboard's own Workout/Nutrition toggle for Dashboard itself, or whichever
   * mode the current route belongs to (see isNutritionRoute). Omit for no glow
   * (sign-in and the other screens shown before a mode exists).
   */
  accentColor?: string;
  /**
   * Whether the glow and shade show at all. Default true. App.tsx passes true
   * whenever the user is signed in and leaves it on for the whole session; it
   * is off only before sign-in, where the flat fill stands alone. Kept mounted
   * either way, with only its opacity changing.
   */
  showAtmosphere?: boolean;
}

// The single place that paints the selected Background Theme's environment,
// mounted once behind the whole app (see App.tsx's AppShell) so every screen
// inherits it automatically -- screens themselves know nothing about the
// current theme; they simply render on a transparent root so this shows
// through. It is the same background in both modes -- the theme's flat fill,
// its restrained treatment, and the accent glow and shade (`Atmosphere`) --
// only the accent differs (blue for Workout, green for Nutrition). Every
// treatment is deliberately quiet: low element counts, low opacity, slow-or-no
// motion -- the Progresso UI stays the visual focus.
export function AppBackgroundLayer({ accentColor, showAtmosphere = true }: Props) {
  const { theme } = useBackgroundTheme();
  const reduceMotion = useReduceMotionPreference();
  // Explicit window size rather than relying on inherited flex/absoluteFill
  // sizing through SafeAreaProvider et al -- `useWindowDimensions` is the
  // one value guaranteed to match the device's actual full screen (and it
  // updates live on rotation).
  const { width, height } = useWindowDimensions();
  const fullScreenStyle = { position: 'absolute' as const, top: 0, left: 0, width, height };

  return (
    <View style={fullScreenStyle} pointerEvents="none" testID="app-background-layer">
      <View style={[StyleSheet.absoluteFill, { backgroundColor: theme.colors.background }]} />
      <Treatment theme={theme} reduceMotion={reduceMotion} />
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
 * The backdrop of every screen except Dashboard: the Background Theme's flat
 * fill (opaque) plus that theme's own restrained treatment, painted by the
 * screen itself. Because it is opaque and part of the screen, it moves with
 * the screen during a push/pop, so a page transition never shows the layer
 * behind it (or waits on JS to change it). Applied once, to every
 * non-Dashboard route, by the navigator's `screenLayout` in App.tsx, with the
 * same glow and shade the layer behind Dashboard draws -- the two read as one
 * background.
 */
export function ScreenBackdrop({
  children,
  accentColor,
}: {
  children: ReactNode;
  /** The screen's mode accent (Workout blue / Nutrition green). Tints a soft glow in the top corner; omit for none. */
  accentColor?: string;
}) {
  const { theme } = useBackgroundTheme();
  const reduceMotion = useReduceMotionPreference();
  return (
    <View
      testID="screen-backdrop"
      style={[styles.backdrop, { backgroundColor: theme.colors.background }]}
    >
      <View style={StyleSheet.absoluteFill} pointerEvents="none">
        <Treatment theme={theme} reduceMotion={reduceMotion} />
        <Atmosphere accentColor={accentColor} testIDPrefix="screen-backdrop" />
      </View>
      {children}
    </View>
  );
}

// Two quiet layers, and nothing more: a soft glow of the mode accent easing in
// from the top-left corner (so each mode has its own tone), and a gentle shade
// toward the bottom edge for depth. Both are static and low-contrast, so content
// on top stays the focus. Shared by every page's ScreenBackdrop and by the layer
// behind Dashboard, in both modes, so they read as one background.
function Atmosphere({ accentColor, testIDPrefix }: { accentColor?: string; testIDPrefix: string }) {
  return (
    <>
      {accentColor ? (
        <LinearGradient
          testID={`${testIDPrefix}-glow`}
          colors={[withAlpha(accentColor, 0.2), withAlpha(accentColor, 0)]}
          start={{ x: 0, y: 0 }}
          end={{ x: 0.85, y: 0.55 }}
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

function Treatment({
  theme,
  reduceMotion,
}: {
  theme: BackgroundThemeDefinition;
  reduceMotion: boolean;
}) {
  switch (theme.treatment) {
    case 'starlight':
      return <DotField count={26} maxSize={1.6} twinkle animated={!reduceMotion} />;
    case 'particles':
      return <DotField count={10} maxSize={2.6} drift animated={!reduceMotion} />;
    case 'aurora':
      return <AuroraWash animated={!reduceMotion} />;
    case 'topographic':
      return <TopographicLines />;
    case 'carbon':
      return <CarbonFiber />;
    case 'flat':
    default:
      return null;
  }
}

// Deterministic pseudo-random generator so the star/particle field doesn't
// reshuffle on every render/remount (a fixed seed reads as an intentional
// pattern rather than visual noise).
function seededRandom(seed: number): () => number {
  let value = seed;
  return () => {
    value = (value * 9301 + 49297) % 233280;
    return value / 233280;
  };
}

interface DotFieldProps {
  count: number;
  maxSize: number;
  animated: boolean;
  twinkle?: boolean;
  drift?: boolean;
}

function DotField({ count, maxSize, animated, twinkle, drift }: DotFieldProps) {
  const dots = useMemo(() => {
    const rand = seededRandom(count * 7919 + 13);
    return Array.from({ length: count }, () => ({
      left: `${(rand() * 100).toFixed(2)}%` as DimensionValue,
      top: `${(rand() * 100).toFixed(2)}%` as DimensionValue,
      size: 1 + rand() * (maxSize - 1),
      baseOpacity: 0.08 + rand() * 0.18,
      delay: rand() * 4000,
      duration: 3500 + rand() * 4000,
    }));
  }, [count, maxSize]);

  return (
    <>
      {dots.map((dot, i) => (
        <AnimatedDot
          key={i}
          left={dot.left}
          top={dot.top}
          size={dot.size}
          baseOpacity={dot.baseOpacity}
          delay={dot.delay}
          duration={dot.duration}
          animated={animated}
          twinkle={!!twinkle}
          drift={!!drift}
        />
      ))}
    </>
  );
}

function AnimatedDot({
  left,
  top,
  size,
  baseOpacity,
  delay,
  duration,
  animated,
  twinkle,
  drift,
}: {
  left: DimensionValue;
  top: DimensionValue;
  size: number;
  baseOpacity: number;
  delay: number;
  duration: number;
  animated: boolean;
  twinkle: boolean;
  drift: boolean;
}) {
  const progress = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    if (!animated) {
      progress.setValue(0);
      return;
    }
    const loop = Animated.loop(
      Animated.sequence([
        Animated.delay(delay),
        Animated.timing(progress, { toValue: 1, duration, useNativeDriver: true }),
        Animated.timing(progress, { toValue: 0, duration, useNativeDriver: true }),
      ]),
    );
    loop.start();
    return () => loop.stop();
  }, [animated, delay, duration, progress]);

  const opacity = twinkle
    ? progress.interpolate({ inputRange: [0, 1], outputRange: [baseOpacity, baseOpacity + 0.35] })
    : baseOpacity;
  const translateY = drift ? progress.interpolate({ inputRange: [0, 1], outputRange: [0, -6] }) : 0;

  return (
    <Animated.View
      style={{
        position: 'absolute',
        left,
        top,
        width: size,
        height: size,
        borderRadius: size,
        backgroundColor: '#FFFFFF',
        opacity,
        transform: [{ translateY }],
      }}
    />
  );
}

// Two large, extremely low-opacity soft shapes drifting very slowly --
// restrained on purpose (fixed cool hues, not the user's accent, per the
// "background is independent of accent" requirement).
function AuroraWash({ animated }: { animated: boolean }) {
  const progress = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    if (!animated) {
      progress.setValue(0);
      return;
    }
    const loop = Animated.loop(
      Animated.sequence([
        Animated.timing(progress, { toValue: 1, duration: 26000, useNativeDriver: true }),
        Animated.timing(progress, { toValue: 0, duration: 26000, useNativeDriver: true }),
      ]),
    );
    loop.start();
    return () => loop.stop();
  }, [animated, progress]);

  const shiftA = progress.interpolate({ inputRange: [0, 1], outputRange: [0, 24] });
  const shiftB = progress.interpolate({ inputRange: [0, 1], outputRange: [0, -18] });

  return (
    <>
      <Animated.View
        style={[
          styles.auroraShape,
          {
            top: '-10%',
            left: '-20%',
            backgroundColor: '#1F6E63',
            opacity: 0.05,
            transform: [{ translateX: shiftA }],
          },
        ]}
      />
      <Animated.View
        style={[
          styles.auroraShape,
          {
            top: '5%',
            right: '-25%',
            backgroundColor: '#4B3A73',
            opacity: 0.045,
            transform: [{ translateX: shiftB }],
          },
        ]}
      />
    </>
  );
}

// A few smooth, very-low-opacity contour-style curves. Static (a slow
// per-frame path animation would cost far more than the effect is worth).
function TopographicLines() {
  const paths = [
    'M-20,140 C 80,110 180,170 300,140 S 460,110 520,150',
    'M-20,260 C 90,230 190,290 300,260 S 470,220 520,270',
    'M-20,380 C 100,350 200,410 300,380 S 480,340 520,390',
    'M-20,500 C 90,470 210,530 300,500 S 460,460 520,510',
    'M-20,620 C 100,590 200,650 300,620 S 470,580 520,630',
  ];
  return (
    <Svg width="100%" height="100%" viewBox="0 0 400 800" preserveAspectRatio="xMidYMid slice">
      {paths.map((d, i) => (
        <Path key={i} d={d} stroke="#FFFFFF" strokeWidth={1} fill="none" opacity={0.035} />
      ))}
    </Svg>
  );
}

// Sparse, thin diagonal lines -- a hint of woven fibre, not a repeating
// pattern dense enough to read as decoration.
function CarbonFiber() {
  const lines = Array.from({ length: 14 }, (_, i) => i * 60 - 200);
  return (
    <Svg width="100%" height="100%" viewBox="0 0 400 800" preserveAspectRatio="xMidYMid slice">
      {lines.map((x, i) => (
        <Line
          key={i}
          x1={x}
          y1={0}
          x2={x + 400}
          y2={800}
          stroke="#FFFFFF"
          strokeWidth={1}
          opacity={0.025}
        />
      ))}
    </Svg>
  );
}

const styles = StyleSheet.create({
  backdrop: {
    flex: 1,
  },
  auroraShape: {
    position: 'absolute',
    width: '90%',
    height: 260,
    borderRadius: 260,
  },
});
