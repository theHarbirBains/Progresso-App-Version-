// SAMPLE DATA for the iPhone-only Health prototype (Harbir's brief, 2026-11-27): what an iPhone
// measures by itself, with no watch or ring -- activity (steps, walking and running distance,
// flights climbed) and how someone walks (walking speed, steadiness, asymmetry, double support
// time). Nothing here is read from Apple Health; every figure is illustrative. No sleep and no
// heart: an iPhone alone can't measure them reliably.

export type HealthPeriod = 'day' | 'week' | 'month';

/** What the prototype pretends: everything in, some of it not measured yet, or nothing at all. */
export type IPhonePreviewState = 'all' | 'someMissing' | 'nothing';

export type MetricKey =
  'steps' | 'distance' | 'flights' | 'walkingSpeed' | 'steadiness' | 'asymmetry' | 'doubleSupport';

export interface MetricInfo {
  name: string;
  /** One short line on what it is -- mobility only, where the name alone doesn't say. */
  what?: string;
  unit: string;
  icon: 'activity' | 'map-pin' | 'trending-up' | 'navigation' | 'anchor' | 'git-commit' | 'pause';
  /** Decimal places shown. */
  digits: number;
}

export const METRIC_INFO: Record<MetricKey, MetricInfo> = {
  steps: { name: 'Steps', unit: 'steps', icon: 'activity', digits: 0 },
  distance: { name: 'Walking + Running', unit: 'km', icon: 'map-pin', digits: 1 },
  flights: { name: 'Flights Climbed', unit: 'flights', icon: 'trending-up', digits: 0 },
  walkingSpeed: {
    name: 'Walking Speed',
    what: 'Your usual pace on flat ground',
    unit: 'km/h',
    icon: 'navigation',
    digits: 1,
  },
  steadiness: {
    name: 'Walking Steadiness',
    what: 'Your balance as you walk',
    unit: '',
    icon: 'anchor',
    digits: 0,
  },
  asymmetry: {
    name: 'Walking Asymmetry',
    what: 'Steps faster on one side',
    unit: '%',
    icon: 'git-commit',
    digits: 1,
  },
  doubleSupport: {
    name: 'Double Support Time',
    what: 'Time with both feet down',
    unit: '%',
    icon: 'pause',
    digits: 1,
  },
};

/** A change against the period before -- never judged as good or bad. */
export interface Change {
  direction: 'up' | 'down' | 'same';
  text: string;
}

/** One metric over one period: its figure, its chart, and how it compares. */
export interface PeriodFigures {
  /** The day's figure, or the period's daily average; null when it wasn't measured. */
  value: number | null;
  /** A total for the period, where one means something (steps this week). */
  total?: number;
  /** The chart's columns, oldest first. */
  chart: number[];
  /** Under the chart: its start, middle and end. */
  axis: [string, string, string];
  /** Their usual range, in the metric's unit (mobility). */
  usual?: [number, number];
  change: Change | null;
  /** Why there's no figure, when there isn't one. */
  missing?: string;
}

export const PERIOD_CAPTION: Record<HealthPeriod, string> = {
  day: 'Today',
  week: 'Last 7 days · daily average',
  month: 'Last 30 days · daily average',
};

const DAY_AXIS: [string, string, string] = ['6 AM', '2 PM', '10 PM'];
const WEEK_AXIS: [string, string, string] = ['Sat', 'Tue', 'Today'];
const MONTH_AXIS: [string, string, string] = ['Oct 29', 'Nov 13', 'Today'];
const WEEKS_AXIS: [string, string, string] = ['4 wks ago', '', 'This week'];

const STEPS_HOURLY = [
  80, 420, 910, 380, 210, 640, 1120, 300, 260, 410, 980, 1420, 380, 260, 220, 170, 252,
];
const STEPS_WEEK = [9120, 11840, 6230, 7410, 8960, 7050, 8412];
const STEPS_MONTH = [
  7210, 8840, 10120, 6420, 7980, 9310, 11240, 8020, 7650, 6890, 9410, 10380, 7020, 8150, 8760, 9940,
  6310, 7580, 8890, 12010, 9120, 11840, 6230, 7410, 8960, 7050, 9230, 8640, 7770, 8412,
];

function average(values: number[]): number {
  return values.reduce((sum, v) => sum + v, 0) / values.length;
}

function sum(values: number[]): number {
  return values.reduce((total, v) => total + v, 0);
}

/** Every metric's figures, as each preview state shows them. */
export function sampleFigures(
  metric: MetricKey,
  period: HealthPeriod,
  state: IPhonePreviewState,
): PeriodFigures {
  const figures = SAMPLE[metric][period];
  const missing = state === 'someMissing' ? MISSING[metric]?.[period] : undefined;
  return missing ? { ...figures, value: null, change: null, missing } : figures;
}

