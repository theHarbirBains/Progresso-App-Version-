import { View } from 'react-native';
import Svg, { Circle, Polyline } from 'react-native-svg';

export interface LineChartPoint {
  x: number;
  y: number;
}

interface Props {
  points: LineChartPoint[];
  width: number;
  height: number;
  color?: string;
  testID?: string;
}

/**
 * Minimal hand-rolled line chart: a polyline through the given points plus
 * a dot on each one, scaled to fill the given box. Deliberately not a
 * general-purpose charting component -- just enough rendering for the
 * Phase 5 progress screens, per the approved react-native-svg-only
 * (no charting library) decision.
 */
export function LineChart({ points, width, height, color = '#FFFFFF', testID }: Props) {
  if (points.length === 0) {
    return <View testID={testID} style={{ width, height }} />;
  }

  const padding = 12;
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
    <View testID={testID}>
      <Svg width={width} height={height}>
        {scaled.length > 1 ? (
          <Polyline points={svgPoints} fill="none" stroke={color} strokeWidth={2} />
        ) : null}
        {scaled.map((p, i) => (
          <Circle key={i} cx={p.x} cy={p.y} r={3} fill={color} />
        ))}
      </Svg>
    </View>
  );
}
