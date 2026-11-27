import { Feather } from '@expo/vector-icons';
import type { ComponentProps, ReactNode } from 'react';
import { Pressable, StyleSheet, View } from 'react-native';
import { Text } from '../../design/Text';
import { colors, fonts, minTouchTarget, radii, spacing, typeScale } from '../../design/theme';
import { withAlpha } from '../../theme/accentColor';
import {
  SOURCE_NAMES,
  type ConnectionState,
  type HealthInsight,
  type HealthMetric,
  type HealthSource,
} from './sampleHealthData';

// The Health prototype's small shared pieces (Phase 1): the sample-data note, a trend, a source,
// a connection state, a metric's tile and row, an insight, and a block's heading.

type FeatherName = ComponentProps<typeof Feather>['name'];

/** "Sample data" -- on every page of the prototype, so nothing reads as real. */
export function SampleNote({ testID }: { testID?: string }) {
  return (
    <View testID={testID} style={styles.sample}>
      <Feather name="eye" size={12} color={colors.textMuted} />
      <Text style={styles.sampleText}>Preview · sample data</Text>
    </View>
  );
}

/** A metric's change against their usual, its arrow coloured only where better has a direction. */
export function TrendChip({ metric, accent }: { metric: HealthMetric; accent: string }) {
  const icon: FeatherName =
    metric.direction === 'up'
      ? 'arrow-up-right'
      : metric.direction === 'down'
        ? 'arrow-down-right'
        : 'minus';
  const good =
    (metric.better === 'higher' && metric.direction === 'up') ||
    (metric.better === 'lower' && metric.direction === 'down');
  const color = good ? accent : colors.textSecondary;
  return (
    <View style={styles.trend}>
      <Feather name={icon} size={12} color={color} />
      <Text style={[styles.trendText, { color }]}>{metric.change}</Text>
    </View>
  );
}

/** Where a figure came from: a dot and the source's name. */
export function SourceTag({ source }: { source: HealthSource | null }) {
  if (!source) return null;
  return (
    <View style={styles.source}>
      <View style={styles.sourceDot} />
      <Text style={styles.sourceText}>{SOURCE_NAMES[source]}</Text>
    </View>
  );
}

const STATE_LOOK: Record<
  ConnectionState,
  { label: string; icon: FeatherName; tone: 'accent' | 'muted' | 'warn' }
> = {
  connected: { label: 'Connected', icon: 'check-circle', tone: 'accent' },
  syncing: { label: 'Syncing…', icon: 'refresh-cw', tone: 'accent' },
  permission: { label: 'Permission needed', icon: 'lock', tone: 'warn' },
  issue: { label: 'Connection issue', icon: 'alert-triangle', tone: 'warn' },
  notConnected: { label: 'Not connected', icon: 'circle', tone: 'muted' },
};

/** A connection's state, as a small pill. */
export function StatusPill({ state, accent }: { state: ConnectionState; accent: string }) {
  const look = STATE_LOOK[state];
  const color =
    look.tone === 'accent' ? accent : look.tone === 'warn' ? colors.textPrimary : colors.textMuted;
  const fill =
    look.tone === 'accent'
      ? withAlpha(accent, 0.14)
      : look.tone === 'warn'
        ? withAlpha(colors.textPrimary, 0.08)
        : colors.surfaceLift;
  return (
    <View testID={`status-${state}`} style={[styles.pill, { backgroundColor: fill }]}>
      <Feather name={look.icon} size={12} color={color} />
      <Text style={[styles.pillText, { color }]}>{look.label}</Text>
    </View>
  );
}

/** A block's heading inside a page: a title, and a link on the right. */
export function BlockTitle({
  title,
  action,
  onAction,
  accent,
}: {
  title: string;
  action?: string;
  onAction?: () => void;
  accent: string;
}) {
  return (
    <View style={styles.blockTitle}>
      <Text style={styles.blockTitleText} accessibilityRole="header">
        {title}
      </Text>
      {action && onAction ? (
        <Pressable onPress={onAction} hitSlop={8} accessibilityRole="button">
          <Text style={[styles.blockAction, { color: accent }]}>{action}</Text>
        </Pressable>
      ) : null}
    </View>
  );
}

