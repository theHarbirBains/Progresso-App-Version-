import { useEffect, useRef, useState } from 'react';
import { Animated, StyleSheet, View } from 'react-native';
import { useReduceMotionPreference } from '../navigation/navigationTransitions';
import { colors } from './theme';

interface Props {
  /** How full, 0 to 1; anything outside is held to that. */
  fraction: number;
  color: string;
  /** The bar's thickness: 4 for a row's bar, 8 for a widget's one figure. */
  height?: 4 | 8;
  /** The fill's; the track is `${testID}-track`. */
  testID?: string;
}

const SPRING = { stiffness: 110, damping: 20, mass: 1, overshootClamping: true } as const;

/**
 * A bar of the way there, in one colour on a quiet track, never past full. It fills in when it
 * first appears and glides to a new length when its figure changes. Under Reduce Motion it is
 * simply drawn at its length.
 *
 * The fill is the track's full width slid left out of view, so its rounded end is never squashed
 * and the motion runs on the native driver.
 */
export function AnimatedBar({ fraction, color, height = 4, testID }: Props) {
  const reduceMotion = useReduceMotionPreference();
  const target = Math.max(0, Math.min(1, Number.isFinite(fraction) ? fraction : 0));
  const length = useRef(new Animated.Value(0)).current;
  const [trackWidth, setTrackWidth] = useState(0);

  useEffect(() => {
    if (reduceMotion) {
      length.setValue(target);
      return undefined;
    }
    const animation = Animated.spring(length, {
      toValue: target,
      ...SPRING,
      useNativeDriver: true,
    });
    animation.start();
    return () => animation.stop();
  }, [target, reduceMotion, length]);

  const radius = height / 2;
  return (
    <View
      testID={testID ? `${testID}-track` : undefined}
      style={[styles.track, { height, borderRadius: radius }]}
      onLayout={(event) => setTrackWidth(event.nativeEvent.layout.width)}
      accessibilityElementsHidden
      importantForAccessibility="no-hide-descendants"
    >
      <Animated.View
        testID={testID}
        style={[
          styles.fill,
          {
            borderRadius: radius,
            backgroundColor: color,
            // Not drawn until the track's width is known, so it never flashes full.
            opacity: trackWidth > 0 ? 1 : 0,
            transform: [
              {
                translateX: length.interpolate({
                  inputRange: [0, 1],
                  outputRange: [-trackWidth, 0],
                }),
              },
            ],
          },
        ]}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  track: {
    backgroundColor: colors.surfaceRaised,
    overflow: 'hidden',
  },
  fill: {
    width: '100%',
    height: '100%',
  },
});
