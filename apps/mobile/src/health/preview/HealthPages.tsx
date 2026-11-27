import { Feather, MaterialCommunityIcons } from '@expo/vector-icons';
import { useState, type ReactNode } from 'react';
import { StyleSheet, View } from 'react-native';
import { AppCard } from '../../design/AppCard';
import { PrimaryButton, SecondaryButton } from '../../design/Button';
import { SegmentedControl } from '../../design/SegmentedControl';
import { StatBlock } from '../../design/StatBlock';
import { Text } from '../../design/Text';
import { colors, fonts, radii, spacing, typeScale, widgetGap } from '../../design/theme';
import { withAlpha } from '../../theme/accentColor';
import { Columns, Ring, SleepWindows, StackedBar } from './healthCharts';
import {
  BlockTitle,
  InsightRow,
  MetricRow,
  MetricTile,
  SampleNote,
  SourceTag,
  StatusPill,
  TrendChip,
} from './healthParts';
import { stageColors } from './HealthOverview';
import type { HealthPage } from './healthPreview';
import {
  ACTIVITY,
  CONNECTION_STATES,
  insightsFor,
  METRICS,
  metricsFor,
  READINESS,
  SLEEP,
  SOURCE_NAMES,
  sourceOf,
  TRAINING,
  type ConnectionState,
  type HealthScenario,
  type MetricKey,
} from './sampleHealthData';

// The Health prototype's deeper pages (Phase 1, sample data only): each opened from the overview,
// each laid out to be read at a glance -- one hero, a chart, the few figures behind it.

export interface PageProps {
  scenario: HealthScenario;
  accent: string;
  open: (page: HealthPage, metric?: MetricKey) => void;
}

function hm(minutes: number): string {
  const h = Math.floor(minutes / 60);
  const m = minutes % 60;
  return h > 0 ? `${h}h ${m}m` : `${m}m`;
}

/** A card's title and what's in it. */
function Block({
  title,
  children,
  accent,
  action,
  onAction,
  testID,
}: {
  title?: string;
  children: ReactNode;
  accent: string;
  action?: string;
  onAction?: () => void;
  testID?: string;
}) {
  return (
    <AppCard testID={testID}>
      <View style={styles.block}>
        {title ? (
          <BlockTitle title={title} action={action} onAction={onAction} accent={accent} />
        ) : null}
        {children}
      </View>
    </AppCard>
  );
}

/** One line under a chart or a figure: quiet, never a paragraph. */
function Note({ children }: { children: ReactNode }) {
  return <Text style={styles.note}>{children}</Text>;
}

// --- Recovery ------------------------------------------------------------------------------

export function RecoveryPage({ scenario, accent, open }: PageProps) {
  const [compare, setCompare] = useState<'week' | 'month'>('week');
  const available = new Set(metricsFor(scenario));
  const keys: MetricKey[] = ['hrv', 'restingHr', 'sleep', 'respiratory', 'temperature'];
  if (scenario === 'none') {
    return (
      <Block accent={accent} testID="health-recovery-none">
        <Text style={styles.title}>Recovery needs a wearable</Text>
        <Note>
          Heart rate variability and resting heart rate come from a watch or ring. Your training is
          still tracked below, and on Training & Recovery.
        </Note>
        <SecondaryButton label="Connect a Device" onPress={() => open('devices')} />
      </Block>
    );
  }
  const changes =
    compare === 'week'
      ? [
          { label: 'HRV', value: '+4 ms' },
          { label: 'Resting HR', value: '−2 bpm' },
          { label: 'Sleep', value: '+18m' },
        ]
      : [
          { label: 'HRV', value: '+6 ms' },
          { label: 'Resting HR', value: '−3 bpm' },
          { label: 'Sleep', value: '+11m' },
        ];
  return (
    <>
      <AppCard hero testID="health-recovery-hero">
        <View style={styles.centre}>
          <Ring size={176} stroke={14} progress={READINESS.score / 100} color={accent}>
            <Text style={styles.ringBig}>{READINESS.score}</Text>
            <Text style={styles.ringLabel}>EXAMPLE SCORE</Text>
          </Ring>
          <Text style={styles.title}>{READINESS.word}</Text>
          <Note>
            How readiness could look. Progresso doesn’t calculate a score yet -- this one is made
            up.
          </Note>
        </View>
      </AppCard>

      <Block title="This week" accent={accent}>
        <Columns
          values={READINESS.week}
          labels={READINESS.weekDays}
          highlight={READINESS.week.length - 1}
          height={72}
          color={accent}
          gap={8}
        />
      </Block>

      <Block title="What goes into it" accent={accent}>
        <View>
          {keys.map((key, i) => (
            <MetricRow
              key={key}
              testID={`health-recovery-${key}`}
              metric={METRICS[key]}
              source={sourceOf(key, scenario)}
              available={available.has(key)}
              accent={accent}
              divider={i > 0}
              onPress={() => open('metric', key)}
            />
          ))}
          <View style={[styles.trainingRow, styles.divider]}>
            <View style={[styles.rowIcon, { backgroundColor: withAlpha(accent, 0.12) }]}>
              <MaterialCommunityIcons name="dumbbell" size={16} color={accent} />
            </View>
            <View style={styles.flex}>
              <Text style={styles.rowName}>Recent training</Text>
              <SourceTag source="progresso" />
            </View>
            <Text style={styles.rowValue}>{TRAINING.thisWeek.workouts} workouts</Text>
          </View>
        </View>
      </Block>

      <Block title="Compared with" accent={accent}>
        <SegmentedControl
          options={[
            { value: 'week', label: 'Last Week' },
            { value: 'month', label: '30-Day Average' },
          ]}
          value={compare}
          onChange={setCompare}
          accentColor={accent}
          stretch
        />
        <View style={styles.stats}>
          {changes.map((change) => (
            <StatBlock key={change.label} value={change.value} label={change.label} />
          ))}
        </View>
      </Block>
    </>
  );
}

