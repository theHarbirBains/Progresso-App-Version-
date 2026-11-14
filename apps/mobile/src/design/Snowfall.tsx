import { useEffect, useMemo, useRef } from 'react';
import { Animated, Easing, StyleSheet, useWindowDimensions, View } from 'react-native';
import { useReduceMotionPreference } from '../navigation/navigationTransitions';
import { colors } from './theme';

/** How many flakes are falling at once -- few, so every screen stays easy to read. */
export const SNOWFLAKES = 14;

interface Flake {
  /** Across the screen, 0-1. */
  x: number;
  /** Where in its fall it starts, 0-1, so they don't all set off together. */
  phase: number;
  size: number;
  opacity: number;
  /** One fall, top to bottom, in ms. */
  duration: number;
  /** How far it drifts side to side. */
  sway: number;
}

/** The same flakes every time (a fixed sequence, not Math.random), spread evenly across. */
export function snowflakes(): Flake[] {
  let seed = 7;
  const next = () => {
    seed = (seed * 9301 + 49297) % 233280;
    return seed / 233280;
  };
  return Array.from({ length: SNOWFLAKES }, (_, i) => ({
    x: (i + 0.2 + next() * 0.6) / SNOWFLAKES,
    phase: next(),
    size: 3 + Math.round(next() * 3),
    opacity: 0.3 + next() * 0.35,
    duration: 9000 + Math.round(next() * 7000),
    sway: 8 + Math.round(next() * 10),
  }));
}

function FallingFlake({ flake, width, height }: { flake: Flake; width: number; height: number }) {
  const progress = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    const fall = Animated.loop(
      Animated.timing(progress, {
        toValue: 1,
        duration: flake.duration,
        easing: Easing.linear,
        useNativeDriver: true,
      }),
    );
    fall.start();
    return () => fall.stop();
  }, [progress, flake.duration]);

  // Where it is in its fall, starting part way down so the screen is never empty at first.
  const fallen = Animated.modulo(Animated.add(progress, flake.phase), 1);
  const translateY = fallen.interpolate({
    inputRange: [0, 1],
    outputRange: [-flake.size * 2, height + flake.size * 2],
  });
  const translateX = fallen.interpolate({
    inputRange: [0, 0.25, 0.5, 0.75, 1],
    outputRange: [0, flake.sway, 0, -flake.sway, 0],
  });

  return (
    <Animated.View
      style={[
        styles.flake,
        {
          left: flake.x * width,
          width: flake.size,
          height: flake.size,
          borderRadius: flake.size / 2,
          opacity: flake.opacity,
          transform: [{ translateY }, { translateX }],
        },
      ]}
    />
  );
}

/**
 * A gentle snowfall over the whole app for the holidays (theme/snowSeason.ts, and Settings >
 * Appearance > Snowfall). A few small, soft, see-through flakes drifting down slowly -- never
 * enough to get in the way of reading -- that touches pass straight through and assistive tech
 * never meets. Under Reduce Motion there's none.
 */
export function Snowfall({ testID = 'snowfall' }: { testID?: string }) {
  const reduceMotion = useReduceMotionPreference();
  const { width, height } = useWindowDimensions();
  const all = useMemo(snowflakes, []);

  if (reduceMotion) return null;

  return (
    <View
      testID={testID}
      pointerEvents="none"
      style={StyleSheet.absoluteFill}
      accessibilityElementsHidden
      importantForAccessibility="no-hide-descendants"
    >
      {all.map((flake, i) => (
        <FallingFlake key={i} flake={flake} width={width} height={height} />
      ))}
    </View>
  );
}

const styles = StyleSheet.create({
  flake: {
    position: 'absolute',
    top: 0,
    backgroundColor: colors.textPrimary,
  },
});
