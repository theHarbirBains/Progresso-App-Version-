import { Feather } from '@expo/vector-icons';
import { useState } from 'react';
import { Pressable, ScrollView, StyleSheet, View } from 'react-native';
import { SegmentedControl } from '../../design/SegmentedControl';
import { Text } from '../../design/Text';
import { colors, fonts, radii, spacing, typeScale, widgetGap } from '../../design/theme';
import { withAlpha } from '../../theme/accentColor';
import { Columns, Ring, StackedBar } from './healthCharts';
import { BlockTitle, InsightRow, MetricTile, SampleNote, Tile } from './healthParts';
import type { HealthPage } from './healthPreview';
import {
  ACTIVITY,
  insightsFor,
  METRICS,
  metricsFor,
  READINESS,
  SCENARIOS,
  SLEEP,
  TRAINING,
  type HealthScenario,
  type MetricKey,
} from './sampleHealthData';

/** "Today", "Yesterday", or "Tue, Nov 25". */
function dayLabel(offset: number, now = new Date()): string {
  if (offset === 0) return 'Today';
  if (offset === 1) return 'Yesterday';
  const day = new Date(now.getFullYear(), now.getMonth(), now.getDate() - offset);
  return day.toLocaleDateString(undefined, { weekday: 'short', month: 'short', day: 'numeric' });
}

/** Sleep's stages, in shades of the accent: deep fullest, awake the faintest grey. */
export function stageColors(accent: string): Record<string, string> {
  return {
    deep: accent,
    light: withAlpha(accent, 0.55),
    rem: withAlpha(accent, 0.3),
    awake: colors.textMuted,
  };
}

/**
 * Health's overview (Phase 1 prototype, sample data): what matters today first -- readiness (an
 * example), last night's sleep and today's movement side by side, the heart in three figures,
 * training against recovery, two insights and the devices behind it all -- each a tap from its
 * own page. A preview bar on top switches between the four device scenarios.
 */