// --- Sleep ---------------------------------------------------------------------------------

export function SleepPage({ scenario, accent }: PageProps) {
  const stages = stageColors(accent);
  const wearable = scenario !== 'none';
  if (!wearable) {
    return (
      <Block accent={accent} testID="health-sleep-manual">
        <Text style={styles.title}>Log last night</Text>
        <View style={styles.manualTimes}>
          <View style={styles.manualTime}>
            <Feather name="moon" size={16} color={accent} />
            <Text style={styles.caption}>Bedtime</Text>
            <Text style={styles.manualValue}>10:45 PM</Text>
          </View>
          <View style={styles.manualTime}>
            <Feather name="sun" size={16} color={accent} />
            <Text style={styles.caption}>Woke up</Text>
            <Text style={styles.manualValue}>6:50 AM</Text>
          </View>
        </View>
        <PrimaryButton label="Save Sleep" onPress={() => {}} accentColor={accent} />
        <Note>Sleep stages need a watch or ring; how long you slept doesn’t.</Note>
      </Block>
    );
  }
  return (
    <>
      <AppCard hero testID="health-sleep-hero">
        <View style={styles.block}>
          <Text style={styles.kicker}>LAST NIGHT</Text>
          <Text style={styles.bigValue}>{SLEEP.asleep}</Text>
          <View style={styles.inBedRow}>
            <View style={styles.flex}>
              <StackedBar
                height={10}
                parts={[
                  { key: 'asleep', value: 462, color: accent },
                  { key: 'awake', value: 28, color: withAlpha(accent, 0.2) },
                ]}
              />
            </View>
          </View>
          <View style={styles.spread}>
            <Text style={styles.caption}>Asleep {SLEEP.asleep}</Text>
            <Text style={styles.caption}>In bed {SLEEP.inBed}</Text>
          </View>
          <View style={styles.bedWake}>
            <Feather name="moon" size={14} color={colors.textSecondary} />
            <Text style={styles.secondary}>{SLEEP.bedtime}</Text>
            <View style={styles.bedWakeLine} />
            <Feather name="sun" size={14} color={colors.textSecondary} />
            <Text style={styles.secondary}>{SLEEP.wake}</Text>
          </View>
          <SourceTag source={sourceOf('sleep', scenario)} />
        </View>
      </AppCard>

      <Block title="Stages" accent={accent} testID="health-sleep-stages">
        <StackedBar
          height={14}
          parts={SLEEP.stages
            .slice()
            .reverse()
            .map((stage) => ({ key: stage.key, value: stage.minutes, color: stages[stage.key] }))}
        />
        <View style={styles.legend}>
          {SLEEP.stages
            .slice()
            .reverse()
            .map((stage) => (
              <View key={stage.key} style={styles.legendItem}>
                <View style={[styles.swatch, { backgroundColor: stages[stage.key] }]} />
                <Text style={styles.legendName}>
                  {stage.key === 'light' && scenario === 'apple' ? 'Core' : stage.label}
                </Text>
                <Text style={styles.legendValue}>{hm(stage.minutes)}</Text>
              </View>
            ))}
        </View>
      </Block>

      <Block title="Consistency" accent={accent}>
        <SleepWindows nights={SLEEP.nights} color={accent} />
        <Note>{SLEEP.consistency}</Note>
      </Block>

      <Block title="Last 7 nights" accent={accent}>
        <Columns
          values={SLEEP.nights.map((night) => night.asleep)}
          labels={SLEEP.nights.map((night) => night.day)}
          highlight={SLEEP.nights.length - 1}
          height={72}
          color={accent}
          gap={8}
          band={METRICS.sleep.usual}
        />
        <Note>Shaded: your usual range</Note>
      </Block>

      <Block title="History" accent={accent}>
        <View>
          {SLEEP.nights
            .slice()
            .reverse()
            .slice(0, 5)
            .map((night, i) => (
              <View key={`${night.day}${i}`} style={[styles.historyRow, i > 0 && styles.divider]}>
                <Text style={styles.historyDay}>{i === 0 ? 'Last night' : night.day}</Text>
                <Text style={styles.historyValue}>{hm(Math.round(night.asleep * 60))}</Text>
              </View>
            ))}
        </View>
      </Block>
    </>
  );
}

