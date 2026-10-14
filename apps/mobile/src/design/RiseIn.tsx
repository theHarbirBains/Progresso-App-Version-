import { createContext, useContext, useEffect, useRef, useState, type ReactNode } from 'react';
import { Animated, Easing, type StyleProp, type ViewStyle } from 'react-native';
import { useReduceMotionPreference } from '../navigation/navigationTransitions';

// How a list of widgets rolls out: each one rises a little and fades in, one
// after another, rather than all of them popping in at once.
const DURATION_MS = 380;
const STAGGER_MS = 70;
const RISE = 18;
// Only the first few in a rollout wait their turn; the rest are below the
// fold anyway, so the whole cascade is over in well under a second.
const MAX_STAGGERED = 6;
// Widgets that first appear within this long of each other roll out as one
// cascade; one that appears on its own later (a new workout after a
// refresh, the next page loaded at the bottom) starts a cascade of its own.
const WAVE_WINDOW_MS = 250;

interface Wave {
  startedAt: number;
  count: number;
}

const WaveContext = createContext<Wave | null>(null);

/** One rollout per screen: wrap the list so its widgets cascade together, not with another screen's. */
export function RiseInGroup({ children }: { children: ReactNode }) {
  const wave = useRef<Wave>({ startedAt: -Infinity, count: 0 }).current;
  return <WaveContext.Provider value={wave}>{children}</WaveContext.Provider>;
}

/**
 * A widget that rolls out when it first appears -- never again while it stays
 * on screen, so a background refresh doesn't replay it. Under Reduce Motion
 * it simply appears.
 */
export function RiseIn({
  children,
  style,
  testID,
}: {
  children: ReactNode;
  style?: StyleProp<ViewStyle>;
  testID?: string;
}) {
  const reduceMotion = useReduceMotionPreference();
  const wave = useContext(WaveContext);
  // Its place in the cascade, fixed when it first appears.
  const [delay] = useState(() => {
    if (!wave) return 0;
    const now = Date.now();
    if (now - wave.startedAt > WAVE_WINDOW_MS) {
      wave.startedAt = now;
      wave.count = 0;
    }
    return Math.min(wave.count++, MAX_STAGGERED) * STAGGER_MS;
  });
  const progress = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    if (reduceMotion) {
      progress.setValue(1);
      return undefined;
    }
    const animation = Animated.timing(progress, {
      toValue: 1,
      duration: DURATION_MS,
      delay,
      easing: Easing.out(Easing.cubic),
      useNativeDriver: true,
    });
    animation.start();
    return () => animation.stop();
  }, [reduceMotion, delay, progress]);

  return (
    <Animated.View
      testID={testID}
      style={[
        style,
        {
          opacity: progress,
          transform: [
            { translateY: progress.interpolate({ inputRange: [0, 1], outputRange: [RISE, 0] }) },
          ],
        },
      ]}
    >
      {children}
    </Animated.View>
  );
}