/** A raised, tappable block inside a card or page -- never a card inside a card. */
export function Tile({
  children,
  onPress,
  testID,
  style,
  accessibilityLabel,
}: {
  children: ReactNode;
  onPress?: () => void;
  testID?: string;
  style?: object;
  accessibilityLabel?: string;
}) {
  return (
    <Pressable
      testID={testID}
      onPress={onPress}
      disabled={!onPress}
      accessibilityRole={onPress ? 'button' : undefined}
      accessibilityLabel={accessibilityLabel}
      style={({ pressed }) => [styles.tile, pressed && styles.pressed, style]}
    >
      {children}
    </Pressable>
  );
}

/** A metric in a small tile: its name, value and unit, its change -- or not available. */
export function MetricTile({
  metric,
  available,
  accent,
  onPress,
  testID,
}: {
  metric: HealthMetric;
  available: boolean;
  accent: string;
  onPress?: () => void;
  testID?: string;
}) {
  return (
    <Tile
      testID={testID}
      onPress={available ? onPress : undefined}
      style={styles.metricTile}
      accessibilityLabel={
        available
          ? `${metric.name}, ${metric.value} ${metric.unit}, ${metric.change}`
          : `${metric.name}, not available`
      }
    >
      <View style={styles.metricTileTop}>
        <Feather name={metric.icon} size={14} color={available ? accent : colors.textMuted} />
        <Text style={styles.metricTileName} numberOfLines={1}>
          {metric.short}
        </Text>
      </View>
      {available ? (
        <>
          <Text style={styles.metricTileValue} numberOfLines={1}>
            {metric.value}
            <Text style={styles.metricTileUnit}> {metric.unit}</Text>
          </Text>
          <TrendChip metric={metric} accent={accent} />
        </>
      ) : (
        <Text style={styles.unavailable}>Not available</Text>
      )}
    </Tile>
  );
}

/** A metric as a row: its icon, name and source, its value and change, and a chevron. */
export function MetricRow({
  metric,
  source,
  available,
  accent,
  onPress,
  divider,
  testID,
}: {
  metric: HealthMetric;
  source: HealthSource | null;
  available: boolean;
  accent: string;
  onPress?: () => void;
  divider?: boolean;
  testID?: string;
}) {
  return (
    <Pressable
      testID={testID}
      onPress={available ? onPress : undefined}
      disabled={!available}
      accessibilityRole="button"
      style={({ pressed }) => [styles.row, divider && styles.rowDivider, pressed && styles.pressed]}
    >
      <View
        style={[styles.rowIcon, { backgroundColor: withAlpha(accent, available ? 0.12 : 0.05) }]}
      >
        <Feather name={metric.icon} size={16} color={available ? accent : colors.textMuted} />
      </View>
      <View style={styles.rowWords}>
        <Text style={styles.rowName}>{metric.name}</Text>
        {available ? (
          <SourceTag source={source} />
        ) : (
          <Text style={styles.unavailable}>Not available from your devices</Text>
        )}
      </View>
      {available ? (
        <View style={styles.rowFigures}>
          <Text style={styles.rowValue}>
            {metric.value}
            <Text style={styles.metricTileUnit}> {metric.unit}</Text>
          </Text>
          <TrendChip metric={metric} accent={accent} />
        </View>
      ) : null}
      {available ? <Feather name="chevron-right" size={16} color={colors.textMuted} /> : null}
    </Pressable>
  );
}

const INSIGHT_ICONS: Record<HealthInsight['icon'], FeatherName> = {
  moon: 'moon',
  heart: 'heart',
  'trending-up': 'trending-up',
  activity: 'activity',
  calendar: 'calendar',
};

/** An observation: its icon, a headline and one line -- and what it's drawn from. */
export function InsightRow({
  insight,
  accent,
  divider,
  testID,
}: {
  insight: HealthInsight;
  accent: string;
  divider?: boolean;
  testID?: string;
}) {
  const tint = insight.tone === 'watch' ? colors.textSecondary : accent;
  return (
    <View testID={testID} style={[styles.insight, divider && styles.rowDivider]}>
      <View style={[styles.rowIcon, { backgroundColor: withAlpha(tint, 0.12) }]}>
        <Feather name={INSIGHT_ICONS[insight.icon]} size={16} color={tint} />
      </View>
      <View style={styles.rowWords}>
        <Text style={styles.insightTitle}>{insight.title}</Text>
        <Text style={styles.insightDetail}>{insight.detail}</Text>
        <Text style={styles.insightBasis}>{insight.basis}</Text>
      </View>
    </View>
  );
}

