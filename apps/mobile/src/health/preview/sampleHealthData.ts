// PHASE 1 PROTOTYPE -- SAMPLE DATA ONLY (Harbir's Health & Wearables brief, 2026-11-27).
//
// Every figure here is invented to show what the Health experience could look like. Nothing is
// read from Apple Health, Oura, the database or anywhere else, and the readiness score is an
// example, not a calculation -- Progresso has no recovery model (that's Phase 6, with its
// methodology approved first). The prototype is shown only in development builds
// (healthPreview.ts).

/**
 * The devices someone can have. Apple Health brings an iPhone's own counts and an Apple Watch's,
 * and what other watch apps (Garmin Connect, Fitbit, WHOOP...) write into it; Oura comes from its
 * own app. Each has its own set of data, and Health shows only what someone's devices give.
 */
export type DeviceKey = 'iphone' | 'appleWatch' | 'oura' | 'otherWatch';

export type DeviceSetup = Record<DeviceKey, boolean>;

export interface DeviceInfo {
  key: DeviceKey;
  name: string;
  /** How it reaches Progresso. */
  via: string;
  icon: 'cellphone' | 'watch' | 'ring' | 'watch-variant';
  /** What it brings. */
  provides: string[];
  /** What only it brings, of the devices here. */
  unique: string[];
}

export const DEVICES: Record<DeviceKey, DeviceInfo> = {
  iphone: {
    key: 'iphone',
    name: 'iPhone',
    via: 'Apple Health',
    icon: 'cellphone',
    provides: ['Steps', 'Distance'],
    unique: [],
  },
  appleWatch: {
    key: 'appleWatch',
    name: 'Apple Watch',
    via: 'Apple Health',
    icon: 'watch',
    provides: [
      'Steps',
      'Active calories',
      'Exercise minutes',
      'Sleep stages',
      'Heart rate',
      'Resting HR',
      'HRV',
      'Blood oxygen',
      'Respiratory rate',
    ],
    unique: ['VO₂ Max', 'Heart rate recovery'],
  },
  oura: {
    key: 'oura',
    name: 'Oura Ring',
    via: 'The Oura app',
    icon: 'ring',
    provides: ['Sleep stages', 'HRV', 'Resting HR', 'Respiratory rate', 'Steps', 'Blood oxygen'],
    unique: ['Readiness score', 'Temperature trend'],
  },
  otherWatch: {
    key: 'otherWatch',
    name: 'Another Watch',
    via: 'Garmin, Fitbit, WHOOP and others, through Apple Health',
    icon: 'watch-variant',
    provides: ['Steps', 'Active calories', 'Sleep', 'Heart rate', 'Resting HR', 'HRV'],
    unique: ['Its own scores, like Body Battery or Strain (a later step)'],
  },
};

export const DEVICE_ORDER: DeviceKey[] = ['iphone', 'appleWatch', 'oura', 'otherWatch'];

export const NO_DEVICES: DeviceSetup = {
  iphone: false,
  appleWatch: false,
  oura: false,
  otherWatch: false,
};

/** A watch or ring: what sleep, heart and recovery need. */
export function hasWearable(setup: DeviceSetup): boolean {
  return setup.appleWatch || setup.oura || setup.otherWatch;
}

export function anyDevice(setup: DeviceSetup): boolean {
  return hasWearable(setup) || setup.iphone;
}

export type HealthSource = DeviceKey | 'progresso' | 'manual';

export const SOURCE_NAMES: Record<HealthSource, string> = {
  iphone: 'iPhone',
  appleWatch: 'Apple Watch',
  oura: 'Oura',
  otherWatch: 'Your watch',
  progresso: 'Progresso',
  manual: 'Logged by you',
};

export type MetricKey =
  | 'hrv'
  | 'restingHr'
  | 'heartRate'
  | 'respiratory'
  | 'bloodOxygen'
  | 'temperature'
  | 'vo2max'
  | 'hrRecovery'
  | 'sleep'
  | 'steps';

/** Whether higher is the better direction for a metric's trend arrow -- or neither. */
type Better = 'higher' | 'lower' | 'neither';

