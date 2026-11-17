import type { ReactNode } from 'react';
import { StyleSheet, View } from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import Svg, { Circle, Defs, Path, Pattern, Rect } from 'react-native-svg';
import { withAlpha } from '../theme/accentColor';
import type { BackgroundPatternId } from '../theme/appThemes';

// A theme's design over its plain background (theme/appThemes.ts): fine line art in the accent,
// faint -- a few percent -- so it gives the screen a character without ever competing with text,
// and fading out before the lower part of the screen, so lists, charts and the live workout's sets
// sit on the plain colour. Drawn, never a picture: an SVG tile repeated across the screen.

interface Tile {
  width: number;
  height: number;
  /** The accent's opacity in this design: lines a little more than dots and sparkles. */
  opacity: number;
  /** Turns the whole tiling, for a slanted design. */
  rotate?: number;
  draw: (color: string) => ReactNode;
}

const TILES: Record<Exclude<BackgroundPatternId, 'none'>, Tile> = {
  // A fine dot grid.
  dots: {
    width: 22,
    height: 22,
    opacity: 0.16,
    draw: (color) => <Circle cx={11} cy={11} r={1.1} fill={color} />,
  },
  // Graph paper.
  grid: {
    width: 28,
    height: 28,
    opacity: 0.09,
    draw: (color) => <Path d="M0 0H28M0 0V28" stroke={color} strokeWidth={0.8} fill="none" />,
  },
  // Slanted pinstripes.
  stripes: {
    width: 12,
    height: 12,
    opacity: 0.08,
    rotate: 45,
    draw: (color) => <Path d="M0 0V12" stroke={color} strokeWidth={1} fill="none" />,
  },
  // Rolling waves, row after row.
  waves: {
    width: 64,
    height: 18,
    opacity: 0.1,
    draw: (color) => <Path d="M0 9Q16 3 32 9T64 9" stroke={color} strokeWidth={0.9} fill="none" />,
  },
  // A map's contour lines, rings within rings.
  contours: {
    width: 120,
    height: 120,
    opacity: 0.09,
    draw: (color) => (
      <>
        {[14, 28, 42, 56].map((r) => (
          <Circle key={r} cx={60} cy={60} r={r} stroke={color} strokeWidth={0.8} fill="none" />
        ))}
      </>
    ),
  },
  // A flannel check: soft bands across and down, with a thread through each.
  plaid: {
    width: 48,
    height: 48,
    opacity: 0.07,
    draw: (color) => (
      <>
        <Rect x={0} y={10} width={48} height={8} fill={color} fillOpacity={0.6} />
        <Rect x={10} y={0} width={8} height={48} fill={color} fillOpacity={0.6} />
        <Path d="M0 34H48M34 0V48" stroke={color} strokeWidth={0.8} fill="none" />
      </>
    ),
  },
  // An ice-crystal lattice.
  diamonds: {
    width: 26,
    height: 26,
    opacity: 0.09,
    draw: (color) => (
      <Path d="M13 0L26 13L13 26L0 13Z" stroke={color} strokeWidth={0.8} fill="none" />
    ),
  },
  // Little four-pointed sparkles, scattered.
  sparkles: {
    width: 96,
    height: 96,
    opacity: 0.18,
    draw: (color) => (
      <>
        {[
          [18, 20, 4],
          [70, 34, 2.5],
          [40, 72, 3.2],
          [86, 84, 2],
        ].map(([x, y, r]) => (
          <Path
            key={`${x}-${y}`}
            d={`M${x} ${y - r}Q${x} ${y} ${x + r} ${y}Q${x} ${y} ${x} ${y + r}Q${x} ${y} ${x - r} ${y}Q${x} ${y} ${x} ${y - r}Z`}
            fill={color}
          />
        ))}
      </>
    ),
  },
};

/**
 * The design, filling whatever it's laid over (a screen's backdrop, a theme's tile in Settings),
 * faded into `background` from about a third of the way down. Nothing for 'none'. Not touchable
 * and hidden from assistive tech.
 */
export function BackgroundPattern({
  pattern,
  color,
  background,
  fade = true,
  testID,
}: {
  pattern: BackgroundPatternId;
  /** The accent the design is drawn in. */
  color: string;
  /** The plain colour it fades into. */
  background: string;
  /** Whether it fades out down the screen (a screen) or covers it evenly (a small preview). */
  fade?: boolean;
  testID?: string;
}) {
  if (pattern === 'none') return null;
  const tile = TILES[pattern];
  return (
    <View
      testID={testID}
      style={StyleSheet.absoluteFill}
      pointerEvents="none"
      accessibilityElementsHidden
      importantForAccessibility="no-hide-descendants"
    >
      <Svg width="100%" height="100%">
        <Defs>
          <Pattern
            id={`theme-${pattern}`}
            width={tile.width}
            height={tile.height}
            patternUnits="userSpaceOnUse"
            patternTransform={tile.rotate ? `rotate(${tile.rotate})` : undefined}
          >
            {tile.draw(withAlpha(color, tile.opacity))}
          </Pattern>
        </Defs>
        <Rect width="100%" height="100%" fill={`url(#theme-${pattern})`} />
      </Svg>
      {fade ? (
        <LinearGradient
          colors={[withAlpha(background, 0), withAlpha(background, 1)]}
          locations={[0.3, 0.75]}
          style={StyleSheet.absoluteFill}
        />
      ) : null}
    </View>
  );
}
