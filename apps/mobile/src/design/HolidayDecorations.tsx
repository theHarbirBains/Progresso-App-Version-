import { useMemo } from 'react';
import {
  StyleSheet,
  useWindowDimensions,
  View,
  type StyleProp,
  type ViewStyle,
} from 'react-native';
import Svg, { Circle, Ellipse, G, Path, Rect } from 'react-native-svg';
import { themeById } from '../theme/appThemes';
import { colors } from './theme';

// The holiday decorations (Settings > Appearance > Holiday Decorations, theme/snowSeason.ts): a
// Santa hat on each page's title (AppHeader) and a string of lights along the tab bar
// (BottomNavBar). Few and small, never over anything to read; touches pass straight through
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

/**
 * A string of small lights hanging along the top of whatever it's laid over (the tab bar), as
 * wide as the screen: a faint wire dipping between hooks and one bulb in each dip, lit with a
 * soft glow. They don't twinkle -- nothing moves.
 */
export function HolidayLights({ testID = 'holiday-lights' }: { testID?: string }) {
  const { width } = useWindowDimensions();
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

  return (
    <View
      testID={testID}
      pointerEvents="none"
      style={styles.lights}
      accessibilityElementsHidden
      importantForAccessibility="no-hide-descendants"
    >
      <Svg width={width} height={LIGHTS_HEIGHT}>
        <Path
          d={wire}
          stroke={colors.textMuted}
          strokeOpacity={0.6}
          strokeWidth={0.8}
          fill="none"
        />
        {Array.from({ length: count }, (_, i) => {
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
        })}
      </Svg>
    </View>
  );
}

const styles = StyleSheet.create({
  lights: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    height: LIGHTS_HEIGHT,
  },
});
