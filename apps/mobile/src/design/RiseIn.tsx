import {
  Children,
  createContext,
  Fragment,
  isValidElement,
  useContext,
  useEffect,
  useRef,
  useState,
  type ReactElement,
  type ReactNode,
} from 'react';
import {
  Animated,
  FlatList,
  ScrollView,
  SectionList,
  StyleSheet,
  type StyleProp,
  type ViewStyle,
} from 'react-native';
import { useReduceMotionPreference } from '../navigation/navigationTransitions';

// How a list of widgets rolls out: each one springs up from below -- rising,
// growing to full size and fading in, settling with a slight bounce -- one
// after another, rather than all of them popping in at once.
const STAGGER_MS = 110;
const RISE = 44;
const START_SCALE = 0.94;
// A soft spring: about half a second to settle, with a small overshoot.
const SPRING = { stiffness: 140, damping: 14, mass: 1 } as const;
// Only the first few in a rollout wait their turn; the rest are below the
// fold anyway, so the whole cascade is over in about a second.
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
    const animation = Animated.spring(progress, {
      toValue: 1,
      delay,
      ...SPRING,
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
          // Fully visible well before it settles, so the bounce reads as motion, not a fade.
          opacity: progress.interpolate({
            inputRange: [0, 0.6, 1],
            outputRange: [0, 1, 1],
            extrapolate: 'clamp',
          }),
          transform: [
            { translateY: progress.interpolate({ inputRange: [0, 1], outputRange: [RISE, 0] }) },
            {
              scale: progress.interpolate({ inputRange: [0, 1], outputRange: [START_SCALE, 1] }),
            },
          ],
        },
      ]}
    >
      {children}
    </Animated.View>
  );
}

// How a wrapped widget sits in its page, copied onto its rollout wrapper so
// wrapping it never changes the layout -- e.g. a card or list that fills the
// rest of the screen keeps filling it.
const LAYOUT_KEYS = ['flex', 'flexGrow', 'flexShrink', 'flexBasis', 'alignSelf'] as const;
// Scrolling lists fill the space they're given by default, without saying so
// in their own style.
const FILLS_BY_DEFAULT = new Set<unknown>([ScrollView, FlatList, SectionList]);

function riseInChildren(children: ReactNode): ReactNode {
  return Children.map(children, (child) => {
    if (!isValidElement(child)) return child;
    const element = child as ReactElement<{ style?: StyleProp<ViewStyle>; children?: ReactNode }>;
    // A fragment's own children take their own turns.
    if (element.type === Fragment) return riseInChildren(element.props.children);
    const style = StyleSheet.flatten(element.props.style) ?? {};
    // Something pinned in place (an overlay, a floating button) stays exactly
    // where it is.
    if (style.position === 'absolute') return element;
    const layout: ViewStyle = FILLS_BY_DEFAULT.has(element.type)
      ? { flexGrow: 1, flexShrink: 1 }
      : {};
    for (const key of LAYOUT_KEYS) {
      if (style[key] !== undefined) (layout as Record<string, unknown>)[key] = style[key];
    }
    return <RiseIn style={layout}>{element}</RiseIn>;
  });
}

/**
 * A page's widgets, each rolling out in turn -- every direct child (a card, a
 * section) gets its own RiseIn, in one cascade; a fragment's children each
 * take their own turn. Adds no box of its own, and each wrapper takes on how
 * its widget sits in the page (filling the rest of the screen, say), so the
 * layout is unchanged; anything pinned in place isn't wrapped at all. A
 * widget that appears later (a tab switched to) rolls in by itself. Screen
 * applies this to every page (its `rollout` prop).
 */
export function RiseInStack({ children }: { children: ReactNode }) {
  return <RiseInGroup>{riseInChildren(children)}</RiseInGroup>;
}
