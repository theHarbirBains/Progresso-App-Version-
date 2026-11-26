import { Feather } from '@expo/vector-icons';
import { useEffect, useMemo, useState } from 'react';
import { Pressable, ScrollView, StyleSheet, View } from 'react-native';
import { useAuth } from '../auth/AuthProvider';
import {
  CARDIO_INFO,
  cardioDetails,
  cardioName,
  formatKm,
  formatKmh,
  formatRate,
  rateLabel,
  type CardioActivity,
  type CardioRate,
} from '../cardio/cardioActivities';
import { fetchCardioHistory, type CardioHistoryEntry } from '../cardio/cardioQueries';
import { formatMinutes } from '../cardio/workoutTime';
import { AnimatedBar } from '../design/AnimatedBar';
import { EmptyState } from '../design/EmptyState';
import { FilterChips } from '../design/FilterChips';
import { ListRow } from '../design/ListRow';
import { SectionHeader } from '../design/SectionHeader';
import { SegmentedControl } from '../design/SegmentedControl';
import { SkeletonCards } from '../design/Skeleton';
import { StatBlock } from '../design/StatBlock';
import { Text } from '../design/Text';
import { colors, fonts, spacing, typeScale, widgetGap } from '../design/theme';
import {
  activitiesDone,
  bestsOf,
  byActivity,
  CARDIO_RANGES,
  figuresOf,
  inRange,
  rateOf,
  totalsOf,
  trendOf,
  type CardioRange,
  type TrendBucket,
  type TrendPeriod,
} from './cardioProgress';
import { ProgressCardHeader } from './ProgressCardHeader';
import { progressStyles } from './progressStyles';
import { weekLabel } from './WeeklySummaryBlock';

interface Props {
  accentColor: string;
  onAccentColor: string;
  /** Opens the workout a session was in. */
  onOpenWorkout: (workoutId: string) => void;
  now?: () => Date;
}

type ActivityChoice = 'all' | CardioActivity;
type TrendMetric = 'time' | 'distance' | 'sessions' | 'rate';

const WEEKDAYS = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];
const MONTHS = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
const FULL_MONTHS = [
  'January',
  'February',
  'March',
  'April',
  'May',
  'June',
  'July',
  'August',
  'September',
  'October',
  'November',
  'December',
];
/** Sessions listed for a range, the latest first. */
const RECENT_SHOWN = 10;

const RANGE_WORDS: Record<CardioRange, string> = {
  week: 'in the last 7 days',
  month: 'in the last 30 days',
  quarter: 'in the last 3 months',
  all: 'yet',
};

/** "Thu, Nov 12" -- and the year, when it isn't this one. */
function dayName(iso: string, now: Date): string {
  const at = new Date(iso);
  const day = `${WEEKDAYS[at.getDay()]}, ${MONTHS[at.getMonth()]} ${at.getDate()}`;
  return at.getFullYear() === now.getFullYear() ? day : `${day}, ${at.getFullYear()}`;
}

function bucketName(bucket: TrendBucket, period: TrendPeriod, now: Date): string {
  if (period === 'weekly') return bucket.current ? 'This Week' : weekLabel(bucket);
  if (bucket.current) return 'This Month';
  const month = FULL_MONTHS[bucket.start.getMonth()];
  return bucket.start.getFullYear() === now.getFullYear()
    ? month
    : `${month} ${bucket.start.getFullYear()}`;
}

const sessionsText = (n: number) => `${n} ${n === 1 ? 'session' : 'sessions'}`;

/**
 * Progress's Cardio tab: the cardio in the person's finished workouts, worked out from what was
 * saved and nothing else (progress/cardioProgress.ts) -- read each time the tab opens. A range
 * (Week, Month, 3 Months, All Time) and an activity (All, or each one done, the most sessions
 * first) pick what the figures are over: sessions, time and distance; for All, each activity's
 * share; for one activity, its averages -- pace, speed or split as it's told, incline, level,
 * floors, steps, laps, stroke rate, only what it recorded -- its all-time bests, and its latest
 * sessions, each opening its workout. Trends list the last 8 weeks or 6 months as rows with bars,
 * by time, distance, sessions or pace. No line graph, no calories, nothing from lifting.
 */