export const healthStyles = StyleSheet.create({
  bigValue: {
    fontFamily: fonts.monoBold,
    fontSize: 34,
    color: colors.textPrimary,
  },
  bigUnit: {
    ...typeScale.body,
    color: colors.textSecondary,
  },
  caption: {
    ...typeScale.caption,
    color: colors.textMuted,
  },
  secondary: {
    ...typeScale.secondary,
    color: colors.textSecondary,
  },
  label: {
    ...typeScale.label,
    color: colors.textSecondaryBright,
  },
  gap: {
    gap: spacing.md,
  },
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.md,
  },
});

const styles = StyleSheet.create({
  sample: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    alignSelf: 'flex-start',
    paddingHorizontal: spacing.sm,
    paddingVertical: 3,
    borderRadius: radii.pill,
    backgroundColor: colors.surfaceLift,
  },
  sampleText: {
    ...typeScale.caption,
    color: colors.textMuted,
  },
  trend: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 2,
  },
  trendText: {
    ...typeScale.caption,
  },
  source: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 5,
  },
  sourceDot: {
    width: 5,
    height: 5,
    borderRadius: 2.5,
    backgroundColor: colors.textMuted,
  },
  sourceText: {
    ...typeScale.caption,
    color: colors.textMuted,
  },
  pill: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 5,
    paddingHorizontal: spacing.sm,
    paddingVertical: 4,
    borderRadius: radii.pill,
  },
  pillText: {
    ...typeScale.caption,
  },
  blockTitle: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  blockTitleText: {
    ...typeScale.cardTitle,
    color: colors.textPrimary,
  },
  blockAction: {
    ...typeScale.label,
  },
  tile: {
    padding: spacing.md,
    borderRadius: radii.md,
    backgroundColor: colors.surfaceLift,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: colors.glassBorder,
  },
  pressed: {
    opacity: 0.75,
  },
  metricTile: {
    flex: 1,
    gap: 4,
    minHeight: 92,
  },
  metricTileTop: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
  metricTileName: {
    ...typeScale.caption,
    color: colors.textSecondary,
    flex: 1,
  },
  metricTileValue: {
    fontFamily: fonts.monoBold,
    fontSize: 20,
    color: colors.textPrimary,
  },
  metricTileUnit: {
    ...typeScale.caption,
    fontFamily: fonts.body,
    color: colors.textMuted,
  },
  unavailable: {
    ...typeScale.caption,
    color: colors.textMuted,
  },
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.md,
    minHeight: minTouchTarget + 12,
    paddingVertical: spacing.sm,
  },
  rowDivider: {
    borderTopWidth: StyleSheet.hairlineWidth,
    borderTopColor: colors.divider,
  },
  rowIcon: {
    width: 34,
    height: 34,
    borderRadius: 17,
    alignItems: 'center',
    justifyContent: 'center',
  },
  rowWords: {
    flex: 1,
    minWidth: 0,
    gap: 2,
  },
  rowName: {
    ...typeScale.callout,
    fontFamily: fonts.semibold,
    color: colors.textPrimary,
  },
  rowFigures: {
    alignItems: 'flex-end',
    gap: 2,
  },
  rowValue: {
    fontFamily: fonts.monoBold,
    fontSize: 16,
    color: colors.textPrimary,
  },
  insight: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: spacing.md,
    paddingVertical: spacing.md,
  },
  insightTitle: {
    ...typeScale.callout,
    fontFamily: fonts.semibold,
    color: colors.textPrimary,
  },
  insightDetail: {
    ...typeScale.secondary,
    color: colors.textSecondaryBright,
  },
  insightBasis: {
    ...typeScale.caption,
    color: colors.textMuted,
    marginTop: 2,
  },
});
