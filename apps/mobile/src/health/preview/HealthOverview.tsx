import { Feather, MaterialCommunityIcons } from '@expo/vector-icons';
import { useState } from 'react';
import { Pressable, ScrollView, StyleSheet, View } from 'react-native';
import { PrimaryButton } from '../../design/Button';
import { Text } from '../../design/Text';
import { colors, fonts, radii, spacing, typeScale, widgetGap } from '../../design/theme';
import { withAlpha } from '../../theme/accentColor';
import { Columns, Ring, StackedBar } from './healthCharts';
import { BlockTitle, InsightRow, MetricTile, SampleNote, Tile } from './healthParts';
import { setPreviewSetup, usePreviewSetup, type HealthPage } from './healthPreview';
import { useRealSteps } from './realSteps';
import { IPhoneHealth } from '../iphone/IPhoneHealth';
import {
  anyDevice,
  DEVICE_ORDER,
  DEVICES,
  hasWearable,
  insightsFor,
  METRICS,
  metricsFor,
  READINESS,
  SLEEP,
  TRAINING,
  type DeviceSetup,
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

/** The heart's three figures on the overview: the two everyone with a wearable has, then their device's own. */
export function heartHighlights(setup: DeviceSetup): MetricKey[] {
  const available = new Set(metricsFor(setup));
  const third: MetricKey[] = ['vo2max', 'temperature', 'respiratory', 'heartRate'];
  return [
    'restingHr' as MetricKey,
    'hrv' as MetricKey,
    third.find((key) => available.has(key)) ?? 'heartRate',
  ].filter((key) => available.has(key));
}

/** "Apple Watch and Oura Ring" -- the devices in a setup, named. */
export function setupNames(setup: DeviceSetup): string {
  const names = DEVICE_ORDER.filter((key) => setup[key]).map((key) => DEVICES[key].name);
  if (names.length <= 1) return names[0] ?? 'No devices';
  return `${names.slice(0, -1).join(', ')} and ${names[names.length - 1]}`;
}

/**
 * Health's overview (Phase 1 prototype, sample data), made for each person's devices: only what
 * those devices give is shown -- nothing that would only ever say "not available". A watch or ring
 * brings recovery, sleep and the heart; a phone alone brings steps; with nothing connected, Health
 * starts from the person's own training, with Set Up Health a tap away. A setup can always be
 * started or changed (Devices). A preview bar on top switches the devices it pretends to have.
 */
export function HealthOverview({
  accent,
  onOpen,
}: {
  accent: string;
  onOpen: (page: HealthPage, metric?: MetricKey, onboarding?: boolean) => void;
}) {
  const setup = usePreviewSetup();
  const [dayOffset, setDayOffset] = useState(0);
  const wearable = hasWearable(setup);
  const anything = anyDevice(setup);
  const open = (page: HealthPage, metric?: MetricKey) => onOpen(page, metric);
  const stages = stageColors(accent);
  const insights = insightsFor(setup).slice(0, 2);
  const readiness = Math.max(40, READINESS.score - dayOffset * 4);
  const steps = useRealSteps();
  // Just an iPhone, no watch or ring: the iPhone-only design (all sample, steps too).
  const phoneOnly = setup.iphone && !wearable;

  // The prototype's own controls: which devices it pretends this person has.
  const previewBar = (
    <View style={styles.previewBar}>
      <View style={styles.previewHead}>
        <SampleNote testID="health-sample-note" exceptSteps={!phoneOnly} />
        <Pressable
          testID="health-preview-onboarding"
          onPress={() => onOpen('setup', undefined, true)}
          hitSlop={8}
          accessibilityRole="button"
        >
          <Text style={[styles.previewLink, { color: accent }]}>Onboarding step</Text>
        </Pressable>
      </View>
      <View style={styles.previewChips}>
        {DEVICE_ORDER.map((key) => {
          const on = setup[key];
          return (
            <Pressable
              key={key}
              testID={`health-preview-device-${key}`}
              onPress={() => setPreviewSetup({ ...setup, [key]: !on })}
              accessibilityRole="switch"
              accessibilityState={{ checked: on }}
              style={[
                styles.previewChip,
                on && { backgroundColor: withAlpha(accent, 0.16), borderColor: accent },
              ]}
            >
              <Text style={[styles.previewChipText, on && { color: accent }]}>
                {key === 'otherWatch' ? 'Other Watch' : DEVICES[key].name.replace(' Ring', '')}
              </Text>
            </Pressable>
          );
        })}
      </View>
    </View>
  );

  if (phoneOnly) {
    return (
      <ScrollView
        testID="health-overview"
        keyboardDismissMode="on-drag"
        style={styles.fill}
        contentContainerStyle={styles.content}
        showsVerticalScrollIndicator={false}
      >
        {previewBar}
        <IPhoneHealth accent={accent} onAddDevice={() => open('setup')} />
      </ScrollView>
    );
  }

  return (
    <ScrollView
      testID="health-overview"
      keyboardDismissMode="on-drag"
      style={styles.fill}
      contentContainerStyle={styles.content}
      showsVerticalScrollIndicator={false}
    >
      {previewBar}

      {anything ? (
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
      ) : null}

      {/* Nothing connected: Health starts from their training, with setup a tap away. */}
      {!anything ? (
        <Tile testID="health-set-up" style={styles.setUp}>
          <View style={[styles.setUpIcon, { backgroundColor: withAlpha(accent, 0.12) }]}>
            <MaterialCommunityIcons name="heart-pulse" size={24} color={accent} />
          </View>
          <Text style={styles.heroTitle}>Bring in your health data</Text>
          <Text style={styles.secondary}>
            Connect Apple Health, an Oura Ring or your watch’s app -- or don’t. Your training and
            nutrition are already here.
          </Text>
          <PrimaryButton
            testID="health-set-up-button"
            label="Set Up Health"
            onPress={() => open('setup')}
            accentColor={accent}
          />
        </Tile>
      ) : null}

      {/* Recovery: Oura's own readiness where there's an Oura Ring; otherwise the signals behind it. */}
      {wearable && setup.oura ? (
        <Tile
          testID="health-readiness"
          onPress={() => open('recovery')}
          style={styles.hero}
          accessibilityLabel={`Oura readiness ${readiness}, ${READINESS.word}.`}
        >
          <Ring size={124} stroke={11} progress={readiness / 100} color={accent}>
            <Text style={styles.heroScore}>{readiness}</Text>
            <Text style={styles.heroScoreLabel}>OURA</Text>
          </Ring>
          <View style={styles.heroWords}>
            <Text style={styles.kicker}>READINESS</Text>
            <Text style={styles.heroTitle}>{READINESS.word}</Text>
            {(['hrv', 'restingHr', 'sleep'] as MetricKey[]).map((key) => (
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
      ) : wearable ? (
        <Tile
          testID="health-recovery-signals"
          onPress={() => open('recovery')}
          style={styles.signals}
          accessibilityLabel="Recovery signals"
        >
          <View style={styles.signalsHead}>
            <Text style={styles.kicker}>RECOVERY SIGNALS</Text>
            <Feather name="chevron-right" size={16} color={colors.textMuted} />
          </View>
          <View style={styles.pair}>
            {(['hrv', 'restingHr', 'sleep'] as MetricKey[]).map((key) => (
              <View key={key} style={styles.signal}>
                <Text style={styles.signalValue}>
                  {METRICS[key].value}
                  {key === 'sleep' ? '' : <Text style={styles.tileUnit}> {METRICS[key].unit}</Text>}
                </Text>
                <Text style={styles.caption}>{METRICS[key].short}</Text>
                <Text style={[styles.signalChange, { color: accent }]}>{METRICS[key].change}</Text>
              </View>
            ))}
          </View>
        </Tile>
      ) : null}

      {/* Sleep and movement -- sleep only with a watch or ring. */}
      {anything ? (
        <View style={styles.pair}>
          {wearable ? (
            <Tile
              testID="health-sleep"
              onPress={() => open('sleep')}
              style={styles.half}
              accessibilityLabel={`Sleep ${SLEEP.asleep}`}
            >
              <View style={styles.tileHead}>
                <Feather name="moon" size={14} color={accent} />
                <Text style={styles.tileName}>Sleep</Text>
              </View>
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
            </Tile>
          ) : null}
          {/* Steps are real: Apple Health's, on this phone. */}
          <Tile
            testID="health-activity"
            onPress={() => open('activity')}
            style={styles.half}
            accessibilityLabel={
              steps.today === null
                ? `Activity, steps: ${steps.note}`
                : `Activity, ${steps.today.toLocaleString('en-US')} steps today, from Apple Health`
            }
          >
            <View style={styles.tileHead}>
              <Feather name="trending-up" size={14} color={accent} />
              <Text style={styles.tileName}>Activity</Text>
            </View>
            <Text testID="health-activity-steps" style={styles.tileValue}>
              {steps.today === null ? '—' : steps.today.toLocaleString('en-US')}
              <Text style={styles.tileUnit}> steps</Text>
            </Text>
            {steps.week ? (
              <Columns
                values={steps.week}
                highlight={steps.week.length - 1}
                height={22}
                color={accent}
                gap={2}
              />
            ) : null}
            <Text testID="health-activity-source" style={styles.caption}>
              {steps.note}
            </Text>
          </Tile>
        </View>
      ) : null}

      {/* The heart: what their watch or ring measures. */}
      {wearable ? (
        <View style={styles.block}>
          <BlockTitle title="Heart" action="All" onAction={() => open('heart')} accent={accent} />
          <View style={styles.pair}>
            {heartHighlights(setup).map((key) => (
              <MetricTile
                key={key}
                testID={`health-heart-${key}`}
                metric={METRICS[key]}
                available
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
            <Text style={styles.kicker}>{wearable ? 'TRAINING & RECOVERY' : 'TRAINING'}</Text>
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

      <View style={styles.block}>
        <BlockTitle
          title="Insights"
          action={insightsFor(setup).length > 2 ? 'See All' : undefined}
          onAction={() => open('insights')}
          accent={accent}
        />
        <View>
          {insights.map((insight, i) => (
            <InsightRow key={insight.id} insight={insight} accent={accent} divider={i > 0} />
          ))}
        </View>
      </View>

      {/* A phone alone: a watch or ring is always a tap away, never pushed. */}
      {anything && !wearable ? (
        <Pressable
          testID="health-add-wearable"
          onPress={() => open('setup')}
          accessibilityRole="button"
          style={({ pressed }) => [styles.addRow, pressed && styles.faded]}
        >
          <Feather name="plus-circle" size={16} color={accent} />
          <Text style={styles.addText}>Add a watch or ring for sleep and recovery</Text>
        </Pressable>
      ) : null}

      {/* What it's all from -- set up or changed any time. */}
      {anything ? (
        <Pressable
          testID="health-devices"
          onPress={() => open('devices')}
          accessibilityRole="button"
          style={({ pressed }) => [styles.devices, pressed && styles.faded]}
        >
          <Feather name="link" size={14} color={colors.textMuted} />
          <Text style={styles.devicesText} numberOfLines={1}>
            {setupNames(setup)} · synced 5 min ago
          </Text>
          <Text style={[styles.devicesManage, { color: accent }]}>Manage</Text>
        </Pressable>
      ) : null}
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
    paddingBottom: spacing.sm,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: colors.divider,
  },
  previewHead: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  previewLink: {
    ...typeScale.caption,
    fontFamily: fonts.semibold,
  },
  previewChips: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: spacing.xs,
  },
  previewChip: {
    paddingHorizontal: spacing.md,
    paddingVertical: 6,
    borderRadius: radii.pill,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: colors.glassBorderStrong,
  },
  previewChipText: {
    ...typeScale.caption,
    fontFamily: fonts.semibold,
    color: colors.textSecondary,
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
  setUp: {
    gap: spacing.md,
    padding: spacing.lg,
  },
  setUpIcon: {
    width: 48,
    height: 48,
    borderRadius: 24,
    alignItems: 'center',
    justifyContent: 'center',
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
  signals: {
    gap: spacing.md,
    padding: spacing.lg,
  },
  signalsHead: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  signal: {
    flex: 1,
    gap: 2,
  },
  signalValue: {
    fontFamily: fonts.monoBold,
    fontSize: 20,
    color: colors.textPrimary,
  },
  signalChange: {
    ...typeScale.caption,
    fontFamily: fonts.semibold,
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
  addRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
    paddingVertical: spacing.xs,
  },
  addText: {
    ...typeScale.secondary,
    color: colors.textSecondaryBright,
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