export function CardioProgressSection({
  accentColor,
  onAccentColor,
  onOpenWorkout,
  now: nowFn = () => new Date(),
}: Props) {
  const { user } = useAuth();
  const userId = user?.id;
  const [records, setRecords] = useState<CardioHistoryEntry[] | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [range, setRange] = useState<CardioRange>('month');
  const [choice, setChoice] = useState<ActivityChoice>('all');
  const [period, setPeriod] = useState<TrendPeriod>('weekly');
  const [metric, setMetric] = useState<TrendMetric>('time');
  const now = nowFn();

  useEffect(() => {
    if (!userId) return;
    let cancelled = false;
    fetchCardioHistory(userId)
      .then((rows) => {
        if (!cancelled) setRecords(rows);
      })
      .catch((err: unknown) => {
        if (!cancelled) setError(err instanceof Error ? err.message : 'Failed to load your cardio');
      });
    return () => {
      cancelled = true;
    };
  }, [userId]);

  const done = useMemo(() => activitiesDone(records ?? []), [records]);
  // Someone who's done one kind is shown it, with its own figures; an activity chosen and then
  // gone (its last session deleted) goes back to All.
  const activity: ActivityChoice =
    done.length === 1 ? done[0] : choice !== 'all' && done.includes(choice) ? choice : 'all';
  const ofActivity = useMemo(
    () => (records ?? []).filter((r) => activity === 'all' || r.activity === activity),
    [records, activity],
  );

  if (error) {
    return (
      <View testID="progress-cardio" style={styles.content}>
        <ProgressCardHeader title="Cardio" />
        <Text testID="progress-cardio-error" style={styles.body}>
          {error}
        </Text>
      </View>
    );
  }
  if (records === null) {
    return <SkeletonCards testID="progress-cardio-loading" heights={[96, 220, 160]} />;
  }
  if (records.length === 0) {
    return (
      <View testID="progress-cardio" style={styles.content}>
        <ProgressCardHeader title="Cardio" subtitle="From the cardio in your workouts" />
        <EmptyState
          testID="progress-cardio-empty"
          icon={<Feather name="activity" size={22} color={colors.textMuted} />}
          title="No cardio yet"
          description="Add a run, a ride or the treadmill to any workout, and your sessions, time, distance and pace show here, week by week."
        />
      </View>
    );
  }

  const shown = inRange(ofActivity, range, now);
  const totals = totalsOf(shown);
  const rate: CardioRate | null = activity === 'all' ? null : rateOf(activity);
  const hasDistance = ofActivity.some((r) => r.distanceM !== null);
  const trend = trendOf(ofActivity, period, now);
  const hasSpeed = rate !== null && trend.some((bucket) => bucket.speedKmh !== null);
  const metrics: { label: string; value: TrendMetric }[] = [
    { label: 'Time', value: 'time' },
    ...(hasDistance ? [{ label: 'Distance', value: 'distance' as const }] : []),
    { label: 'Sessions', value: 'sessions' },
    ...(rate && hasSpeed ? [{ label: rateLabel(rate), value: 'rate' as const }] : []),
  ];
  const trendMetric = metrics.some((m) => m.value === metric) ? metric : 'time';
  const activityName = activity === 'all' ? 'cardio' : CARDIO_INFO[activity].label;

  return (
    <ScrollView
      keyboardDismissMode="on-drag"
      testID="progress-cardio"
      style={progressStyles.sectionFill}
      contentContainerStyle={styles.content}
      showsVerticalScrollIndicator={false}
    >
      <ProgressCardHeader title="Cardio" subtitle="From the cardio in your workouts" />
      <SegmentedControl
        testID="progress-cardio-range"
        options={CARDIO_RANGES.map(({ label, value }) => ({ label, value }))}
        value={range}
        onChange={setRange}
        accentColor={accentColor}
        onAccentColor={onAccentColor}
      />
      {done.length > 1 ? (
        <View>
          <FilterChips<ActivityChoice>
            testID="progress-cardio-activity"
            options={[
              { value: 'all', label: 'All' },
              ...done.map((value) => ({ value, label: CARDIO_INFO[value].label })),
            ]}
            value={activity}
            onChange={setChoice}
            accentColor={accentColor}
            onAccentColor={onAccentColor}
          />
        </View>
      ) : null}

      <View style={styles.figures}>
        <StatBlock
          testID="progress-cardio-sessions"
          value={String(totals.sessions)}
          label={totals.sessions === 1 ? 'Session' : 'Sessions'}
          valueColor={accentColor}
        />
        <StatBlock
          testID="progress-cardio-time"
          value={formatMinutes(totals.seconds)}
          label="Time"
        />
        {totals.withDistance > 0 ? (
          <StatBlock
            testID="progress-cardio-distance"
            value={formatKm(totals.distanceM)}
            label="Distance"
          />
        ) : null}
      </View>
      {shown.length === 0 ? (
        <Text testID="progress-cardio-none" style={styles.body}>
          No {activityName} {RANGE_WORDS[range]}.
        </Text>
      ) : null}

      {activity === 'all' && shown.length > 0 ? (
        <ActivityShares
          shares={byActivity(shown)}
          accentColor={accentColor}
          onOpen={(value) => setChoice(value)}
        />
      ) : null}

      {activity !== 'all' && shown.length > 0 ? (
        <Averages records={shown} activity={activity} />
      ) : null}

      <View style={styles.part}>
        <SectionHeader label="Trends" />
        <View style={styles.controls}>
          <SegmentedControl
            testID="progress-cardio-period"
            options={[
              { label: 'Weekly', value: 'weekly' },
              { label: 'Monthly', value: 'monthly' },
            ]}
            value={period}
            onChange={setPeriod}
            accentColor={accentColor}
            onAccentColor={onAccentColor}
          />
          <SegmentedControl
            testID="progress-cardio-metric"
            options={metrics}
            value={trendMetric}
            onChange={setMetric}
            accentColor={accentColor}
            onAccentColor={onAccentColor}
          />
        </View>
        {trendMetric === 'rate' ? (
          <Text style={styles.caption}>The longer the bar, the faster — against your fastest.</Text>
        ) : null}
        <TrendRows
          buckets={trend}
          period={period}
          metric={trendMetric}
          rate={rate}
          now={now}
          accentColor={accentColor}
        />
      </View>

      {activity !== 'all' ? <Bests records={ofActivity} activity={activity} now={now} /> : null}

      {shown.length > 0 ? (
        <View style={styles.part}>
          <SectionHeader label="Recent Sessions" />
          {[...shown]
            .reverse()
            .slice(0, RECENT_SHOWN)
            .map((record, index) => (
              <ListRow
                key={record.id}
                testID={`progress-cardio-session-${record.id}`}
                title={cardioName(record)}
                subtitle={cardioDetails(record)}
                detail={dayName(record.performedAt, now)}
                onPress={() => onOpenWorkout(record.workoutId)}
                divider={index > 0}
              />
            ))}
          {shown.length > RECENT_SHOWN ? (
            <Text style={styles.caption}>
              The latest {RECENT_SHOWN} of {shown.length}.
            </Text>
          ) : null}
        </View>
      ) : null}
    </ScrollView>
  );
}

