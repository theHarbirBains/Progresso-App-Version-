import { useEffect, useMemo, useRef } from 'react';
import {
  Animated,
  StyleSheet,
  useWindowDimensions,
  View,
  type StyleProp,
  type ViewStyle,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import Svg, { Circle, Defs, Ellipse, G, Path, Pattern, Rect } from 'react-native-svg';
import { useReduceMotionPreference } from '../navigation/navigationTransitions';
import { themeById } from '../theme/appThemes';
import { colors } from './theme';

// The holiday decorations (Settings > Appearance > Holiday Decorations, theme/snowSeason.ts): a
// Santa hat on each page's title (AppHeader), a string of lights along the tab bar (BottomNavBar)
// and another across the top of every screen (HolidayGarland), snow on the hero card (SnowCap),
// candy-cane progress bars (CandyStripes) and a festive greeting on Feed (feed/greeting.ts). Few and small, never over anything to read; touches pass straight through
// them and assistive tech never meets them. Drawn in the palette's own colours: the hat in its
// red and cream, the bulbs in its red and three themes' accents.

/** The hat's red body, its tip flopped over to the right (in a 32 x 28 box). */
const HAT_BODY =
  'M5 21C7 12 12 5 20 4C25 3.5 28 7 28 12L25.5 12.5C25 10 23.5 9 21.5 9.5C23 13 24.5 17 25 21Z';

/** A Santa hat, `size` points wide, to sit tilted on the first letter of a title. */
export function SantaHat({
  size = 20,
  style,
  testID = 'santa-hat',
}: {
  size?: number;
  style?: StyleProp<ViewStyle>;
  testID?: string;
}) {
  return (
    <View
      testID={testID}
      pointerEvents="none"
      style={style}
      accessibilityElementsHidden
      importantForAccessibility="no-hide-descendants"
    >
      <Svg width={size} height={(size * 28) / 32} viewBox="0 0 32 28">
        <Path d={HAT_BODY} fill={colors.destructive} />
        <Rect x={3} y={18.5} width={24} height={6} rx={3} fill={colors.textPrimary} />
        <Circle cx={27} cy={13.5} r={3} fill={colors.textPrimary} />
      </Svg>
    </View>
  );
}

/** The bulbs' colours, in turn along the string: red, green, gold, blue. */
export const LIGHT_COLORS = [
  colors.destructive,
  themeById('forest').accent,
  themeById('summer').accent,
  themeById('alpine').accent,
];

/** About how far apart the bulbs hang. */
const BULB_SPACING = 39;
/** How far the wire dips between hooks. */
const SAG = 2.5;
const WIRE_TOP = 1.5;
export const LIGHTS_HEIGHT = 12;

/** How many bulbs hang across `width`: one in each dip of the wire, at least one. */
export function bulbCount(width: number): number {
  return Math.max(1, Math.round(width / BULB_SPACING));
}

// A twinkle's half: one set of bulbs brightening while the other dims, then back.
const TWINKLE_MS = 1400;
const DIMMED = 0.4;

/**
 * A string of small lights hanging along the top of whatever it's laid over (the tab bar), as
 * wide as the screen: a faint wire dipping between hooks and one bulb in each dip, lit with a
 * soft glow. With `twinkle`, every other bulb glows brighter in turn with the rest, slowly, on
 * the native driver -- and under Reduce Motion they're simply all lit. Without it nothing moves.
 */
export function HolidayLights({
  testID = 'holiday-lights',
  twinkle = false,
  style,
}: {
  testID?: string;
  twinkle?: boolean;
  /** Where it hangs, over the default (the top of what it's laid over). */
  style?: StyleProp<ViewStyle>;
}) {
  const { width } = useWindowDimensions();
  const reduceMotion = useReduceMotionPreference();
  const pulse = useRef(new Animated.Value(0)).current;
  const twinkling = twinkle && !reduceMotion;
  useEffect(() => {
    if (!twinkling) return undefined;
    const loop = Animated.loop(
      Animated.sequence([
        Animated.timing(pulse, { toValue: 1, duration: TWINKLE_MS, useNativeDriver: true }),
        Animated.timing(pulse, { toValue: 0, duration: TWINKLE_MS, useNativeDriver: true }),
      ]),
    );
    loop.start();
    return () => loop.stop();
  }, [twinkling, pulse]);
  const count = bulbCount(width);
  const step = width / count;
  const wire = useMemo(
    () =>
      Array.from(
        { length: count },
        (_, i) =>
          `M${i * step} ${WIRE_TOP}Q${(i + 0.5) * step} ${WIRE_TOP + SAG * 2} ${(i + 1) * step} ${WIRE_TOP}`,
      ).join(''),
    [count, step],
  );

  // The bulbs, all of them or every other one (0: the first, third, ...; 1: the second, ...).
  const bulbs = (set: 0 | 1 | null) =>
    Array.from({ length: count }, (_, i) => i)
      .filter((i) => set === null || i % 2 === set)
      .map((i) => {
        // The bottom of the dip, where each bulb hangs from its little cap.
        const x = (i + 0.5) * step;
        const y = WIRE_TOP + SAG;
        const color = LIGHT_COLORS[i % LIGHT_COLORS.length];
        return (
          <G key={i}>
            <Circle cx={x} cy={y + 4} r={4.5} fill={color} fillOpacity={0.18} />
            <Rect x={x - 1} y={y - 0.3} width={2} height={1.7} fill={colors.textMuted} />
            <Ellipse cx={x} cy={y + 4.2} rx={2.2} ry={3} fill={color} fillOpacity={0.88} />
          </G>
        );
      });
  const wirePath = (
    <Path d={wire} stroke={colors.textMuted} strokeOpacity={0.6} strokeWidth={0.8} fill="none" />
  );

  return (
    <View
      testID={testID}
      pointerEvents="none"
      style={[styles.lights, style]}
      accessibilityElementsHidden
      importantForAccessibility="no-hide-descendants"
    >
      {twinkling ? (
        <>
          <Svg width={width} height={LIGHTS_HEIGHT}>
            {wirePath}
          </Svg>
          {([0, 1] as const).map((set) => (
            <Animated.View
              key={set}
              testID={`${testID}-set-${set}`}
              style={[
                StyleSheet.absoluteFill,
                {
                  opacity: pulse.interpolate({
                    inputRange: [0, 1],
                    outputRange: set === 0 ? [1, DIMMED] : [DIMMED, 1],
                  }),
                },
              ]}
            >
              <Svg width={width} height={LIGHTS_HEIGHT}>
                {bulbs(set)}
              </Svg>
            </Animated.View>
          ))}
        </>
      ) : (
        <Svg width={width} height={LIGHTS_HEIGHT}>
          {wirePath}
          {bulbs(null)}
        </Svg>
      )}
    </View>
  );
}

/**
 * The string of lights across the top of every screen, through the holidays: just under the
 * status bar -- below its clock and battery on a phone with a notch or an island, under the bar
 * itself on one without -- so it never sits over a title or a button. Twinkling slowly. Mounted
 * once, over every screen (App.tsx's AppShell).
 */
export function HolidayGarland() {
  const insets = useSafeAreaInsets();
  const top = insets.top >= 40 ? insets.top - LIGHTS_HEIGHT : insets.top;
  return <HolidayLights testID="holiday-garland" twinkle style={{ top }} />;
}

// Snow lying along a card's top edge: soft drifts, deeper here and there (in a 100 x 10 box,
// stretched to the card's width).
const SNOW_DRIFT =
  'M0 0H100V3.2C96 5.5 92 4.2 88 5.6C84 7 80 4.4 75 4.8C70 5.2 66 8 60 7.2C54 6.4 51 4 45 4.6C39 5.2 35 7.6 29 6.8C23 6 20 3.8 14 4.4C9 5 5 7.4 0 6.2Z';
export const SNOW_CAP_HEIGHT = 9;

/**
 * Snow resting along the top of a card -- Feed's hero -- through the holidays, as if it had
 * snowed on it: soft cream drifts the card's own rounded corners trim. Purely decorative, inside
 * the card's padding so it never covers its words.
 */
export function SnowCap({ testID = 'snow-cap' }: { testID?: string }) {
  return (
    <View
      testID={testID}
      pointerEvents="none"
      style={styles.snowCap}
      accessibilityElementsHidden
      importantForAccessibility="no-hide-descendants"
    >
      <Svg width="100%" height={SNOW_CAP_HEIGHT} viewBox="0 0 100 10" preserveAspectRatio="none">
        <Path d={SNOW_DRIFT} fill={colors.textPrimary} fillOpacity={0.92} />
      </Svg>
    </View>
  );
}

/**
 * A candy cane's stripes over a progress bar's fill, through the holidays: red on cream,
 * slanted, inside the fill and trimmed to its rounded ends, so the bar keeps its length, shape and
 * motion. Nothing otherwise.
 */
export function CandyStripes({ radius, testID }: { radius: number; testID?: string }) {
  return (
    <View
      testID={testID}
      pointerEvents="none"
      style={[StyleSheet.absoluteFill, { borderRadius: radius, overflow: 'hidden' }]}
      accessibilityElementsHidden
      importantForAccessibility="no-hide-descendants"
    >
      <Svg width="100%" height="100%">
        <Defs>
          <Pattern
            id="candy-cane"
            width={8}
            height={8}
            patternUnits="userSpaceOnUse"
            patternTransform="rotate(45)"
          >
            <Rect width={8} height={8} fill={colors.textPrimary} />
            <Rect width={4} height={8} fill={colors.destructive} />
          </Pattern>
        </Defs>
        <Rect width="100%" height="100%" fill="url(#candy-cane)" />
      </Svg>
    </View>
  );
}

const styles = StyleSheet.create({
  snowCap: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    height: SNOW_CAP_HEIGHT,
  },
  lights: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    height: LIGHTS_HEIGHT,
  },
});
