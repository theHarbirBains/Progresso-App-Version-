import { Feather, MaterialCommunityIcons } from '@expo/vector-icons';
import { useState, type ReactNode } from 'react';
import { Pressable, StyleSheet, View } from 'react-native';
import { AppCard } from '../../design/AppCard';
import { PrimaryButton, SecondaryButton, TextButton } from '../../design/Button';
import { ChoiceTile } from '../../design/ChoiceTile';
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
import { setPreviewSetup, type HealthPage } from './healthPreview';
import { StepsSection } from '../../progress/StepsSection';
import {
  ACTIVITY,
  anyDevice,
  CONNECTION_STATES,
  DEVICE_ORDER,
  DEVICES,
  hasWearable,
  insightsFor,
  METRICS,
  metricsFor,
  NO_DEVICES,
  READINESS,
  SLEEP,
  SOURCE_NAMES,
  sourceOf,
  TRAINING,
  type ConnectionState,
  type DeviceKey,
  type DeviceSetup,
  type MetricKey,
} from './sampleHealthData';

// The Health prototype's deeper pages (Phase 1, sample data only): each made for the devices
// someone has -- a page never lists what their devices can't give -- and each laid out to be read
// at a glance: one hero, a chart, the few figures behind it.

export interface PageProps {
  setup: DeviceSetup;
  accent: string;
  open: (page: HealthPage, metric?: MetricKey, onboarding?: boolean) => void;
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

/** A device's icon in its well. */
function DeviceIcon({
  device,
  accent,
  size = 42,
}: {
  device: DeviceKey;
  accent: string;
  size?: number;
}) {
  return (
    <View
      style={[
        styles.deviceIcon,
        { width: size, height: size, backgroundColor: withAlpha(accent, 0.12) },
      ]}
    >
      <MaterialCommunityIcons name={DEVICES[device].icon} size={size * 0.48} color={accent} />
    </View>
  );
}

/** What a device brings, its own data marked. */
function DeviceData({ device, accent }: { device: DeviceKey; accent: string }) {
  const info = DEVICES[device];
  return (
    <View style={styles.chips}>
      {info.unique.map((item) => (
        <View
          key={item}
          style={[styles.chip, { backgroundColor: withAlpha(accent, 0.14) }]}
          accessibilityLabel={`${item}, only from ${info.name}`}
        >
          <Feather name="star" size={10} color={accent} />
          <Text style={[styles.chipText, { color: accent }]}>{item}</Text>
        </View>
      ))}
      {info.provides.map((item) => (
        <View key={item} style={styles.chip}>
          <Text style={styles.chipText}>{item}</Text>
        </View>
      ))}
    </View>
  );
}

// --- Recovery ------------------------------------------------------------------------------

export function RecoveryPage({ setup, accent, open }: PageProps) {
  const [compare, setCompare] = useState<'week' | 'month'>('week');
  const available = new Set(metricsFor(setup));
  const keys = (['hrv', 'restingHr', 'sleep', 'respiratory', 'temperature'] as MetricKey[]).filter(
    (key) => available.has(key),
  );
  if (!hasWearable(setup)) {
    return (
      <Block accent={accent} testID="health-recovery-none">
        <Text style={styles.title}>Recovery comes from a watch or ring</Text>
        <Note>
          Heart rate variability, resting heart rate and sleep are measured as you wear one.
        </Note>
        <SecondaryButton label="Set Up a Device" onPress={() => open('setup')} />
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
      {setup.oura ? (
        <AppCard hero testID="health-recovery-hero">
          <View style={styles.centre}>
            <Ring size={176} stroke={14} progress={READINESS.score / 100} color={accent}>
              <Text style={styles.ringBig}>{READINESS.score}</Text>
              <Text style={styles.ringLabel}>READINESS</Text>
            </Ring>
            <Text style={styles.title}>{READINESS.word}</Text>
            <SourceTag source="oura" />
            <Note>Oura’s own score, from the Oura app. Progresso doesn’t make one of its own.</Note>
          </View>
        </AppCard>
      ) : (
        <AppCard hero testID="health-recovery-signals">
          <View style={styles.block}>
            <Text style={styles.kicker}>AGAINST YOUR USUAL</Text>
            <View style={styles.stats}>
              {(['hrv', 'restingHr', 'sleep'] as MetricKey[]).map((key) => (
                <StatBlock
                  key={key}
                  value={METRICS[key].change}
                  label={METRICS[key].short}
                  valueColor={accent}
                />
              ))}
            </View>
            <Note>
              The signals behind recovery, each against your own 30-day average. No score: an Oura
              Ring gives one; Progresso doesn’t make its own.
            </Note>
          </View>
        </AppCard>
      )}

      {setup.oura ? (
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
      ) : null}

      <Block title="Signals" accent={accent}>
        <View>
          {keys.map((key, i) => (
            <MetricRow
              key={key}
              testID={`health-recovery-${key}`}
              metric={METRICS[key]}
              source={sourceOf(key, setup)}
              available
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

export function SleepPage({ setup, accent, open }: PageProps) {
  const stages = stageColors(accent);
  const source = sourceOf('sleep', setup);
  if (!hasWearable(setup)) {
    return (
      <>
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
        </Block>
        <TextButton
          label="Track sleep automatically with a watch or ring"
          onPress={() => open('setup')}
        />
      </>
    );
  }
  return (
    <>
      <AppCard hero testID="health-sleep-hero">
        <View style={styles.block}>
          <Text style={styles.kicker}>LAST NIGHT</Text>
          <Text style={styles.bigValue}>{SLEEP.asleep}</Text>
          <StackedBar
            height={10}
            parts={[
              { key: 'asleep', value: 462, color: accent },
              { key: 'awake', value: 28, color: withAlpha(accent, 0.2) },
            ]}
          />
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
          <SourceTag source={source} />
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
                  {/* Apple calls light sleep "Core". */}
                  {stage.key === 'light' && source === 'appleWatch' ? 'Core' : stage.label}
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

export function ActivityPage({ setup, accent, open }: PageProps) {
  if (!anyDevice(setup)) {
    return (
      <Block accent={accent} testID="health-activity-none">
        <Text style={styles.title}>Steps come from your phone or a wearable</Text>
        <SecondaryButton label="Set Up Health" onPress={() => open('setup')} />
      </Block>
    );
  }
  const wearable = hasWearable(setup);
  return (
    <>
      {/* Steps are real: Apple Health's, on this phone -- what a release build's Health tab is. */}
      <AppCard testID="health-activity-steps">
        <StepsSection accentColor={accent} embedded />
      </AppCard>

      <Block accent={accent} testID="health-activity-today">
        <SampleNote />
        <View style={styles.stats}>
          {wearable ? (
            <>
              <StatBlock value={ACTIVITY.activeCalories} label="Active Cal" valueColor={accent} />
              <StatBlock value={`${ACTIVITY.exerciseMinutes} min`} label="Exercise" />
            </>
          ) : null}
          <StatBlock value={ACTIVITY.distance} label="Distance" />
        </View>
        {wearable ? (
          <Note>Active calories count all of today’s movement, not just workouts.</Note>
        ) : null}
      </Block>
    </>
  );
}

// --- Heart ---------------------------------------------------------------------------------

const HEART_KEYS: MetricKey[] = [
  'restingHr',
  'hrv',
  'heartRate',
  'respiratory',
  'bloodOxygen',
  'temperature',
  'vo2max',
  'hrRecovery',
];

/** What other devices would add: "VO₂ Max and HR Recovery with Apple Watch". */
export function moreWithDevices(setup: DeviceSetup): string[] {
  const available = new Set(metricsFor(setup));
  const missing = HEART_KEYS.filter((key) => !available.has(key));
  const byDevice = new Map<DeviceKey, string[]>();
  for (const key of missing) {
    const device = METRICS[key].sources[0];
    if (!device) continue;
    byDevice.set(device, [...(byDevice.get(device) ?? []), METRICS[key].short]);
  }
  return [...byDevice].map(
    ([device, names]) => `${names.join(' and ')} with ${DEVICES[device].name}`,
  );
}

export function HeartPage({ setup, accent, open }: PageProps) {
  const available = new Set(metricsFor(setup));
  const keys = HEART_KEYS.filter((key) => available.has(key));
  const pairs: MetricKey[][] = [];
  for (let i = 0; i < keys.length; i += 2) pairs.push(keys.slice(i, i + 2));
  const more = moreWithDevices(setup);
  if (keys.length === 0) {
    return (
      <Block accent={accent} testID="health-heart-none">
        <Text style={styles.title}>Heart data comes from a watch or ring</Text>
        <SecondaryButton label="Set Up a Device" onPress={() => open('setup')} />
      </Block>
    );
  }
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
                  available
                  accent={accent}
                  onPress={() => open('metric', key)}
                />
              ))}
              {pair.length === 1 ? <View style={styles.flex} /> : null}
            </View>
          ))}
        </View>
      </Block>
      {more.length > 0 ? (
        <Pressable
          testID="health-heart-more"
          onPress={() => open('devices')}
          accessibilityRole="button"
          style={styles.moreRow}
        >
          <Feather name="plus-circle" size={14} color={accent} />
          <Text style={styles.moreText}>More: {more.join(' · ')}</Text>
        </Pressable>
      ) : null}
      <Note>For general fitness, not medical advice. Tap a figure for what it means.</Note>
    </>
  );
}

// --- Training & Recovery -------------------------------------------------------------------

export function TrainingPage({ setup, accent }: PageProps) {
  const wearable = hasWearable(setup);
  const weeks = TRAINING.weeks;
  const rows = [
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
  ].filter((row) => wearable || !row.needsWearable);
  const patterns = insightsFor(setup).filter(
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
        {rows.map((row) => (
          <View key={row.label} testID={`health-training-${row.label}`} style={styles.weekRow}>
            <Text style={styles.weekLabel}>{row.label}</Text>
            <View style={styles.flex}>
              <Columns
                values={row.values}
                highlight={row.values.length - 1}
                height={30}
                color={accent}
                gap={10}
              />
            </View>
            <Text style={styles.weekLatest}>{row.latest}</Text>
          </View>
        ))}
        <Note>
          {wearable
            ? 'Training from Progresso, sleep and HRV from your devices, week by week.'
            : 'Your training, week by week, from Progresso.'}
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

function ConnectedDevice({
  device,
  state,
  accent,
}: {
  device: DeviceKey;
  state: ConnectionState;
  accent: string;
}) {
  const info = DEVICES[device];
  const action: Record<ConnectionState, ReactNode> = {
    connected: <Text style={styles.caption}>Synced 5 min ago</Text>,
    syncing: <Text style={styles.caption}>Bringing in the last 24 hours…</Text>,
    permission: <SecondaryButton label="Allow Access" onPress={() => {}} />,
    issue: <SecondaryButton label="Try Again" onPress={() => {}} />,
    notConnected: (
      <PrimaryButton label={`Connect ${info.name}`} onPress={() => {}} accentColor={accent} />
    ),
  };
  return (
    <AppCard testID={`health-device-${device}`}>
      <View style={styles.block}>
        <View style={styles.deviceHead}>
          <DeviceIcon device={device} accent={accent} />
          <View style={styles.flex}>
            <Text style={styles.rowName}>{info.name}</Text>
            <Text style={styles.caption}>Through {info.via}</Text>
          </View>
          <StatusPill state={state} accent={accent} />
        </View>
        <DeviceData device={device} accent={accent} />
        {action[state]}
      </View>
    </AppCard>
  );
}

export function DevicesPage({ setup, accent, open }: PageProps) {
  const [state, setState] = useState<ConnectionState>('connected');
  const connected = DEVICE_ORDER.filter((key) => setup[key]);
  const others = DEVICE_ORDER.filter((key) => !setup[key]);
  const both = setup.oura && (setup.appleWatch || setup.otherWatch);
  return (
    <>
      {connected.length > 0 ? (
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
      ) : (
        <AppCard hero testID="health-devices-none">
          <View style={styles.block}>
            <Text style={styles.title}>You don’t need a wearable</Text>
            <Note>
              Health starts from your workouts and nutrition. Add a device any time for steps,
              sleep, heart and recovery.
            </Note>
          </View>
        </AppCard>
      )}

      {connected.map((device) => (
        <ConnectedDevice key={device} device={device} state={state} accent={accent} />
      ))}

      {both ? (
        <Block title="One value for each" accent={accent} testID="health-devices-sources">
          <View>
            {(['sleep', 'hrv', 'restingHr', 'steps'] as MetricKey[]).map((key, i) => (
              <View key={key} style={[styles.historyRow, i > 0 && styles.divider]}>
                <Text style={styles.historyDay}>{METRICS[key].short}</Text>
                <View style={styles.sourceChoice}>
                  <Text style={styles.historyValue}>
                    {SOURCE_NAMES[sourceOf(key, setup) ?? 'iphone']}
                  </Text>
                  <Feather name="chevron-down" size={14} color={colors.textMuted} />
                </View>
              </View>
            ))}
          </View>
          <Note>
            When two devices measure the same thing, Health shows one -- never both added up.
          </Note>
        </Block>
      ) : null}

      {others.length > 0 ? (
        <Block title="Add a device" accent={accent} testID="health-devices-add">
          <View>
            {others.map((device, i) => (
              <Pressable
                key={device}
                testID={`health-add-${device}`}
                onPress={() => open('setup')}
                accessibilityRole="button"
                style={({ pressed }) => [
                  styles.addDevice,
                  i > 0 && styles.divider,
                  pressed && styles.faded,
                ]}
              >
                <DeviceIcon device={device} accent={accent} size={36} />
                <View style={styles.flex}>
                  <Text style={styles.rowName}>{DEVICES[device].name}</Text>
                  <Text style={styles.caption} numberOfLines={2}>
                    {[...DEVICES[device].unique, ...DEVICES[device].provides]
                      .slice(0, 3)
                      .join(', ')}
                  </Text>
                </View>
                <Feather name="plus" size={18} color={accent} />
              </Pressable>
            ))}
          </View>
        </Block>
      ) : null}

      <AppCard testID="health-device-manual">
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
      </AppCard>
    </>
  );
}

// --- Set Up Health (and onboarding's step) -------------------------------------------------

const SETUP_CHOICES: { key: DeviceKey; title: string; detail: string }[] = [
  { key: 'appleWatch', title: 'Apple Watch', detail: 'Sleep, heart, VO₂ Max' },
  { key: 'oura', title: 'Oura Ring', detail: 'Readiness, sleep, temperature' },
  { key: 'otherWatch', title: 'Another Watch', detail: 'Garmin, Fitbit, WHOOP…' },
  { key: 'iphone', title: 'Just My iPhone', detail: 'Steps and distance' },
];

/** What Health will show for a setup -- the page's sections, each on or off. */
export function sectionsFor(setup: DeviceSetup): { name: string; on: boolean }[] {
  const wearable = hasWearable(setup);
  return [
    { name: 'Training', on: true },
    { name: 'Activity', on: anyDevice(setup) },
    { name: setup.oura ? 'Readiness (Oura)' : 'Recovery signals', on: wearable },
    { name: 'Sleep', on: wearable },
    { name: 'Heart', on: wearable },
  ];
}

/**
 * Set Up Health -- the same three steps from Health (any time, from Devices or the overview) and
 * from onboarding (`onboarding`: a progress line and Skip): what they use; what each brings, its
 * own data marked, with Connect (a preview: nothing is asked of the phone); then what Health will
 * show. Done tailors the preview to the choice.
 */
export function SetupPage({
  setup,
  accent,
  onboarding,
  onDone,
}: PageProps & { onboarding?: boolean; onDone: () => void }) {
  const [step, setStep] = useState<'pick' | 'connect' | 'done'>('pick');
  const [chosen, setChosen] = useState<DeviceSetup>(onboarding ? NO_DEVICES : setup);
  const [none, setNone] = useState(false);
  const [connected, setConnected] = useState<Partial<Record<DeviceKey, boolean>>>({});
  const picked = DEVICE_ORDER.filter((key) => chosen[key]);
  const stepIndex = step === 'pick' ? 0 : step === 'connect' ? 1 : 2;
  const finish = () => {
    setPreviewSetup(none ? NO_DEVICES : chosen);
    onDone();
  };

  return (
    <>
      {onboarding ? (
        <View testID="health-setup-onboarding" style={styles.onboardingHead}>
          <SampleNote />
          <View style={styles.progressTrack}>
            {[0, 1, 2].map((i) => (
              <View
                key={i}
                style={[
                  styles.progressPart,
                  { backgroundColor: i <= stepIndex ? accent : colors.surfaceLift },
                ]}
              />
            ))}
          </View>
        </View>
      ) : null}

      {step === 'pick' ? (
        <>
          <View style={styles.setupIntro}>
            <Text style={styles.setupTitle}>
              {onboarding ? 'Do you use a fitness tracker?' : 'What do you use?'}
            </Text>
            <Text style={styles.secondary}>
              Pick everything you have. Health shows only what your devices measure.
            </Text>
          </View>
          <View style={styles.choiceGrid}>
            {[SETUP_CHOICES.slice(0, 2), SETUP_CHOICES.slice(2, 4)].map((row, r) => (
              <View key={r} style={styles.gridRow}>
                {row.map((choice) => (
                  <ChoiceTile
                    key={choice.key}
                    testID={`health-setup-${choice.key}`}
                    selected={chosen[choice.key]}
                    accessibilityLabel={`${choice.title}. ${choice.detail}`}
                    accentColor={accent}
                    style={styles.choice}
                    onPress={() => {
                      setNone(false);
                      setChosen({ ...chosen, [choice.key]: !chosen[choice.key] });
                    }}
                  >
                    <DeviceIcon device={choice.key} accent={accent} size={36} />
                    <Text style={styles.choiceTitle}>{choice.title}</Text>
                    <Text style={styles.caption}>{choice.detail}</Text>
                  </ChoiceTile>
                ))}
              </View>
            ))}
            <ChoiceTile
              testID="health-setup-none"
              selected={none}
              accessibilityLabel="None of these"
              accentColor={accent}
              onPress={() => {
                setNone(!none);
                setChosen(NO_DEVICES);
              }}
            >
              <Text style={styles.choiceTitle}>None of these</Text>
              <Text style={styles.caption}>Health still uses your workouts and nutrition</Text>
            </ChoiceTile>
          </View>
          <PrimaryButton
            testID="health-setup-continue"
            label="Continue"
            disabled={!none && picked.length === 0}
            onPress={() => setStep(none ? 'done' : 'connect')}
            accentColor={accent}
          />
          {onboarding ? <TextButton label="Skip for Now" onPress={onDone} /> : null}
        </>
      ) : null}

      {step === 'connect' ? (
        <>
          <View style={styles.setupIntro}>
            <Text style={styles.setupTitle}>Connect your devices</Text>
            <Text style={styles.secondary}>
              Each brings its own data. Starred: only that device has it.
            </Text>
          </View>
          {picked.map((device) => (
            <AppCard key={device} testID={`health-setup-connect-${device}`}>
              <View style={styles.block}>
                <View style={styles.deviceHead}>
                  <DeviceIcon device={device} accent={accent} />
                  <View style={styles.flex}>
                    <Text style={styles.rowName}>{DEVICES[device].name}</Text>
                    <Text style={styles.caption}>Through {DEVICES[device].via}</Text>
                  </View>
                  {connected[device] ? <StatusPill state="connected" accent={accent} /> : null}
                </View>
                <DeviceData device={device} accent={accent} />
                {connected[device] ? null : (
                  <SecondaryButton
                    testID={`health-setup-connect-${device}-button`}
                    label={device === 'oura' ? 'Connect Oura' : 'Connect Apple Health'}
                    onPress={() => setConnected({ ...connected, [device]: true })}
                  />
                )}
              </View>
            </AppCard>
          ))}
          <PrimaryButton
            testID="health-setup-next"
            label="Continue"
            onPress={() => setStep('done')}
            accentColor={accent}
          />
        </>
      ) : null}

      {step === 'done' ? (
        <>
          <View style={styles.setupIntro}>
            <Text style={styles.setupTitle}>Your Health page</Text>
            <Text style={styles.secondary}>
              Made for what you use. Change it any time in Devices.
            </Text>
          </View>
          <AppCard testID="health-setup-summary">
            <View>
              {sectionsFor(none ? NO_DEVICES : chosen).map((section, i) => (
                <View key={section.name} style={[styles.historyRow, i > 0 && styles.divider]}>
                  <Text style={[styles.historyValue, !section.on && styles.offText]}>
                    {section.name}
                  </Text>
                  <Feather
                    name={section.on ? 'check' : 'minus'}
                    size={16}
                    color={section.on ? accent : colors.textMuted}
                  />
                </View>
              ))}
            </View>
          </AppCard>
          <PrimaryButton
            testID="health-setup-done"
            label={onboarding ? 'Continue' : 'Done'}
            onPress={finish}
            accentColor={accent}
          />
        </>
      ) : null}
    </>
  );
}

// --- Insights ------------------------------------------------------------------------------

export function InsightsPage({ setup, accent }: PageProps) {
  const insights = insightsFor(setup);
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

export function MetricPage({ setup, accent, metric: key }: PageProps & { metric: MetricKey }) {
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
            <SourceTag source={sourceOf(key, setup)} />
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
    gap: spacing.sm,
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
  offText: {
    color: colors.textMuted,
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
  moreRow: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: spacing.sm,
    paddingHorizontal: spacing.xs,
  },
  moreText: {
    ...typeScale.secondary,
    color: colors.textSecondary,
    flex: 1,
  },
  faded: {
    opacity: 0.5,
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
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
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
  addDevice: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.md,
    minHeight: 60,
    paddingVertical: spacing.sm,
  },
  metricHead: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  onboardingHead: {
    gap: spacing.md,
  },
  progressTrack: {
    flexDirection: 'row',
    gap: spacing.xs,
  },
  progressPart: {
    flex: 1,
    height: 4,
    borderRadius: 2,
  },
  setupIntro: {
    gap: spacing.xs,
    paddingHorizontal: spacing.xs,
  },
  setupTitle: {
    ...typeScale.screenTitle,
    color: colors.textPrimary,
  },
  choiceGrid: {
    gap: widgetGap,
  },
  choice: {
    flex: 1,
    gap: spacing.xs,
    minHeight: 124,
  },
  choiceTitle: {
    ...typeScale.callout,
    fontFamily: fonts.semibold,
    color: colors.textPrimary,
    marginTop: spacing.xs,
  },
});
