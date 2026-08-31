import { useEffect, useRef } from 'react';
import { Animated, StyleSheet } from 'react-native';
import { colors } from '../design/theme';

const logo = require('../../assets/progresso-mark.png');

interface Props {
  /** True once fonts are loaded and the auth session check has resolved. */
  ready: boolean;
}

// The branded launch state shown while fonts load and the Supabase session
// check resolves. Full-bleed and edge-to-edge on purpose: the logo is
// centered in the entire screen, not the safe area -- a splash has nothing
// pinned near an edge, so there's no hardcoded offset to replace with
// useSafeAreaInsets here (unlike every real screen's ScreenContainer).
//
// Stays mounted for the app's whole lifetime rather than unmounting after
// its exit fade: once `ready` is true it settles at opacity 0 with
// pointerEvents "none", so it's invisible and inert -- cheaper and simpler
// than tearing it down, and avoids a state update racing the animation's
// completion callback.
export function LaunchScreen({ ready }: Props) {
  const opacity = useRef(new Animated.Value(0)).current;
  const scale = useRef(new Animated.Value(0.92)).current;

  useEffect(() => {
    Animated.parallel([
      Animated.timing(opacity, { toValue: 1, duration: 450, useNativeDriver: true }),
      Animated.timing(scale, { toValue: 1, duration: 450, useNativeDriver: true }),
    ]).start();
  }, [opacity, scale]);

  useEffect(() => {
    if (!ready) return;
    // Interrupts the entrance animation gracefully if it's still in flight
    // (Animated.Value continues smoothly from its current position) --
    // there's no artificial minimum-visible delay, only the fade itself.
    Animated.timing(opacity, { toValue: 0, duration: 280, useNativeDriver: true }).start();
  }, [ready, opacity]);

  return (
    <Animated.View
      testID="launch-screen"
      pointerEvents="none"
      style={[styles.container, { opacity }]}
    >
      <Animated.Image
        testID="launch-logo"
        source={logo}
        resizeMode="contain"
        style={[styles.logo, { transform: [{ scale }] }]}
      />
    </Animated.View>
  );
}

const styles = StyleSheet.create({
  container: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: colors.background,
    alignItems: 'center',
    justifyContent: 'center',
  },
  logo: {
    width: 140,
    height: 140,
  },
});