export function HealthOverview({
  accent,
  onOpen,
}: {
  accent: string;
  onOpen: (page: HealthPage, scenario: HealthScenario, metric?: MetricKey) => void;
}) {
  const [scenario, setScenario] = useState<HealthScenario>('both');
  const [dayOffset, setDayOffset] = useState(0);
  const available = new Set(metricsFor(scenario));
  const wearable = scenario !== 'none';
  const open = (page: HealthPage, metric?: MetricKey) => onOpen(page, scenario, metric);
  const stages = stageColors(accent);
  const heartKeys: MetricKey[] = [
    'restingHr',
    'hrv',
    scenario === 'oura' ? 'respiratory' : 'vo2max',
  ];
  const insights = insightsFor(scenario).slice(0, 2);
  // A little life in the sample as days change.
  const readiness = Math.max(40, READINESS.score - dayOffset * 4);

  return (
    <ScrollView
      testID="health-overview"
      keyboardDismissMode="on-drag"
      style={styles.fill}
      contentContainerStyle={styles.content}
      showsVerticalScrollIndicator={false}
    >
      {/* The prototype's own controls: sample data, and which devices it pretends are connected. */}
      <View style={styles.previewBar}>
        <SampleNote testID="health-sample-note" />
        <SegmentedControl
          testID="health-scenario"
          options={SCENARIOS}
          value={scenario}
          onChange={setScenario}
          accentColor={accent}
          stretch
        />
      </View>

      {/* The day. */}
      <View style={styles.dateRow}>
        <Pressable
          testID="health-day-back"
          onPress={() => setDayOffset((d) => d + 1)}
          hitSlop={10}
          accessibilityRole="button"
          accessibilityLabel="Previous day"
          style={styles.dateArrow}
        >
          <Feather name="chevron-left" size={18} color={colors.textSecondary} />
        </Pressable>
        <Text testID="health-day" style={styles.dateText}>
          {dayLabel(dayOffset)}
        </Text>
        <Pressable
          testID="health-day-forward"
          onPress={() => setDayOffset((d) => Math.max(0, d - 1))}
          disabled={dayOffset === 0}
          hitSlop={10}
          accessibilityRole="button"
          accessibilityLabel="Next day"
          style={[styles.dateArrow, dayOffset === 0 && styles.faded]}
        >
          <Feather name="chevron-right" size={18} color={colors.textSecondary} />
        </Pressable>
      </View>

      {/* Readiness -- an example -- or, with no wearable, what Health is without one. */}
      {wearable ? (
        <Tile
          testID="health-readiness"
          onPress={() => open('recovery')}
          style={styles.hero}
          accessibilityLabel={`Readiness ${readiness}, an example. ${READINESS.word}.`}
        >
          <Ring size={124} stroke={11} progress={readiness / 100} color={accent}>
            <Text style={styles.heroScore}>{readiness}</Text>
            <Text style={styles.heroScoreLabel}>EXAMPLE</Text>
          </Ring>
          <View style={styles.heroWords}>
            <Text style={styles.kicker}>READINESS</Text>
            <Text style={styles.heroTitle}>{READINESS.word}</Text>
            {(['hrv', 'restingHr', 'sleep'] as MetricKey[])
              .filter((key) => available.has(key))
              .map((key) => (
                <View key={key} style={styles.contributor}>
                  <Text style={styles.contributorName}>{METRICS[key].short}</Text>
                  <Text style={styles.contributorValue}>
                    {METRICS[key].value}
                    {key === 'sleep' ? '' : ` ${METRICS[key].unit}`}
                  </Text>
                </View>
              ))}
          </View>
        </Tile>
      ) : (
        <Tile testID="health-no-wearable" style={styles.noWearable}>
          <View style={[styles.noWearableIcon, { backgroundColor: withAlpha(accent, 0.12) }]}>
            <Feather name="watch" size={22} color={accent} />
          </View>
          <Text style={styles.heroTitle}>Health works without a wearable</Text>
          <Text style={styles.secondary}>
            Your workouts and nutrition are already here. Log sleep yourself, or connect a device
            for heart and recovery data.
          </Text>
          <View style={styles.noWearableActions}>
            <Pressable onPress={() => open('devices')} accessibilityRole="button" hitSlop={6}>
              <Text style={[styles.link, { color: accent }]}>Connect a device</Text>
            </Pressable>
            <Pressable onPress={() => open('sleep')} accessibilityRole="button" hitSlop={6}>
              <Text style={[styles.link, { color: accent }]}>Log sleep</Text>
            </Pressable>
          </View>
        </Tile>
      )}

      {/* Sleep and movement, side by side. */}
      <View style={styles.pair}>
        <Tile
          testID="health-sleep"
          onPress={() => open('sleep')}
          style={styles.half}
          accessibilityLabel={wearable ? `Sleep ${SLEEP.asleep}` : 'Sleep, log last night'}
        >
          <View style={styles.tileHead}>
            <Feather name="moon" size={14} color={accent} />
            <Text style={styles.tileName}>Sleep</Text>
          </View>
          {wearable ? (
            <>
              <Text style={styles.tileValue}>{SLEEP.asleep}</Text>
              <StackedBar
                height={8}
                parts={SLEEP.stages
                  .slice()
                  .reverse()
                  .map((stage) => ({
                    key: stage.key,
                    value: stage.minutes,
                    color: stages[stage.key],
                  }))}
              />
              <Text style={styles.caption}>In bed {SLEEP.inBed}</Text>
            </>
          ) : (
            <>
              <Text style={styles.tileValue}>—</Text>
              <Text style={styles.caption}>Tap to log last night</Text>
            </>
          )}
        </Tile>
        <Tile
          testID="health-activity"
          onPress={() => open('activity')}
          style={styles.half}
          accessibilityLabel={
            wearable ? `Activity, ${ACTIVITY.steps} steps` : 'This week’s training'
          }
        >
          <View style={styles.tileHead}>
            <Feather name={wearable ? 'trending-up' : 'bar-chart-2'} size={14} color={accent} />
            <Text style={styles.tileName}>{wearable ? 'Activity' : 'Training'}</Text>
          </View>
          {wearable ? (
            <>
              <Text style={styles.tileValue}>
                {ACTIVITY.steps}
                <Text style={styles.tileUnit}> steps</Text>
              </Text>
              <Columns values={ACTIVITY.hourly} height={22} color={accent} gap={2} />
              <Text style={styles.caption}>{ACTIVITY.activeCalories} active cal</Text>
            </>
          ) : (
            <>
              <Text style={styles.tileValue}>
                {TRAINING.thisWeek.workouts}
                <Text style={styles.tileUnit}> workouts</Text>
              </Text>
              <Text style={styles.caption}>
                {TRAINING.thisWeek.sets} sets this week · from Progresso
              </Text>
            </>
          )}
        </Tile>
      </View>

      {/* The heart, in three figures. */}
      {wearable ? (
        <View style={styles.block}>
          <BlockTitle title="Heart" action="All" onAction={() => open('heart')} accent={accent} />
          <View style={styles.pair}>
            {heartKeys.map((key) => (
              <MetricTile
                key={key}
                testID={`health-heart-${key}`}
                metric={METRICS[key]}
                available={available.has(key)}
                accent={accent}
                onPress={() => open('metric', key)}
              />
            ))}
          </View>
        </View>
      ) : null}

      {/* Training against recovery -- Progresso's own data, always here. */}
      <Tile testID="health-training" onPress={() => open('training')} style={styles.training}>
        <View style={styles.trainingHead}>
          <View style={styles.trainingWords}>
            <Text style={styles.kicker}>TRAINING & RECOVERY</Text>
            <Text style={styles.trainingTitle}>
              Volume up 14% this week{wearable ? ', sleep steady' : ''}
            </Text>
          </View>
          <Feather name="chevron-right" size={16} color={colors.textMuted} />
        </View>
        <Columns
          values={TRAINING.weeks.map((week) => week.volume)}
          labels={TRAINING.weeks.map((week) => week.label)}
          highlight={TRAINING.weeks.length - 1}
          height={46}
          color={accent}
          gap={10}
        />
      </Tile>

      {/* Two observations. */}
      <View style={styles.block}>
        <BlockTitle
          title="Insights"
          action="See All"
          onAction={() => open('insights')}
          accent={accent}
        />
        <View>
          {insights.map((insight, i) => (
            <InsightRow key={insight.id} insight={insight} accent={accent} divider={i > 0} />
          ))}
        </View>
      </View>

      {/* What it's all from. */}
      <Pressable
        testID="health-devices"
        onPress={() => open('devices')}
        accessibilityRole="button"
        style={({ pressed }) => [styles.devices, pressed && styles.faded]}
      >
        <Feather name="link" size={14} color={colors.textMuted} />
        <Text style={styles.devicesText} numberOfLines={1}>
          {scenario === 'none'
            ? 'No devices connected'
            : scenario === 'both'
              ? 'Apple Health and Oura · synced 5 min ago'
              : `${scenario === 'apple' ? 'Apple Health' : 'Oura'} · synced 5 min ago`}
        </Text>
        <Text style={[styles.devicesManage, { color: accent }]}>Manage</Text>
      </Pressable>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  fill: {
    flex: 1,
  },
  content: {
    gap: spacing.lg,
    paddingBottom: spacing.xl,
  },
  previewBar: {
    gap: spacing.sm,
  },
  dateRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: spacing.lg,
  },
  dateArrow: {
    width: 32,
    height: 32,
    borderRadius: 16,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: colors.surfaceLift,
  },
  dateText: {
    ...typeScale.label,
    color: colors.textPrimary,
    minWidth: 110,
    textAlign: 'center',
  },
  faded: {
    opacity: 0.4,
  },
  hero: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.lg,
    padding: spacing.lg,
  },
  heroScore: {
    fontFamily: fonts.monoBold,
    fontSize: 34,
    color: colors.textPrimary,
  },
  heroScoreLabel: {
    ...typeScale.caption,
    color: colors.textMuted,
    letterSpacing: 1.2,
  },
  heroWords: {
    flex: 1,
    gap: 6,
  },
  kicker: {
    ...typeScale.caption,
    fontFamily: fonts.semibold,
    color: colors.textMuted,
    letterSpacing: 1,
  },
  heroTitle: {
    ...typeScale.cardTitle,
    color: colors.textPrimary,
  },
  contributor: {
    flexDirection: 'row',
    justifyContent: 'space-between',
  },
  contributorName: {
    ...typeScale.secondary,
    color: colors.textSecondary,
  },
  contributorValue: {
    ...typeScale.secondary,
    fontFamily: fonts.semibold,
    color: colors.textPrimary,
  },
  noWearable: {
    gap: spacing.sm,
    padding: spacing.lg,
  },
  noWearableIcon: {
    width: 44,
    height: 44,
    borderRadius: 22,
    alignItems: 'center',
    justifyContent: 'center',
  },
  noWearableActions: {
    flexDirection: 'row',
    gap: spacing.xl,
    marginTop: spacing.xs,
  },
  link: {
    ...typeScale.label,
  },
  secondary: {
    ...typeScale.secondary,
    color: colors.textSecondary,
  },
  pair: {
    flexDirection: 'row',
    gap: widgetGap,
  },
  half: {
    flex: 1,
    gap: spacing.sm,
  },
  tileHead: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
  tileName: {
    ...typeScale.caption,
    fontFamily: fonts.semibold,
    color: colors.textSecondary,
  },
  tileValue: {
    fontFamily: fonts.monoBold,
    fontSize: 22,
    color: colors.textPrimary,
  },
  tileUnit: {
    ...typeScale.caption,
    fontFamily: fonts.body,
    color: colors.textMuted,
  },
  caption: {
    ...typeScale.caption,
    color: colors.textMuted,
  },
  block: {
    gap: spacing.sm,
  },
  training: {
    gap: spacing.md,
  },
  trainingHead: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
  },
  trainingWords: {
    flex: 1,
    gap: 2,
  },
  trainingTitle: {
    ...typeScale.callout,
    fontFamily: fonts.semibold,
    color: colors.textPrimary,
  },
  devices: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
    paddingVertical: spacing.sm,
    paddingHorizontal: spacing.md,
    borderRadius: radii.md,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: colors.glassBorder,
  },
  devicesText: {
    ...typeScale.secondary,
    color: colors.textSecondary,
    flex: 1,
  },
  devicesManage: {
    ...typeScale.label,
  },
});