const SAMPLE: Record<MetricKey, Record<HealthPeriod, PeriodFigures>> = {
  steps: {
    day: {
      value: sum(STEPS_HOURLY),
      chart: STEPS_HOURLY,
      axis: DAY_AXIS,
      change: { direction: 'up', text: '640 more than usual' },
    },
    week: {
      value: Math.round(average(STEPS_WEEK)),
      total: sum(STEPS_WEEK),
      chart: STEPS_WEEK,
      axis: WEEK_AXIS,
      change: { direction: 'up', text: '4% on the 7 days before' },
    },
    month: {
      value: Math.round(average(STEPS_MONTH)),
      total: sum(STEPS_MONTH),
      chart: STEPS_MONTH,
      axis: MONTH_AXIS,
      change: { direction: 'down', text: '2% on the 30 days before' },
    },
  },
  distance: {
    day: {
      value: 6.1,
      chart: STEPS_HOURLY.map((s) => s * 0.00072),
      axis: DAY_AXIS,
      change: { direction: 'up', text: '0.4 km more than usual' },
    },
    week: {
      value: 6.4,
      chart: [6.6, 8.5, 4.5, 5.3, 6.4, 5.1, 6.1],
      axis: WEEK_AXIS,
      change: { direction: 'up', text: '3% on the week before' },
    },
    month: {
      value: 6.2,
      chart: STEPS_MONTH.map((s) => s * 0.00073),
      axis: MONTH_AXIS,
      change: { direction: 'same', text: 'Level with the month before' },
    },
  },
  flights: {
    day: {
      value: 12,
      chart: [0, 1, 2, 0, 0, 1, 3, 0, 0, 1, 2, 1, 0, 1, 0, 0, 0],
      axis: DAY_AXIS,
      change: { direction: 'up', text: '3 more than usual' },
    },
    week: {
      value: 9,
      chart: [8, 14, 4, 7, 11, 6, 12],
      axis: WEEK_AXIS,
      change: { direction: 'down', text: '1 fewer a day' },
    },
    month: {
      value: 10,
      chart: [
        9, 11, 7, 12, 8, 10, 13, 9, 6, 11, 10, 8, 12, 9, 7, 10, 14, 9, 8, 11, 8, 14, 4, 7, 11, 6,
        10, 9, 8, 12,
      ],
      axis: MONTH_AXIS,
      change: { direction: 'same', text: 'Level with the month before' },
    },
  },
  walkingSpeed: {
    day: {
      value: 4.8,
      chart: [],
      axis: DAY_AXIS,
      usual: [4.5, 5.1],
      change: { direction: 'same', text: 'Within your usual' },
    },
    week: {
      value: 4.8,
      chart: [4.7, 4.9, 4.6, 4.8, 5.0, 4.7, 4.8],
      axis: WEEK_AXIS,
      usual: [4.5, 5.1],
      change: { direction: 'up', text: '0.1 km/h on the week before' },
    },
    month: {
      value: 4.7,
      chart: [4.6, 4.7, 4.8, 4.8],
      axis: WEEKS_AXIS,
      usual: [4.5, 5.1],
      change: { direction: 'same', text: 'Level with the month before' },
    },
  },
  steadiness: {
    // Apple's own classification (OK, Low, Very Low), worked out about once a week.
    day: { value: 92, chart: [], axis: DAY_AXIS, change: null },
    week: { value: 92, chart: [], axis: DAY_AXIS, change: null },
    month: { value: 91, chart: [], axis: DAY_AXIS, change: null },
  },
  asymmetry: {
    day: {
      value: 2.1,
      chart: [],
      axis: DAY_AXIS,
      usual: [1.0, 3.0],
      change: { direction: 'same', text: 'Within your usual' },
    },
    week: {
      value: 2.1,
      chart: [1.8, 2.4, 2.0, 1.6, 2.2, 2.5, 2.1],
      axis: WEEK_AXIS,
      usual: [1.0, 3.0],
      change: { direction: 'down', text: '0.2 points on the week before' },
    },
    month: {
      value: 2.1,
      chart: [2.3, 2.1, 2.0, 2.1],
      axis: WEEKS_AXIS,
      usual: [1.0, 3.0],
      change: { direction: 'same', text: 'Level with the month before' },
    },
  },
  doubleSupport: {
    day: {
      value: 27.4,
      chart: [],
      axis: DAY_AXIS,
      usual: [26, 29],
      change: { direction: 'same', text: 'Within your usual' },
    },
    week: {
      value: 27.4,
      chart: [27.9, 27.1, 28.2, 27.6, 26.8, 27.0, 27.4],
      axis: WEEK_AXIS,
      usual: [26, 29],
      change: { direction: 'down', text: '0.3 points on the week before' },
    },
    month: {
      value: 27.5,
      chart: [27.8, 27.5, 27.3, 27.4],
      axis: WEEKS_AXIS,
      usual: [26, 29],
      change: { direction: 'same', text: 'Level with the month before' },
    },
  },
};

// What "Some missing" leaves out, and why -- shown in the metric's place, never as a 0.
const MISSING: Partial<Record<MetricKey, Partial<Record<HealthPeriod, string>>>> = {
  steadiness: {
    day: 'Needs a few days of walking with your iPhone in a pocket',
    week: 'Needs a few days of walking with your iPhone in a pocket',
    month: 'Needs a few days of walking with your iPhone in a pocket',
  },
  asymmetry: { day: 'Not measured yet today' },
  doubleSupport: { day: 'Not measured yet today' },
};

/** Walking steadiness: Apple's three levels, lowest first. */
export const STEADINESS_LEVELS = ['Very Low', 'Low', 'OK'] as const;

/** Which level a steadiness score is in (sample thresholds, for the prototype). */
export function steadinessLevel(score: number): (typeof STEADINESS_LEVELS)[number] {
  if (score < 20) return 'Very Low';
  if (score < 40) return 'Low';
  return 'OK';
}

/** When steadiness was last worked out -- about once a week. */
export const STEADINESS_UPDATED = 'Updated Monday';