export interface HealthMetric {
  key: MetricKey;
  name: string;
  /** Its short name, for a small tile. */
  short: string;
  unit: string;
  /** The latest value, formatted. */
  value: string;
  /** Against the person's own 30-day average: "+4 ms", "−2 bpm". */
  change: string;
  direction: 'up' | 'down' | 'flat';
  better: Better;
  /** Their usual range, for the detail chart's band. */
  usual: [number, number];
  /** 90 days of values, oldest first (sample). */
  history: number[];
  /** Which devices can give it. */
  sources: DeviceKey[];
  updated: string;
  /** What it is, in two sentences at most. */
  about: string;
  icon: 'activity' | 'heart' | 'wind' | 'droplet' | 'thermometer' | 'trending-up' | 'moon' | 'zap';
}

/** A gentle, repeatable wave around a value: 90 days of sample history. */
function wave(base: number, spread: number, seed: number, days = 90): number[] {
  return Array.from({ length: days }, (_, i) => {
    const v =
      base +
      Math.sin((i + seed) / 4.3) * spread * 0.6 +
      Math.cos((i * 1.7 + seed) / 3.1) * spread * 0.4;
    return Math.round(v * 10) / 10;
  });
}

export const METRICS: Record<MetricKey, HealthMetric> = {
  hrv: {
    key: 'hrv',
    name: 'Heart Rate Variability',
    short: 'HRV',
    unit: 'ms',
    value: '62',
    change: '+4 ms',
    direction: 'up',
    better: 'higher',
    usual: [52, 64],
    history: wave(58, 8, 1),
    sources: ['appleWatch', 'oura', 'otherWatch'],
    updated: 'Today, 6:41 AM',
    about:
      'The small changes in time between heartbeats, measured while you rest. It varies a lot from person to person, so it means most against your own usual range.',
    icon: 'activity',
  },
  restingHr: {
    key: 'restingHr',
    name: 'Resting Heart Rate',
    short: 'Resting HR',
    unit: 'bpm',
    value: '54',
    change: '−2 bpm',
    direction: 'down',
    better: 'lower',
    usual: [53, 58],
    history: wave(56, 3, 7),
    sources: ['appleWatch', 'oura', 'otherWatch'],
    updated: 'Today, 6:41 AM',
    about:
      'Your heart rate at its calmest, usually measured overnight. Sleep, stress, illness and hard training can all nudge it.',
    icon: 'heart',
  },
  heartRate: {
    key: 'heartRate',
    name: 'Heart Rate',
    short: 'Heart Rate',
    unit: 'bpm',
    value: '68',
    change: '+1 bpm',
    direction: 'flat',
    better: 'neither',
    usual: [62, 74],
    history: wave(68, 6, 3),
    sources: ['appleWatch', 'oura', 'otherWatch'],
    updated: 'Today, 11:02 AM',
    about: 'Your average heart rate through the day, from your watch or ring.',
    icon: 'heart',
  },
  respiratory: {
    key: 'respiratory',
    name: 'Respiratory Rate',
    short: 'Respiratory',
    unit: 'br/min',
    value: '14.6',
    change: '−0.2',
    direction: 'flat',
    better: 'neither',
    usual: [14, 15.4],
    history: wave(14.7, 0.6, 5),
    sources: ['appleWatch', 'oura'],
    updated: 'Today, 6:41 AM',
    about: 'How many breaths you take a minute while you sleep. It tends to stay very steady.',
    icon: 'wind',
  },
  bloodOxygen: {
    key: 'bloodOxygen',
    name: 'Blood Oxygen',
    short: 'Blood Oxygen',
    unit: '%',
    value: '97',
    change: 'Steady',
    direction: 'flat',
    better: 'neither',
    usual: [95, 99],
    history: wave(97, 1, 9),
    sources: ['appleWatch', 'oura'],
    updated: 'Today, 6:41 AM',
    about:
      'An estimate of the oxygen in your blood, where your device supports it. Wearables are not medical devices.',
    icon: 'droplet',
  },
  temperature: {
    key: 'temperature',
    name: 'Temperature Trend',
    short: 'Temperature',
    unit: '°C',
    value: '+0.2',
    change: 'vs usual',
    direction: 'up',
    better: 'neither',
    usual: [-0.3, 0.3],
    history: wave(0, 0.3, 11),
    sources: ['oura'],
    updated: 'Today, 6:41 AM',
    about:
      'How your skin temperature overnight compares with your usual -- a change from your own normal, not a body temperature reading.',
    icon: 'thermometer',
  },
  vo2max: {
    key: 'vo2max',
    name: 'VO₂ Max',
    short: 'VO₂ Max',
    unit: 'ml/kg/min',
    value: '47',
    change: '+1',
    direction: 'up',
    better: 'higher',
    usual: [45, 47],
    history: wave(46, 1, 2),
    sources: ['appleWatch'],
    updated: 'Yesterday',
    about:
      'An estimate of your cardio fitness, made by Apple Watch from outdoor walks and runs. An estimate, not a lab test.',
    icon: 'trending-up',
  },
  hrRecovery: {
    key: 'hrRecovery',
    name: 'Heart Rate Recovery',
    short: 'HR Recovery',
    unit: 'bpm',
    value: '28',
    change: '+3 bpm',
    direction: 'up',
    better: 'higher',
    usual: [22, 28],
    history: wave(25, 3, 4),
    sources: ['appleWatch'],
    updated: 'Yesterday',
    about: 'How far your heart rate drops in the minute after a workout ends.',
    icon: 'zap',
  },
  sleep: {
    key: 'sleep',
    name: 'Sleep Duration',
    short: 'Sleep',
    unit: 'h',
    value: '7h 42m',
    change: '+18m',
    direction: 'up',
    better: 'neither',
    usual: [6.8, 7.8],
    history: wave(7.3, 0.6, 6),
    sources: ['appleWatch', 'oura', 'otherWatch'],
    updated: 'Today, 6:41 AM',
    about: 'Time asleep last night, not counting time awake in bed.',
    icon: 'moon',
  },
  steps: {
    key: 'steps',
    name: 'Steps',
    short: 'Steps',
    unit: 'steps',
    value: '8,412',
    change: '+640',
    direction: 'up',
    better: 'neither',
    usual: [6800, 9400],
    history: wave(8000, 1500, 8),
    sources: ['iphone', 'appleWatch', 'oura', 'otherWatch'],
    updated: 'Today, 11:02 AM',
    about: 'Every step your phone, watch or ring counted today.',
    icon: 'activity',
  },
};

