import { useId } from 'react';
import { Feather } from '@expo/vector-icons';
import { StyleSheet, View } from 'react-native';
import Svg, { Defs, LinearGradient, Path, Stop } from 'react-native-svg';
import { colors, rankColors } from '../design/theme';
import { withAlpha } from '../theme/accentColor';
import { DOUBLE_OUTLINE_FROM, RANKS, TOP_RANK } from './ranks';

/** A pointy-top hexagon `width` wide, inset `inset` from its edge. */
function hexagon(width: number, inset: number): string {
  const r = width / Math.sqrt(3) - inset;
  const cx = width / 2;
  const cy = width / Math.sqrt(3);
  const points = [-90, -30, 30, 90, 150, 210].map((deg) => {
    const a = (deg * Math.PI) / 180;
    return `${(cx + r * Math.cos(a)).toFixed(2)} ${(cy + r * Math.sin(a)).toFixed(2)}`;
  });
  return `M${points.join('L')}Z`;
}

/**
 * An achievement's badge at a rank: a hexagon outlined in the rank's colour, faintly filled with
 * it, the achievement's glyph inside. From Platinum up it wears a second, inner outline; Legacy
 * shimmers through its three colours. Before the first rank (-1) it's the same in a muted grey;
 * `dim` shows a rank still ahead in its own colour, faded. Its name goes beneath, the caller's.
 */
export function AchievementBadge({
  icon,
  rank,
  size = 60,
  dim = false,
  testID,
}: {
  icon: keyof typeof Feather.glyphMap;
  rank: number;
  size?: number;
  dim?: boolean;
  testID?: string;
}) {
  const gradientId = `legacy${useId().replace(/[^a-zA-Z0-9]/g, '')}`;
  const height = (size * 2) / Math.sqrt(3);
  const earned = rank >= 0;
  const legacy = rank >= TOP_RANK;
  const color = earned ? RANKS[Math.min(rank, TOP_RANK)]!.color : colors.textMuted;
  const paint = legacy ? `url(#${gradientId})` : color;
  return (
    <View
      testID={testID}
      style={[styles.badge, { width: size, height }, (!earned || dim) && styles.locked]}
      accessibilityElementsHidden
      importantForAccessibility="no-hide-descendants"
    >
      <Svg width={size} height={height} style={StyleSheet.absoluteFill}>
        {legacy ? (
          <Defs>
            <LinearGradient id={gradientId} x1="0" y1="0" x2="1" y2="1">
              {rankColors.legacyGradient.map((stop, index, all) => (
                <Stop key={stop} offset={index / (all.length - 1)} stopColor={stop} />
              ))}
            </LinearGradient>
          </Defs>
        ) : null}
        <Path
          d={hexagon(size, 1.5)}
          fill={legacy ? paint : withAlpha(color, earned ? 0.16 : 0.06)}
          fillOpacity={legacy ? 0.24 : 1}
          stroke={paint}
          strokeWidth={2}
          strokeLinejoin="round"
        />
        {earned && rank >= DOUBLE_OUTLINE_FROM ? (
          <Path
            d={hexagon(size, 1.5 + size * 0.1)}
            fill="none"
            stroke={paint}
            strokeOpacity={0.55}
            strokeWidth={1}
            strokeLinejoin="round"
          />
        ) : null}
      </Svg>
      <Feather name={icon} size={Math.round(size * 0.32)} color={color} />
    </View>
  );
}

const styles = StyleSheet.create({
  badge: {
    alignItems: 'center',
    justifyContent: 'center',
  },
  locked: {
    opacity: 0.45,
  },
});