// --- Activity ------------------------------------------------------------------------------

export function ActivityPage({ scenario, accent }: PageProps) {
  if (scenario === 'none') {
    return (
      <Block accent={accent} testID="health-activity-none">
        <Text style={styles.title}>Steps need Apple Health or a ring</Text>
        <Note>Your workouts still count: this week, {TRAINING.thisWeek.workouts} of them.</Note>
      </Block>
    );
  }
  const hourLabels = ACTIVITY.hourly.map((_, i) =>
    i === 0 ? '6a' : i === 6 ? '12p' : i === 12 ? '6p' : i === 16 ? '10p' : '',
  );
  const weekTotal = ACTIVITY.week.reduce((sum, day) => sum + day.steps, 0);
  return (
    <>
      <AppCard hero testID="health-activity-hero">
        <View style={styles.block}>
          <Text style={styles.kicker}>TODAY</Text>
          <Text style={styles.bigValue}>
            {ACTIVITY.steps}
            <Text style={styles.bigUnit}> steps</Text>
          </Text>
          <Columns
            values={ACTIVITY.hourly}
            labels={hourLabels}
            height={64}
            color={accent}
            gap={3}
          />
          <SourceTag source={sourceOf('steps', scenario)} />
        </View>
      </AppCard>

      <Block accent={accent}>
        <View style={styles.stats}>
          <StatBlock value={ACTIVITY.activeCalories} label="Active Cal" valueColor={accent} />
          <StatBlock value={`${ACTIVITY.exerciseMinutes} min`} label="Exercise" />
          <StatBlock value={ACTIVITY.distance} label="Distance" />
        </View>
        <Note>Active calories count all of today’s movement, not just workouts.</Note>
      </Block>

      <Block title="This week" accent={accent}>
        <Columns
          values={ACTIVITY.week.map((day) => day.steps)}
          labels={ACTIVITY.week.map((day) => day.day)}
          highlight={ACTIVITY.week.length - 1}
          height={80}
          color={accent}
          gap={8}
        />
        <View style={styles.stats}>
          <StatBlock value={weekTotal.toLocaleString('en-US')} label="Steps" />
          <StatBlock value={Math.round(weekTotal / 7).toLocaleString('en-US')} label="Daily Avg" />
          <StatBlock value="4h 12m" label="Exercise" />
        </View>
      </Block>
    </>
  );
}

// --- Heart ---------------------------------------------------------------------------------