/** The metrics someone's devices give -- the only ones Health shows them. */
export function metricsFor(setup: DeviceSetup): MetricKey[] {
  return (Object.keys(METRICS) as MetricKey[]).filter((key) =>
    METRICS[key].sources.some((device) => setup[device]),
  );
}

/**
 * Where a metric comes from for this setup: with more than one device, one is chosen for each --
 * Oura for what it measures overnight, a watch for the day, the phone for steps without a watch --
 * so nothing is counted twice.
 */
export function sourceOf(key: MetricKey, setup: DeviceSetup): DeviceKey | null {
  const has = (device: DeviceKey) => setup[device] && METRICS[key].sources.includes(device);
  const overnight: MetricKey[] = ['hrv', 'restingHr', 'respiratory', 'temperature', 'sleep'];
  const order: DeviceKey[] = overnight.includes(key)
    ? ['oura', 'appleWatch', 'otherWatch', 'iphone']
    : ['appleWatch', 'otherWatch', 'iphone', 'oura'];
  return order.find(has) ?? null;
}

/** Sample sleep: last night, and the six before. */
export const SLEEP = {
  inBed: '8h 10m',
  asleep: '7h 42m',
  efficiency: 94,
  bedtime: '10:52 PM',
  wake: '7:02 AM',
  stages: [
    { key: 'awake', label: 'Awake', minutes: 28 },
    { key: 'rem', label: 'REM', minutes: 98 },
    { key: 'light', label: 'Light', minutes: 261 },
    { key: 'deep', label: 'Deep', minutes: 103 },
  ],
  /** Each of the last 7 nights: bed and wake as hours after 6 PM, and hours asleep. */
  nights: [
    { day: 'Fri', bed: 5.1, wake: 13.0, asleep: 7.2 },
    { day: 'Sat', bed: 5.8, wake: 14.1, asleep: 7.6 },
    { day: 'Sun', bed: 4.6, wake: 12.6, asleep: 7.4 },
    { day: 'Mon', bed: 4.9, wake: 12.8, asleep: 7.1 },
    { day: 'Tue', bed: 5.0, wake: 12.9, asleep: 7.3 },
    { day: 'Wed', bed: 4.8, wake: 12.9, asleep: 7.5 },
    { day: 'Thu', bed: 4.87, wake: 13.03, asleep: 7.7 },
  ],
  consistency: 'Within 25 min of your usual bedtime on 6 of 7 nights',
};

