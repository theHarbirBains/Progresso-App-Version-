import { useEffect, useRef } from 'react';
import { Animated, Image, StyleSheet } from 'react-native';
import { colors } from '../design/theme';
import { useReduceMotionPreference } from '../navigation/navigationTransitions';

const wood = require('../../assets/launch-wood.jpg');
const logo = require('../../assets/progresso-mark-light.png');

// The mark's own picture is 720 x 598 (the P with room for its shadow).
const LOGO_WIDTH = 260;
const LOGO_HEIGHT = Math.round((LOGO_WIDTH * 598) / 720);

interface Props {
  /** True once fonts are loaded and the auth session check has resolved. */
  ready: boolean;
}

// The branded launch state shown every time the app opens, while fonts load and the Supabase
// session check resolves: the app icon, full screen -- the sunlit wood planks edge to edge, with
// the white P (and its soft shadow) centred on them. Full-bleed on purpose: the logo is centred
// in the entire screen, not the safe area -- a splash has nothing pinned near an edge, so
// there's no hardcoded offset to replace with useSafeAreaInsets here (unlike every real
// screen's ScreenContainer).
//
// The wood is there from the first frame (it takes over from the native splash, which is the
// wood's own colour with the same P); only the P eases in, growing slightly. Under Reduce Motion
// the P simply appears.
//
// Stays mounted for the app's whole lifetime rather than unmounting after its exit fade: once
// `ready` is true it settles at opacity 0 with pointerEvents "none", so it's invisible and
// inert -- cheaper and simpler than tearing it down, and avoids a state update racing the
// animation's completion callback.
export function LaunchScreen({ ready }: Props) {
  const reduceMotion = useReduceMotionPreference();
  const opacity = useRef(new Animated.Value(1)).current;
  const logoOpacity = useRef(new Animated.Value(0)).current;
  const scale = useRef(new Animated.Value(0.92)).current;

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
      <Image testID="launch-wood" source={wood} resizeMode="cover" style={styles.wood} />
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
  wood: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    width: '100%',
    height: '100%',
  },
  logo: {
    width: LOGO_WIDTH,
    height: LOGO_HEIGHT,
  },
});