export function HeartPage({ scenario, accent, open }: PageProps) {
  const available = new Set(metricsFor(scenario));
  const keys: MetricKey[] = [
    'restingHr',
    'hrv',
    'heartRate',
    'respiratory',
    'bloodOxygen',
    'temperature',
    'vo2max',
    'hrRecovery',
  ];
  const pairs: MetricKey[][] = [];
  for (let i = 0; i < keys.length; i += 2) pairs.push(keys.slice(i, i + 2));
  return (
    <>
      <Block accent={accent} testID="health-heart">
        <View style={styles.grid}>
          {pairs.map((pair) => (
            <View key={pair.join()} style={styles.gridRow}>
              {pair.map((key) => (
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
          ))}
        </View>
      </Block>
      <Note>For general fitness, not medical advice. Tap a figure for what it means.</Note>
    </>
  );
}

// --- Training & Recovery -------------------------------------------------------------------

export function TrainingPage({ scenario, accent }: PageProps) {
  const wearable = scenario !== 'none';
  const weeks = TRAINING.weeks;
  const rows: { label: string; values: number[]; latest: string; needsWearable: boolean }[] = [
    {
      label: 'Volume',
      values: weeks.map((w) => w.volume),
      latest: `${(weeks[weeks.length - 1].volume / 1000).toFixed(1)}k kg`,
      needsWearable: false,
    },
    {
      label: 'Workouts',
      values: weeks.map((w) => w.workouts),
      latest: `${weeks[weeks.length - 1].workouts}`,
      needsWearable: false,
    },
    {
      label: 'Sleep',
      values: weeks.map((w) => w.sleep),
      latest: `${weeks[weeks.length - 1].sleep}h`,
      needsWearable: true,
    },
    {
      label: 'HRV',
      values: weeks.map((w) => w.hrv),
      latest: `${weeks[weeks.length - 1].hrv} ms`,
      needsWearable: true,
    },
  ];
  const patterns = insightsFor(scenario).filter(
    (insight) => insight.id === 'rest-days-sleep' || insight.id === 'hrv-dip',
  );
  return (
    <>
      <Block title="Last 4 weeks" accent={accent} testID="health-training-weeks">
        <View style={styles.weekHeader}>
          <View style={styles.weekLabelCol} />
          {weeks.map((week) => (
            <Text key={week.label} style={styles.weekHeaderText}>
              {week.label}
            </Text>
          ))}
          <View style={styles.weekLatestCol} />
        </View>
        {rows.map((row) => {
          const off = row.needsWearable && !wearable;
          return (
            <View key={row.label} style={[styles.weekRow, off && styles.faded]}>
              <Text style={styles.weekLabel}>{row.label}</Text>
              <View style={styles.flex}>
                <Columns
                  values={off ? row.values.map(() => 0.01) : row.values}
                  highlight={row.values.length - 1}
                  height={30}
                  color={accent}
                  gap={10}
                />
              </View>
              <Text style={styles.weekLatest}>{off ? '—' : row.latest}</Text>
            </View>
          );
        })}
        <Note>
          {wearable
            ? 'Training from Progresso, sleep and HRV from your devices, week by week.'
            : 'Connect a device to see sleep and HRV beside your training.'}
        </Note>
      </Block>

      <Block title="This week" accent={accent}>
        <View style={styles.stats}>
          <StatBlock value={`${TRAINING.thisWeek.workouts}`} label="Workouts" valueColor={accent} />
          <StatBlock value={TRAINING.thisWeek.volume} label="Volume" />
          <StatBlock value={`${TRAINING.thisWeek.sets}`} label="Sets" />
        </View>
      </Block>

      {patterns.length > 0 ? (
        <Block title="Patterns" accent={accent}>
          <View>
            {patterns.map((insight, i) => (
              <InsightRow key={insight.id} insight={insight} accent={accent} divider={i > 0} />
            ))}
          </View>
          <Note>Patterns show what tends to happen together, not what causes what.</Note>
        </Block>
      ) : null}
    </>
  );
}

// --- Devices -------------------------------------------------------------------------------

const DEVICE_PROVIDES = {
  apple: ['Steps', 'Sleep', 'HRV', 'Resting HR', 'VO₂ Max', 'Blood Oxygen'],
  oura: ['Sleep stages', 'Readiness', 'HRV', 'Resting HR', 'Temperature', 'Steps'],
} as const;

function DeviceCard({
  name,
  detail,
  icon,
  state,
  provides,
  accent,
  testID,
}: {
  name: string;
  detail: string;
  icon: ReactNode;
  state: ConnectionState;
  provides: readonly string[];
  accent: string;
  testID: string;
}) {
  const action: Record<ConnectionState, ReactNode> = {
    connected: <Text style={styles.caption}>Synced 5 min ago</Text>,
    syncing: <Text style={styles.caption}>Bringing in the last 24 hours…</Text>,
    permission: <SecondaryButton label="Allow Access" onPress={() => {}} />,
    issue: <SecondaryButton label="Try Again" onPress={() => {}} />,
    notConnected: (
      <PrimaryButton label={`Connect ${name}`} onPress={() => {}} accentColor={accent} />
    ),
  };
  return (
    <AppCard testID={testID}>
      <View style={styles.block}>
        <View style={styles.deviceHead}>
          <View style={[styles.deviceIcon, { backgroundColor: withAlpha(accent, 0.12) }]}>
            {icon}
          </View>
          <View style={styles.flex}>
            <Text style={styles.rowName}>{name}</Text>
            <Text style={styles.caption}>{detail}</Text>
          </View>
          <StatusPill state={state} accent={accent} />
        </View>
        <View style={styles.chips}>
          {provides.map((item) => (
            <View key={item} style={styles.chip}>
              <Text style={styles.chipText}>{item}</Text>
            </View>
          ))}
        </View>
        {action[state]}
      </View>
    </AppCard>
  );
}

export function DevicesPage({ scenario, accent }: PageProps) {
  const [state, setState] = useState<ConnectionState>('connected');
  const appleOn = scenario === 'apple' || scenario === 'both';
  const ouraOn = scenario === 'oura' || scenario === 'both';
  return (
    <>
      <View style={styles.previewControl}>
        <SampleNote />
        <Text style={styles.caption}>Preview a connected device’s state</Text>
        <SegmentedControl
          testID="health-device-state"
          options={CONNECTION_STATES.filter((option) => option.value !== 'notConnected')}
          value={state}
          onChange={setState}
          accentColor={accent}
          stretch
        />
      </View>

      {scenario === 'none' ? (
        <AppCard hero testID="health-devices-none">
          <View style={styles.block}>
            <Text style={styles.title}>You don’t need a wearable</Text>
            <Note>
              Health uses your workouts and nutrition, and anything you log. Connect a device any
              time for sleep, heart and recovery data.
            </Note>
          </View>
        </AppCard>
      ) : null}

      <DeviceCard
        testID="health-device-apple"
        name="Apple Health"
        detail="Apple Watch and iPhone"
        icon={<MaterialCommunityIcons name="heart-pulse" size={20} color={accent} />}
        state={appleOn ? state : 'notConnected'}
        provides={DEVICE_PROVIDES.apple}
        accent={accent}
      />
      <DeviceCard
        testID="health-device-oura"
        name="Oura Ring"
        detail="Sleep, readiness and recovery"
        icon={<MaterialCommunityIcons name="ring" size={20} color={accent} />}
        state={ouraOn ? state : 'notConnected'}
        provides={DEVICE_PROVIDES.oura}
        accent={accent}
      />
      <AppCard testID="health-device-manual">
        <View style={styles.block}>
          <View style={styles.deviceHead}>
            <View style={[styles.deviceIcon, { backgroundColor: withAlpha(accent, 0.12) }]}>
              <Feather name="edit-3" size={18} color={accent} />
            </View>
            <View style={styles.flex}>
              <Text style={styles.rowName}>Manual Tracking</Text>
              <Text style={styles.caption}>Sleep you log, and your Progresso training</Text>
            </View>
            <StatusPill state="connected" accent={accent} />
          </View>
        </View>
      </AppCard>

      {scenario === 'both' ? (
        <Block title="One value for each" accent={accent} testID="health-devices-sources">
          <View>
            {(['sleep', 'hrv', 'restingHr', 'steps', 'vo2max'] as MetricKey[]).map((key, i) => (
              <View key={key} style={[styles.historyRow, i > 0 && styles.divider]}>
                <Text style={styles.historyDay}>{METRICS[key].short}</Text>
                <View style={styles.sourceChoice}>
                  <Text style={styles.historyValue}>
                    {SOURCE_NAMES[sourceOf(key, scenario) ?? 'apple']}
                  </Text>
                  <Feather name="chevron-down" size={14} color={colors.textMuted} />
                </View>
              </View>
            ))}
          </View>
          <Note>When both measure the same thing, Health shows one, never both added up.</Note>
        </Block>
      ) : null}
    </>
  );
}

// --- Insights ------------------------------------------------------------------------------

export function InsightsPage({ scenario, accent }: PageProps) {
  const insights = insightsFor(scenario);
  return (
    <>
      <Block accent={accent} testID="health-insights">
        <View>
          {insights.map((insight, i) => (
            <InsightRow
              key={insight.id}
              testID={`health-insight-${insight.id}`}
              insight={insight}
              accent={accent}
              divider={i > 0}
            />
          ))}
        </View>
      </Block>
      <Note>Examples of what Progresso could notice in your own data.</Note>
    </>
  );
}

// --- A metric ------------------------------------------------------------------------------

const PERIODS = [
  { value: '7', label: '7D' },
  { value: '30', label: '30D' },
  { value: '90', label: '90D' },
] as const;

/** A period's columns: each day for 7 or 30, each week's average for 90. */
function periodColumns(history: number[], days: number): number[] {
  const slice = history.slice(-days);
  if (days <= 30) return slice;
  const weeks: number[] = [];
  for (let i = 0; i < slice.length; i += 7) {
    const week = slice.slice(i, i + 7);
    weeks.push(week.reduce((sum, v) => sum + v, 0) / week.length);
  }
  return weeks;
}

export function MetricPage({ scenario, accent, metric: key }: PageProps & { metric: MetricKey }) {
  const [period, setPeriod] = useState<'7' | '30' | '90'>('30');
  const metric = METRICS[key];
  const days = Number(period);
  const values = periodColumns(metric.history, days);
  const average = metric.history.slice(-30).reduce((sum, v) => sum + v, 0) / 30;
  const latest = metric.history[metric.history.length - 1];
  const percent = average !== 0 ? Math.round(((latest - average) / Math.abs(average)) * 100) : 0;
  const trend =
    Math.abs(percent) < 2
      ? 'In line with your 30-day average'
      : `${Math.abs(percent)}% ${percent > 0 ? 'above' : 'below'} your 30-day average`;
  return (
    <>
      <AppCard hero testID="health-metric-hero">
        <View style={styles.block}>
          <View style={styles.metricHead}>
            <Text style={styles.bigValue}>
              {metric.value}
              <Text style={styles.bigUnit}> {metric.unit}</Text>
            </Text>
            <TrendChip metric={metric} accent={accent} />
          </View>
          <Text style={styles.secondary}>{trend}</Text>
        </View>
      </AppCard>

      <Block accent={accent} testID="health-metric-chart">
        <SegmentedControl
          testID="health-metric-period"
          options={[...PERIODS]}
          value={period}
          onChange={setPeriod}
          accentColor={accent}
          stretch
        />
        <Columns
          values={values}
          highlight={values.length - 1}
          height={120}
          color={accent}
          gap={days === 30 ? 2 : 6}
          band={metric.usual}
        />
        <View style={styles.spread}>
          <Text style={styles.caption}>{days === 90 ? '13 weeks ago' : `${days} days ago`}</Text>
          <Text style={styles.caption}>Shaded: your usual range</Text>
          <Text style={styles.caption}>Today</Text>
        </View>
      </Block>

      <Block title="About" accent={accent}>
        <Text style={styles.secondaryBright}>{metric.about}</Text>
        <View>
          <View style={styles.historyRow}>
            <Text style={styles.historyDay}>Source</Text>
            <SourceTag source={sourceOf(key, scenario)} />
          </View>
          <View style={[styles.historyRow, styles.divider]}>
            <Text style={styles.historyDay}>Last updated</Text>
            <Text style={styles.historyValue}>{metric.updated}</Text>
          </View>
        </View>
        <Note>For general fitness, not medical advice.</Note>
      </Block>
    </>
  );
}

const styles = StyleSheet.create({
  flex: {
    flex: 1,
    minWidth: 0,
  },
  block: {
    gap: spacing.md,
  },
  centre: {
    alignItems: 'center',
    gap: spacing.md,
    paddingVertical: spacing.sm,
  },
  title: {
    ...typeScale.cardTitle,
    fontSize: 18,
    color: colors.textPrimary,
  },
  kicker: {
    ...typeScale.caption,
    fontFamily: fonts.semibold,
    color: colors.textMuted,
    letterSpacing: 1,
  },
  ringBig: {
    fontFamily: fonts.monoBold,
    fontSize: 46,
    color: colors.textPrimary,
  },
  ringLabel: {
    ...typeScale.caption,
    color: colors.textMuted,
    letterSpacing: 1.2,
  },
  bigValue: {
    fontFamily: fonts.monoBold,
    fontSize: 36,
    color: colors.textPrimary,
  },
  bigUnit: {
    ...typeScale.body,
    fontFamily: fonts.body,
    color: colors.textSecondary,
  },
  note: {
    ...typeScale.caption,
    color: colors.textMuted,
    textAlign: 'left',
  },
  caption: {
    ...typeScale.caption,
    color: colors.textMuted,
  },
  secondary: {
    ...typeScale.secondary,
    color: colors.textSecondary,
  },
  secondaryBright: {
    ...typeScale.secondary,
    color: colors.textSecondaryBright,
  },
  stats: {
    flexDirection: 'row',
    gap: widgetGap,
  },
  spread: {
    flexDirection: 'row',
    justifyContent: 'space-between',
  },
  inBedRow: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  bedWake: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.xs,
  },
  bedWakeLine: {
    flex: 1,
    height: StyleSheet.hairlineWidth,
    backgroundColor: colors.divider,
    marginHorizontal: spacing.sm,
  },
  legend: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    rowGap: spacing.sm,
  },
  legendItem: {
    width: '50%',
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.xs,
  },
  swatch: {
    width: 10,
    height: 10,
    borderRadius: 3,
  },
  legendName: {
    ...typeScale.secondary,
    color: colors.textSecondary,
  },
  legendValue: {
    ...typeScale.secondary,
    fontFamily: fonts.semibold,
    color: colors.textPrimary,
    marginLeft: 'auto',
    marginRight: spacing.lg,
  },
  historyRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    minHeight: 40,
  },
  historyDay: {
    ...typeScale.secondary,
    color: colors.textSecondary,
  },
  historyValue: {
    ...typeScale.secondary,
    fontFamily: fonts.semibold,
    color: colors.textPrimary,
  },
  divider: {
    borderTopWidth: StyleSheet.hairlineWidth,
    borderTopColor: colors.divider,
  },
  trainingRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.md,
    minHeight: 56,
  },
  rowIcon: {
    width: 34,
    height: 34,
    borderRadius: 17,
    alignItems: 'center',
    justifyContent: 'center',
  },
  rowName: {
    ...typeScale.callout,
    fontFamily: fonts.semibold,
    color: colors.textPrimary,
  },
  rowValue: {
    fontFamily: fonts.monoBold,
    fontSize: 15,
    color: colors.textPrimary,
  },
  manualTimes: {
    flexDirection: 'row',
    gap: widgetGap,
  },
  manualTime: {
    flex: 1,
    gap: 4,
    padding: spacing.md,
    borderRadius: radii.md,
    backgroundColor: colors.surfaceLift,
  },
  manualValue: {
    fontFamily: fonts.monoBold,
    fontSize: 18,
    color: colors.textPrimary,
  },
  grid: {
    gap: widgetGap,
  },
  gridRow: {
    flexDirection: 'row',
    gap: widgetGap,
  },
  faded: {
    opacity: 0.4,
  },
  weekHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
  },
  weekHeaderText: {
    ...typeScale.caption,
    color: colors.textMuted,
    flex: 1,
    textAlign: 'center',
  },
  weekLabelCol: {
    width: 64,
  },
  weekLatestCol: {
    width: 56,
  },
  weekRow: {
    flexDirection: 'row',
    alignItems: 'flex-end',
    gap: spacing.sm,
  },
  weekLabel: {
    ...typeScale.secondary,
    color: colors.textSecondary,
    width: 64,
  },
  weekLatest: {
    ...typeScale.secondary,
    fontFamily: fonts.semibold,
    color: colors.textPrimary,
    width: 56,
    textAlign: 'right',
  },
  previewControl: {
    gap: spacing.sm,
  },
  deviceHead: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.md,
  },
  deviceIcon: {
    width: 42,
    height: 42,
    borderRadius: radii.md,
    alignItems: 'center',
    justifyContent: 'center',
  },
  chips: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: spacing.xs,
  },
  chip: {
    paddingHorizontal: spacing.sm,
    paddingVertical: 3,
    borderRadius: radii.pill,
    backgroundColor: colors.surfaceLift,
  },
  chipText: {
    ...typeScale.caption,
    color: colors.textSecondary,
  },
  sourceChoice: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
  },
  metricHead: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
});