/** For All: each activity's time, sessions and distance, with a bar of the way to the most. */
function ActivityShares({
  shares,
  accentColor,
  onOpen,
}: {
  shares: ReturnType<typeof byActivity>;
  accentColor: string;
  onOpen: (activity: CardioActivity) => void;
}) {
  const most = Math.max(...shares.map((share) => share.seconds));
  return (
    <View style={styles.part}>
      <SectionHeader label="By Activity" />
      {shares.map((share) => {
        const caption = [
          sessionsText(share.sessions),
          ...(share.withDistance > 0 ? [formatKm(share.distanceM)] : []),
        ].join(' · ');
        return (
          <BarRow
            key={share.activity}
            testID={`progress-cardio-share-${share.activity}`}
            label={CARDIO_INFO[share.activity].label}
            caption={caption}
            value={formatMinutes(share.seconds)}
            fraction={most > 0 ? share.seconds / most : 0}
            accentColor={accentColor}
            onPress={() => onOpen(share.activity)}
          />
        );
      })}
    </View>
  );
}

/** One activity's averages over the range: only what its sessions recorded. */
function Averages({
  records,
  activity,
}: {
  records: CardioHistoryEntry[];
  activity: CardioActivity;
}) {
  const figures = figuresOf(records);
  const { rate, levelLabel } = CARDIO_INFO[activity];
  const rows: { key: string; label: string; value: string }[] = [];
  if (figures.averageSeconds !== null) {
    rows.push({ key: 'time', label: 'Avg time', value: formatMinutes(figures.averageSeconds) });
  }
  if (figures.averageDistanceM !== null) {
    rows.push({
      key: 'distance',
      label: 'Avg distance',
      value: formatKm(figures.averageDistanceM),
    });
  }
  if (figures.averageSpeedKmh !== null) {
    const told = rate && rate !== 'speed' ? formatRate(figures.averageSpeedKmh, rate) : null;
    if (rate && told) {
      rows.push({ key: 'rate', label: `Avg ${rateLabel(rate).toLowerCase()}`, value: told });
    }
    rows.push({ key: 'speed', label: 'Avg speed', value: formatKmh(figures.averageSpeedKmh) });
  }
  if (figures.averageSpeedSetting !== null) {
    rows.push({
      key: 'setting',
      label: 'Avg machine speed',
      value: String(Number(figures.averageSpeedSetting.toFixed(1))),
    });
  }
  if (figures.averageIncline !== null) {
    rows.push({
      key: 'incline',
      label: 'Avg incline',
      value: `${Number(figures.averageIncline.toFixed(1))}%`,
    });
  }
  if (figures.averageLevel !== null) {
    rows.push({
      key: 'level',
      label: `Avg ${levelLabel.toLowerCase()}`,
      value: String(Number(figures.averageLevel.toFixed(1))),
    });
  }
  if (figures.averageStrokeRate !== null) {
    rows.push({
      key: 'strokes',
      label: 'Avg stroke rate',
      value: `${Math.round(figures.averageStrokeRate)} spm`,
    });
  }
  if (figures.floors !== null) {
    rows.push({ key: 'floors', label: 'Floors', value: figures.floors.toLocaleString('en-US') });
  }
  if (figures.steps !== null) {
    rows.push({ key: 'steps', label: 'Steps', value: figures.steps.toLocaleString('en-US') });
  }
  if (figures.laps !== null) {
    rows.push({ key: 'laps', label: 'Laps', value: figures.laps.toLocaleString('en-US') });
  }
  return (
    <View style={styles.part}>
      <SectionHeader label="Averages" />
      {rows.map((row) => (
        <FigureRow
          key={row.key}
          testID={`progress-cardio-avg-${row.key}`}
          label={row.label}
          value={row.value}
        />
      ))}
    </View>
  );
}

