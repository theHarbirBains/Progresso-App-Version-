import { Feather } from '@expo/vector-icons';
import { StyleSheet, View } from 'react-native';
import Svg, { Circle, Path } from 'react-native-svg';
import { colors } from '../design/theme';
import { withAlpha } from '../theme/accentColor';

const R = 44;
const GAP_DEGREES = 7;

/** An arc of the ring from `start` to `end` degrees (0 at the top, clockwise). */
function arc(start: number, end: number): string {
  const point = (deg: number) => {
    const a = ((deg - 90) * Math.PI) / 180;
    return `${(50 + R * Math.cos(a)).toFixed(2)} ${(50 + R * Math.sin(a)).toFixed(2)}`;
  };
  return `M${point(start)}A${R} ${R} 0 ${end - start > 180 ? 1 : 0} 1 ${point(end)}`;
}

/**
 * An achievement's emblem: its own glyph in a well, inside a ring of one segment per level --
 * the levels reached lit in the accent, the rest a faint outline -- so how far up it you are
 * reads at a glance. A single unlock's ring is whole. Not started, the glyph is muted.
 */
export function AchievementEmblem({
  icon,
  level,
  levels,
  accentColor,
  size = 52,
  testID,
}: {
  icon: keyof typeof Feather.glyphMap;
  level: number;
  levels: number;
  accentColor: string;
  size?: number;
  testID?: string;
}) {
  const earned = level > 0;
  const dim = colors.glassBorderStrong;
  const step = 360 / Math.max(1, levels);
  return (
    <View
      testID={testID}
      style={[styles.emblem, { width: size, height: size }]}
      accessibilityElementsHidden
      importantForAccessibility="no-hide-descendants"
    >
      <Svg width={size} height={size} viewBox="0 0 100 100" style={StyleSheet.absoluteFill}>
        <Circle
          cx={50}
          cy={50}
          r={36}
          fill={withAlpha(earned ? accentColor : colors.textMuted, earned ? 0.14 : 0.06)}
        />
        {levels <= 1 ? (
          <Circle
            cx={50}
            cy={50}
            r={R}
            fill="none"
            stroke={earned ? accentColor : dim}
            strokeWidth={5}
          />
        ) : (
          Array.from({ length: levels }, (_, index) => (
            <Path
              key={index}
              d={arc(index * step + GAP_DEGREES / 2, (index + 1) * step - GAP_DEGREES / 2)}
              fill="none"
              stroke={index < level ? accentColor : dim}
              strokeWidth={5}
              strokeLinecap="round"
            />
          ))
        )}
      </Svg>
      <Feather
        name={icon}
        size={Math.round(size * 0.34)}
        color={earned ? accentColor : colors.textMuted}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  emblem: {
    alignItems: 'center',
    justifyContent: 'center',
  },
});
