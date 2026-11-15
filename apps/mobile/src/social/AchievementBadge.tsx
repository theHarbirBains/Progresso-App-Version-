import { Feather } from '@expo/vector-icons';
import { StyleSheet, View } from 'react-native';
import Svg, { Path } from 'react-native-svg';
import { Text } from '../design/Text';
import { colors, typeScale } from '../design/theme';
import { withAlpha } from '../theme/accentColor';
import type { Badge } from './achievements';

/** A pointy-top hexagon `width` wide, inset for its stroke. */
function hexagon(width: number, stroke: number): string {
  const r = width / Math.sqrt(3) - stroke;
  const cx = width / 2;
  const cy = width / Math.sqrt(3);
  const points = [-90, -30, 30, 90, 150, 210].map((deg) => {
    const a = (deg * Math.PI) / 180;
    return `${(cx + r * Math.cos(a)).toFixed(2)} ${(cy + r * Math.sin(a)).toFixed(2)}`;
  });
  return `M${points.join('L')}Z`;
}

/**
 * One badge: a hexagon outlined in the accent, faintly filled with it, its glyph and figure
 * inside -- or, not yet earned, the same in a muted grey. Its title goes beneath, the caller's.
 */
export function AchievementBadge({
  badge,
  accentColor,
  size = 60,
  testID,
}: {
  badge: Badge;
  accentColor: string;
  size?: number;
  testID?: string;
}) {
  const height = (size * 2) / Math.sqrt(3);
  const color = badge.earned ? accentColor : colors.textMuted;
  return (
    <View
      testID={testID}
      style={[styles.badge, { width: size, height }, !badge.earned && styles.locked]}
      accessibilityElementsHidden
      importantForAccessibility="no-hide-descendants"
    >
      <Svg width={size} height={height} style={StyleSheet.absoluteFill}>
        <Path
          d={hexagon(size, 1.5)}
          fill={withAlpha(color, badge.earned ? 0.16 : 0.06)}
          stroke={color}
          strokeWidth={2}
          strokeLinejoin="round"
        />
      </Svg>
      <Feather name={badge.icon} size={Math.round(size * 0.3)} color={color} />
      {badge.short ? <Text style={[styles.short, { color }]}>{badge.short}</Text> : null}
    </View>
  );
}

const styles = StyleSheet.create({
  badge: {
    alignItems: 'center',
    justifyContent: 'center',
  },
  locked: {
    opacity: 0.6,
  },
  short: {
    ...typeScale.label,
    marginTop: 1,
  },
});