/** One activity's all-time bests: its longest session, farthest and fastest. */
function Bests({
  records,
  activity,
  now,
}: {
  records: CardioHistoryEntry[];
  activity: CardioActivity;
  now: Date;
}) {
  const { longest, farthest, fastest } = bestsOf(records);
  const rate = rateOf(activity);
  const rows: { key: string; label: string; value: string; when: string }[] = [];
  if (longest) {
    rows.push({
      key: 'longest',
      label: 'Longest',
      value: formatMinutes(longest.durationSeconds),
      when: dayName(longest.performedAt, now),
    });
  }
  if (farthest && farthest.distanceM !== null) {
    rows.push({
      key: 'farthest',
      label: 'Farthest',
      value: formatKm(farthest.distanceM),
      when: dayName(farthest.performedAt, now),
    });
  }
  if (fastest) {
    const value = rate ? formatRate(fastest.speedKmh, rate) : formatKmh(fastest.speedKmh);
    if (value) {
      rows.push({
        key: 'fastest',
        label: rate && rate !== 'speed' ? `Best ${rateLabel(rate).toLowerCase()}` : 'Fastest',
        value,
        when: dayName(fastest.record.performedAt, now),
      });
    }
  }
  if (rows.length === 0) return null;
  return (
    <View style={styles.part}>
      <SectionHeader label="All-Time Bests" />
      {rows.map((row) => (
        <FigureRow
          key={row.key}
          testID={`progress-cardio-best-${row.key}`}
          label={row.label}
          caption={row.when}
          value={row.value}
        />
      ))}
    </View>
  );
}

