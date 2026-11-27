import type { ReactNode } from 'react';
import { StyleSheet, View } from 'react-native';
import Svg, { Circle, Defs, LinearGradient, Stop } from 'react-native-svg';
import { Text } from '../../design/Text';
import { colors, radii, spacing, typeScale } from '../../design/theme';
import { withAlpha } from '../../theme/accentColor';

// The Health prototype's charts (Phase 1): a ring, columns, a stacked bar and a sleep-window
// strip -- bars and rings only, as Progress has no line graphs. Drawn in the theme's accent, a
// softer accent and the warm greys; nothing decorative.

/** A ring filled to `progress` (0-1) in the accent, a soft gradient along its arc, with its middle free. */
export function Ring({
  size,
  stroke,
  progress,
  color,
  children,
  testID,
}: {
  size: number;
  stroke: number;
  progress: number;
  color: string;
  children?: ReactNode;
  testID?: string;
}) {
  const r = (size - stroke) / 2;
  const circumference = 2 * Math.PI * r;
  const filled = Math.max(0, Math.min(1, progress)) * circumference;
  const id = `ring${Math.round(size)}${Math.round(progress * 100)}`;
  return (
    <View testID={testID} style={{ width: size, height: size }}>
      <Svg width={size} height={size}>
        <Defs>
          <LinearGradient id={id} x1="0" y1="0" x2="1" y2="1">
            <Stop offset="0" stopColor={color} stopOpacity={1} />
            <Stop offset="1" stopColor={color} stopOpacity={0.55} />
          </LinearGradient>
        </Defs>
        <Circle
          cx={size / 2}
          cy={size / 2}
          r={r}
          stroke={withAlpha(color, 0.14)}
          strokeWidth={stroke}
          fill="none"
        />
        <Circle
          cx={size / 2}
          cy={size / 2}
          r={r}
          stroke={`url(#${id})`}
          strokeWidth={stroke}
          strokeLinecap="round"
          strokeDasharray={`${filled} ${circumference}`}
          fill="none"
          transform={`rotate(-90 ${size / 2} ${size / 2})`}
        />
      </Svg>
      <View style={[StyleSheet.absoluteFill, styles.ringMiddle]}>{children}</View>
    </View>
  );
}

/**
 * Columns, one per value, the highlighted one in the accent and the rest softer; a faint band
 * for the person's usual range where given. Labels under, if any.
 */
export function Columns({
  values,
  labels,
  height,
  color,
  highlight,
  band,
  gap = 4,
  testID,
}: {
  values: number[];
  labels?: string[];
  height: number;
  color: string;
  /** Which column to fill fully (usually the latest); none for all soft. */
  highlight?: number;
  /** Their usual range, in the values' own terms. */
  band?: [number, number];
  gap?: number;
  testID?: string;
}) {
  const top = Math.max(...values, band ? band[1] : 0) * 1.08;
  const bottom = band ? Math.min(...values, band[0]) * 0.85 : 0;
  const span = Math.max(top - bottom, 1e-6);
  const at = (value: number) => ((value - bottom) / span) * height;
  return (
    <View testID={testID}>
      <View style={[styles.columns, { height, gap }]}>
        {band ? (
          <View
            pointerEvents="none"
            style={[
              styles.band,
              {
                bottom: at(band[0]),
                height: Math.max(2, at(band[1]) - at(band[0])),
                backgroundColor: withAlpha(color, 0.08),
                borderColor: withAlpha(color, 0.25),
              },
            ]}
          />
        ) : null}
        {values.map((value, i) => (
          <View key={i} style={styles.columnSlot}>
            <View
              style={[
                styles.column,
                {
                  height: Math.max(3, at(value)),
                  backgroundColor:
                    highlight === undefined || i === highlight ? color : withAlpha(color, 0.38),
                },
              ]}
            />
          </View>
        ))}
      </View>
      {labels ? (
        <View style={[styles.columnLabels, { gap }]}>
          {labels.map((label, i) => (
            <Text
              key={i}
              style={[styles.columnLabel, i === highlight && { color: colors.textPrimary }]}
              numberOfLines={1}
            >
              {label}
            </Text>
          ))}
        </View>
      ) : null}
    </View>
  );
}

/** A bar split into parts by share, each in its own shade -- sleep's stages. */
export function StackedBar({
  parts,
  height = 14,
  testID,
}: {
  parts: { key: string; value: number; color: string }[];
  height?: number;
  testID?: string;
}) {
  const total = parts.reduce((sum, part) => sum + part.value, 0) || 1;
  return (
    <View testID={testID} style={[styles.stacked, { height, borderRadius: height / 2 }]}>
      {parts.map((part) => (
        <View key={part.key} style={{ flex: part.value / total, backgroundColor: part.color }} />
      ))}
    </View>
  );
}

/**
 * Each night as a bar from bedtime to waking on one clock -- 6 PM on the left, noon on the right --
 * so a steady routine lines up at a glance.
 */
export function SleepWindows({
  nights,
  color,
  testID,
}: {
  nights: { day: string; bed: number; wake: number }[];
  color: string;
  testID?: string;
}) {
  const hours = 18;
  return (
    <View testID={testID} style={styles.windows}>
      {nights.map((night, i) => (
        <View key={`${night.day}${i}`} style={styles.windowRow}>
          <Text style={styles.windowDay}>{night.day}</Text>
          <View style={styles.windowTrack}>
            <View
              style={[
                styles.windowBar,
                {
                  left: `${(night.bed / hours) * 100}%`,
                  width: `${((night.wake - night.bed) / hours) * 100}%`,
                  backgroundColor: i === nights.length - 1 ? color : withAlpha(color, 0.45),
                },
              ]}
            />
          </View>
        </View>
      ))}
      <View style={styles.windowAxis}>
        {['6 PM', '10 PM', '2 AM', '6 AM', '10 AM'].map((label) => (
          <Text key={label} style={styles.windowAxisLabel}>
            {label}
          </Text>
        ))}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  ringMiddle: {
    alignItems: 'center',
    justifyContent: 'center',
  },
  columns: {
    flexDirection: 'row',
    alignItems: 'flex-end',
  },
  columnSlot: {
    flex: 1,
    justifyContent: 'flex-end',
    height: '100%',
  },
  column: {
    borderRadius: 4,
  },
  band: {
    position: 'absolute',
    left: 0,
    right: 0,
    borderTopWidth: StyleSheet.hairlineWidth,
    borderBottomWidth: StyleSheet.hairlineWidth,
  },
  columnLabels: {
    flexDirection: 'row',
    marginTop: spacing.xs,
  },
  columnLabel: {
    ...typeScale.caption,
    color: colors.textMuted,
    flex: 1,
    textAlign: 'center',
  },
  stacked: {
    flexDirection: 'row',
    overflow: 'hidden',
    gap: 2,
  },
  windows: {
    gap: spacing.sm,
  },
  windowRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
  },
  windowDay: {
    ...typeScale.caption,
    color: colors.textMuted,
    width: 28,
  },
  windowTrack: {
    flex: 1,
    height: 10,
    borderRadius: radii.pill,
    backgroundColor: colors.surfaceLift,
  },
  windowBar: {
    position: 'absolute',
    top: 0,
    bottom: 0,
    borderRadius: radii.pill,
  },
  windowAxis: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginLeft: 28 + spacing.sm,
  },
  windowAxisLabel: {
    ...typeScale.caption,
    color: colors.textMuted,
  },
});
