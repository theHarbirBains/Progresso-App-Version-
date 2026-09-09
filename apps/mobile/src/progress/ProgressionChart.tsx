import { useState } from 'react';
import { Pressable, View, type LayoutChangeEvent } from 'react-native';
import Svg, { Circle, Polyline } from 'react-native-svg';
import { colors } from '../design/theme';

export interface ProgressionChartPoint {
  x: number;
  y: number;
}

interface Props {
  /** Already metric/time-range-filtered points to plot -- this component has no idea what exercise or metric they represent. */
  points: ProgressionChartPoint[];
  /** The active Workout Mode accent color -- never hardcoded here. */
  color: string;
  height?: number;
  /** Controlled selection, so the caller can render matching point-detail UI alongside the chart. */
  selectedIndex: number | null;
  onSelectIndex: (index: number | null) => void;
  testID?: string;
  accessibilityLabelForPoint?: (index: number) => string;
}

/**
 * A reusable, metric-agnostic progression chart: an SVG polyline/dot chart
 * (same hand-rolled, no-charting-library approach as charts/LineChart.tsx)
 * with every point individually tappable. Interaction is handled by plain
 * `Pressable` overlays positioned on top of the SVG (not react-native-svg's
 * own touch props) so hit targets can be a full 44x44 regardless of how
 * small the drawn dot is, and so selection is reliably testable/accessible.
 *
 * Deliberately "dumb": it never fetches data or knows about exercises/
 * metrics -- callers derive `points` from whatever real data source is
 * appropriate (topSetProgressionDetailed, a future volume/reps series,
 * etc.) and read the caller's own richer point object back out via
 * `selectedIndex`, since the caller already has it.
 */
export function ProgressionChart({
  points,
  color,
  height = 160,
  selectedIndex,
  onSelectIndex,
  testID,
  accessibilityLabelForPoint,
}: Props) {
  const [width, setWidth] = useState(0);

  function handleLayout(event: LayoutChangeEvent) {
    setWidth(event.nativeEvent.layout.width);
  }

  if (points.length === 0) {
    return <View testID={testID} onLayout={handleLayout} style={{ height }} />;
  }

  const padding = 20;
  const xs = points.map((p) => p.x);
  const ys = points.map((p) => p.y);
  const minX = Math.min(...xs);
  const maxX = Math.max(...xs);
  const minY = Math.min(...ys);
  const maxY = Math.max(...ys);

  const scaleX = (x: number) =>
    maxX === minX ? width / 2 : padding + ((x - minX) / (maxX - minX)) * (width - padding * 2);
  const scaleY = (y: number) =>
    maxY === minY
      ? height / 2
      : height - padding - ((y - minY) / (maxY - minY)) * (height - padding * 2);

  const scaled = points.map((p) => ({ x: scaleX(p.x), y: scaleY(p.y) }));
  const svgPoints = scaled.map((p) => `${p.x},${p.y}`).join(' ');

  return (
    <View testID={testID} onLayout={handleLayout} style={{ height }}>
      {width > 0 ? (
        <>
          <Svg width={width} height={height} style={{ position: 'absolute' }}>
            {scaled.length > 1 ? (
              <Polyline points={svgPoints} fill="none" stroke={color} strokeWidth={2.5} />
            ) : null}
            {scaled.map((p, i) => {
              const isSelected = i === selectedIndex;
              return (
                <Circle
                  key={i}
                  cx={p.x}
                  cy={p.y}
                  r={isSelected ? 7 : 4}
                  fill={isSelected ? colors.textPrimary : color}
                  stroke={isSelected ? color : 'none'}
                  strokeWidth={isSelected ? 2.5 : 0}
                />
              );
            })}
          </Svg>
          {scaled.map((p, i) => (
            <Pressable
              key={i}
              testID={`${testID}-point-${i}`}
              accessibilityRole="button"
              accessibilityLabel={accessibilityLabelForPoint?.(i) ?? `Data point ${i + 1}`}
              accessibilityState={{ selected: i === selectedIndex }}
              onPress={() => onSelectIndex(i === selectedIndex ? null : i)}
              style={{ position: 'absolute', left: p.x - 22, top: p.y - 22, width: 44, height: 44 }}
            />
          ))}
        </>
      ) : null}
    </View>
  );
}