function TrendRows({
  buckets,
  period,
  metric,
  rate,
  now,
  accentColor,
}: {
  buckets: TrendBucket[];
  period: TrendPeriod;
  metric: TrendMetric;
  rate: CardioRate | null;
  now: Date;
  accentColor: string;
}) {
  const amount = (bucket: TrendBucket) =>
    metric === 'time'
      ? bucket.seconds
      : metric === 'distance'
        ? bucket.distanceM
        : metric === 'sessions'
          ? bucket.sessions
          : (bucket.speedKmh ?? 0);
  const most = Math.max(...buckets.map(amount));
  return (
    <View>
      {buckets.map((bucket) => {
        const value =
          metric === 'time'
            ? formatMinutes(bucket.seconds)
            : metric === 'distance'
              ? formatKm(bucket.distanceM)
              : metric === 'sessions'
                ? String(bucket.sessions)
                : bucket.speedKmh !== null && rate
                  ? (formatRate(bucket.speedKmh, rate) ?? '—')
                  : '—';
        // What the value doesn't already say.
        const distance = bucket.withDistance > 0 ? formatKm(bucket.distanceM) : null;
        const parts =
          metric === 'distance'
            ? [sessionsText(bucket.sessions), formatMinutes(bucket.seconds)]
            : metric === 'sessions'
              ? [formatMinutes(bucket.seconds), distance]
              : [sessionsText(bucket.sessions), distance];
        const caption =
          bucket.sessions === 0
            ? 'Nothing logged'
            : parts.filter((part): part is string => part !== null).join(' · ');
        return (
          <BarRow
            key={bucket.start.toISOString()}
            testID={bucket.current ? 'progress-cardio-trend-current' : 'progress-cardio-trend'}
            label={bucketName(bucket, period, now)}
            caption={caption}
            value={value}
            fraction={most > 0 ? amount(bucket) / most : 0}
            accentColor={accentColor}
          />
        );
      })}
    </View>
  );
}

/** A row like the Steps tab's: a label over a caption, a mono value, and a bar under them. */
function BarRow({
  label,
  caption,
  value,
  fraction,
  accentColor,
  onPress,
  testID,
}: {
  label: string;
  caption: string;
  value: string;
  fraction: number;
  accentColor: string;
  onPress?: () => void;
  testID: string;
}) {
  const body = (
    <>
      <View style={styles.rowLine}>
        <View style={styles.rowText}>
          <Text style={styles.rowLabel}>{label}</Text>
          <Text style={styles.caption}>{caption}</Text>
        </View>
        <Text style={styles.rowValue}>{value}</Text>
      </View>
      <AnimatedBar fraction={fraction} color={accentColor} />
    </>
  );
  return onPress ? (
    <Pressable
      testID={testID}
      onPress={onPress}
      accessibilityRole="button"
      accessibilityLabel={`${label}, ${value}, ${caption}`}
      style={({ pressed }) => [styles.row, pressed && styles.pressed]}
    >
      {body}
    </Pressable>
  ) : (
    <View
      testID={testID}
      style={styles.row}
      accessible
      accessibilityLabel={`${label}, ${value}, ${caption}`}
    >
      {body}
    </View>
  );
}

/** A label (and a quiet line under it) with its figure: an average or a best. */
function FigureRow({
  label,
  caption,
  value,
  testID,
}: {
  label: string;
  caption?: string;
  value: string;
  testID: string;
}) {
  return (
    <View
      testID={testID}
      style={styles.figureRow}
      accessible
      accessibilityLabel={`${label}: ${value}${caption ? `, ${caption}` : ''}`}
    >
      <View style={styles.rowText}>
        <Text style={styles.figureLabel}>{label}</Text>
        {caption ? <Text style={styles.caption}>{caption}</Text> : null}
      </View>
      <Text style={styles.rowValue}>{value}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  content: {
    gap: spacing.md,
    paddingBottom: spacing.xxxl,
  },
  figures: {
    flexDirection: 'row',
    gap: widgetGap,
  },
  part: {
    marginTop: spacing.md,
  },
  controls: {
    gap: spacing.sm,
    marginBottom: spacing.xs,
  },
  row: {
    paddingVertical: spacing.sm,
  },
  pressed: {
    opacity: 0.7,
  },
  rowLine: {
    flexDirection: 'row',
    alignItems: 'flex-end',
    justifyContent: 'space-between',
    gap: spacing.sm,
    marginBottom: 6,
  },
  rowText: {
    flex: 1,
  },
  rowLabel: {
    ...typeScale.callout,
    fontFamily: fonts.semibold,
    color: colors.textPrimary,
  },
  rowValue: {
    ...typeScale.statSmall,
    color: colors.textPrimary,
  },
  figureRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: spacing.sm,
    paddingVertical: spacing.sm,
    borderTopWidth: StyleSheet.hairlineWidth,
    borderTopColor: colors.divider,
  },
  figureLabel: {
    ...typeScale.secondary,
    color: colors.textSecondary,
  },
  body: {
    ...typeScale.secondary,
    color: colors.textSecondary,
  },
  caption: {
    ...typeScale.caption,
    color: colors.textMuted,
    marginTop: 2,
  },
});