/**
 * Sample activity beyond steps -- distance, and what a watch adds. Steps themselves are never
 * sample: they're Apple Health's (realSteps.ts).
 */
export const ACTIVITY = {
  distance: '6.1 km',
  activeCalories: '486',
  exerciseMinutes: '42',
};

/**
 * Sample readiness: Oura's own score, as the Oura app would give it (sample). Progresso makes no
 * score of its own -- without Oura, Health shows the signals (HRV, resting heart rate, sleep).
 */
export const READINESS = {
  score: 78,
  word: 'Good',
  week: [64, 71, 69, 74, 80, 72, 78],
  weekDays: ['F', 'S', 'S', 'M', 'T', 'W', 'T'],
};

/** Sample training from Progresso itself, the last 4 weeks. */
export const TRAINING = {
  weeks: [
    { label: 'Nov 3', volume: 38200, workouts: 3, sleep: 7.1, hrv: 55 },
    { label: 'Nov 10', volume: 44100, workouts: 4, sleep: 7.0, hrv: 54 },
    { label: 'Nov 17', volume: 41800, workouts: 4, sleep: 7.4, hrv: 58 },
    { label: 'Nov 24', volume: 47600, workouts: 5, sleep: 7.5, hrv: 61 },
  ],
  thisWeek: { workouts: 5, volume: '47,600 kg', sets: 86 },
};

export type InsightTone = 'positive' | 'neutral' | 'watch';

export interface HealthInsight {
  id: string;
  icon: 'moon' | 'heart' | 'trending-up' | 'activity' | 'calendar';
  title: string;
  detail: string;
  tone: InsightTone;
  /** What it's drawn from. */
  basis: string;
  /** It needs a watch or ring (sleep, heart); else it's from Progresso alone. */
  needsWearable: boolean;
}

export const INSIGHTS: HealthInsight[] = [
  {
    id: 'sleep-consistency',
    icon: 'moon',
    title: 'Sleep consistency has improved',
    detail: 'Bedtime within 25 min of usual on 6 of 7 nights, up from 3 last week.',
    tone: 'positive',
    basis: 'Sleep · 14 nights',
    needsWearable: true,
  },
  {
    id: 'rhr-baseline',
    icon: 'heart',
    title: 'Resting heart rate is below your baseline',
    detail: '54 bpm this week, against a 30-day average of 56.',
    tone: 'neutral',
    basis: 'Resting HR · 30 days',
    needsWearable: true,
  },
  {
    id: 'volume-up',
    icon: 'trending-up',
    title: 'Training volume rose this week',
    detail: '47,600 kg over 5 workouts, 14% more than last week.',
    tone: 'neutral',
    basis: 'Your workouts · 2 weeks',
    needsWearable: false,
  },
  {
    id: 'rest-days-sleep',
    icon: 'calendar',
    title: 'Longer sleep after rest days',
    detail:
      'You slept 24 min longer, on average, on nights after rest days. A pattern, not a cause.',
    tone: 'neutral',
    basis: 'Sleep and workouts · 4 weeks',
    needsWearable: true,
  },
  {
    id: 'hrv-dip',
    icon: 'activity',
    title: 'HRV dipped after your heaviest day',
    detail: 'Down 9 ms the morning after Tuesday’s session, back to usual by Thursday.',
    tone: 'watch',
    basis: 'HRV and workouts · 7 days',
    needsWearable: true,
  },
];

/** The insights someone's setup could support. */
export function insightsFor(setup: DeviceSetup): HealthInsight[] {
  return INSIGHTS.filter((insight) => !insight.needsWearable || hasWearable(setup));
}

export type ConnectionState = 'connected' | 'notConnected' | 'syncing' | 'permission' | 'issue';

export const CONNECTION_STATES: { value: ConnectionState; label: string }[] = [
  { value: 'connected', label: 'Connected' },
  { value: 'syncing', label: 'Syncing' },
  { value: 'permission', label: 'Permission' },
  { value: 'issue', label: 'Issue' },
  { value: 'notConnected', label: 'Off' },
];
