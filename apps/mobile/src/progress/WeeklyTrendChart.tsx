import { useState } from 'react';
import { StyleSheet, View, type LayoutChangeEvent } from 'react-native';
import { Text } from '../design/Text';
import { LineChart } from '../charts/LineChart';
import { SectionHeader } from '../design/SectionHeader';
import { colors, spacing, typeScale } from '../design/theme';
import type { WeeklyPoint } from './trainingOverTime';

interface Props {
  label: string;
  points: WeeklyPoint[];
  accentColor: string;
  /** Formats the summed total across every point for the caption above the chart, e.g. "24 workouts" or "12,450 lb". */
  formatTotal: (total: number) => string;
  emptyMessage: string;
  testID?: string;
}

const CHART_HEIGHT = 90;

/**
 * A compact, non-interactive weekly trend line -- Profile Stats' summary
 * version of the same charts/LineChart.tsx primitive Strength Journey uses
 * (ProgressionChart), just without per-point tap detail: this is an
 * overview ("how have I been training?"), not the Progress screen's own
 * exercise-level deep-dive, so it doesn't duplicate that interaction.
 * Self-sizing via onLayout, same auto-width approach ProgressionChart uses.
 */
export function WeeklyTrendChart({
  label,
  points,
  accentColor,
  formatTotal,
  emptyMessage,
  testID,
}: Props) {
  const [width, setWidth] = useState(0);

  function handleLayout(event: LayoutChangeEvent) {
    setWidth(event.nativeEvent.layout.width);
  }

  const total = points.reduce((sum, p) => sum + p.value, 0);
  const hasData = points.some((p) => p.value > 0);

  return (
    <View testID={testID} style={styles.wrap}>
      <SectionHeader label={label} />
      {hasData ? (
        <>
          <Text testID={testID ? `${testID}-total` : undefined} style={styles.total}>
            {formatTotal(total)}
          </Text>
          <View
            testID={testID ? `${testID}-measure` : undefined}
            onLayout={handleLayout}
            style={{ height: CHART_HEIGHT }}
          >
            {width > 0 ? (
              <LineChart
                testID={testID ? `${testID}-chart` : undefined}
                points={points.map((p, i) => ({ x: i, y: p.value }))}
                width={width}
                height={CHART_HEIGHT}
                color={accentColor}
              />
            ) : null}
          </View>
        </>
      ) : (
        <Text testID={testID ? `${testID}-empty` : undefined} style={styles.empty}>
          {emptyMessage}
        </Text>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: {
    marginBottom: spacing.xl,
  },
  total: {
    ...typeScale.statMedium,
    color: colors.textPrimary,
    marginBottom: spacing.sm,
  },
  empty: {
    ...typeScale.secondary,
    color: colors.textMuted,
  },
});
