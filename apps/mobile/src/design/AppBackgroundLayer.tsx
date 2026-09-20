import { useEffect, useMemo, useRef } from 'react';
import {
  Animated,
  Image,
  StyleSheet,
  useWindowDimensions,
  View,
  type DimensionValue,
} from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import Svg, { Line, Path } from 'react-native-svg';
import { useReduceMotionPreference } from '../navigation/navigationTransitions';
import { useBackgroundTheme } from './backgroundThemeStore';
import type { BackgroundThemeDefinition } from './backgroundThemes';

interface Props {
  /**
   * Which mode's photo to show -- Dashboard's own Workout/Nutrition toggle
   * for Dashboard itself, or whichever mode the current route belongs to
   * everywhere else (see App.tsx's mode-tracking, isNutritionRoute). Any
   * screen reached before a mode is known yet (sign-in, sign-up, password
   * reset -- rendered outside the Stack.Navigator entirely) defaults to
   * 'workout', the same "workout unless proven nutrition" convention
   * isNutritionRoute already uses elsewhere.
   */
  mode?: 'workout' | 'nutrition';
  /**
   * Whether the photograph shows at all. Default true (so the component is
   * unchanged for any caller that doesn't say). App.tsx passes true only
   * while Dashboard is the current route -- everywhere else the screen sits
   * on the flat Background Theme fill (plus that theme's own restrained
   * treatment). The photos stay mounted either way and only their opacity
   * changes, for the same instant-flip reason as `mode` above: a photo that
   * had to be re-decoded each time the user returned to Dashboard would
   * flash in late.
   */
  showImage?: boolean;
}

// The single place that paints the selected Background Theme's environment,
// mounted once behind the whole app (see App.tsx's AppShell) so every screen
// inherits it automatically -- screens themselves know nothing about the
// current theme; they simply render on a transparent root so this shows
// through (see the screen-container `backgroundColor: 'transparent'` change
// that accompanies this file). Every treatment here is deliberately
// restrained: low element counts, low opacity, slow-or-no motion -- the
// existing Progresso UI stays the visual focus, this is only the atmosphere
// behind it.
export function AppBackgroundLayer({ mode = 'workout', showImage = true }: Props) {
  const { theme } = useBackgroundTheme();
  const reduceMotion = useReduceMotionPreference();
  // Explicit window size rather than relying on inherited flex/absoluteFill
  // sizing through SafeAreaProvider et al -- `useWindowDimensions` is the
  // one value guaranteed to match the device's actual full screen (and it
  // updates live on rotation), so the image can never end up sized against
  // a slightly-off ancestor box, which is what an over-cropped/"zoomed"
  // `resizeMode="cover"` result usually means.
  const { width, height } = useWindowDimensions();
  const fullScreenStyle = { position: 'absolute' as const, top: 0, left: 0, width, height };

  return (
    <View style={fullScreenStyle} pointerEvents="none" testID="app-background-layer">
      <View style={[StyleSheet.absoluteFill, { backgroundColor: theme.colors.background }]} />
      {/* Both photos stay mounted (and decoded) at all times, regardless of
          `mode` -- only their opacity toggles. Swapping a single Image's
          `source` on mode change would mean the incoming photo has to be
          decoded from scratch before it can paint, a real, visible delay on
          a 2MB+ full-screen PNG; two permanently-mounted Images make the
          Workout/Nutrition toggle an instant opacity flip instead, with no
          load cost paid at switch time. */}
      {theme.workoutImageSource ? (
        <Image
          testID="app-background-image-workout"
          source={theme.workoutImageSource}
          // Full sharpness, no blur -- contrast for content sitting on top
          // comes from the depth overlay (edges) and each glass surface's
          // own tint, not from softening or darkening the photo itself.
          style={[fullScreenStyle, { opacity: showImage && mode === 'workout' ? 1 : 0 }]}
          resizeMode="cover"
        />
      ) : null}
      {theme.nutritionImageSource ? (
        <Image
          testID="app-background-image-nutrition"
          source={theme.nutritionImageSource}
          style={[fullScreenStyle, { opacity: showImage && mode === 'nutrition' ? 1 : 0 }]}
          resizeMode="cover"
        />
      ) : null}
      <Treatment theme={theme} reduceMotion={reduceMotion} />
      <DepthOverlay visible={showImage} />
    </View>
  );
}

// The "premium glass" base atmosphere every theme now shares, layered above
// the flat fill/image/treatment: a static (never-animated, so unaffected by
// Reduce Motion) vertical vignette that darkens the very top and bottom
// edges while leaving the middle clear. This is what gives every screen its
// sense of cinematic depth without touching any per-theme color, and it
// doubles as the "background overlay for readability" DESIGN.md calls
// for -- content sits mostly in the untouched middle band; only the edges,
// where glass chrome (headers, bottom nav) usually lives, get extra
// contrast help.
//
// It exists to keep content readable over a *photograph*, so it only shows
// while the photo does (Dashboard). On the flat theme fill it would just
// muddy the theme's own colour at the edges. Kept mounted (opacity 0) rather
// than removed, so it is ready the instant Dashboard returns.
function DepthOverlay({ visible }: { visible: boolean }) {
  return (
    <LinearGradient
      testID="app-background-depth-overlay"
      pointerEvents="none"
      colors={['rgba(0,0,0,0.32)', 'rgba(0,0,0,0)', 'rgba(0,0,0,0)', 'rgba(0,0,0,0.32)']}
      locations={[0, 0.22, 0.68, 1]}
      style={[StyleSheet.absoluteFill, { opacity: visible ? 1 : 0 }]}
    />
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
  auroraShape: {
    position: 'absolute',
    width: '90%',
    height: 260,
    borderRadius: 260,
  },
});
