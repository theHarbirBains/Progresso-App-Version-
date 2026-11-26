import { useCallback, useEffect, useMemo, useState } from 'react';
import { ScrollView, StyleSheet, TouchableOpacity, View } from 'react-native';
import { Feather } from '@expo/vector-icons';
import { useAuth } from '../auth/AuthProvider';
import { ErrorState } from '../design/ErrorState';
import { ListRow } from '../design/ListRow';
import { SegmentedControl } from '../design/SegmentedControl';
import { SkeletonCards } from '../design/Skeleton';
import { StatBlock } from '../design/StatBlock';
import { Text } from '../design/Text';
import { colors, fonts, radii, spacing, typeScale, widgetGap } from '../design/theme';
import { loadBuiltinExtras } from '../exercises/builtinExtras';
// Plugs the built-in extras' reads in, for the muscles each built-in also works.
import '../exercises/exerciseGuide';
import { sideOf } from '../exercises/illustrations/muscleMap';
import { MATERIALS } from '../exercises/illustrations/palette';
import { MUSCLE_GROUP_LABELS, type MuscleGroup } from '../exercises/muscleGroups';
import { fromKg } from '../lib/units';
import { levelColors, MuscleActivityFigure, type FigureSide } from './MuscleActivityFigure';
import {
  ACTIVITY_LEVEL_LABELS,
  ACTIVITY_LEVEL_NOTES,
  ACTIVITY_LEVELS,
  ACTIVITY_PERIODS,
  lessTrained,
  muscleActivity,
  periodStart,
  sinceText,
  type ActivityPeriod,
  type GroupActivity,
} from './muscleActivity';
import { fetchMuscleActivity, type ActivityEntry } from './muscleActivityQueries';
import { ProgressCardHeader } from './ProgressCardHeader';
import { formatVolume } from '../workouts/workoutSummary';

const FIGURE_HEIGHT = 320;
/** How many of the least-trained groups the page points out. */
const LESS_TRAINED_SHOWN = 4;
/** How many of a group's exercises its card lists. */
const EXERCISES_SHOWN = 5;

/** A level's swatch: its colour, or the figure's grey with an outline for none. */
function Swatch({ color }: { color: string | null }) {
  return (
    <View
      style={[styles.swatch, color ? { backgroundColor: color } : styles.swatchNone]}
      importantForAccessibility="no"
    />
  );
}

/** "12 sets · 3 sessions" -- what a row says it was. */
function setsLine(group: GroupActivity): string {
  if (group.sets === 0 && group.secondarySets === 0) return 'Nothing logged';
  if (group.sets === 0) {
    return `Only as a muscle it also works · ${group.secondarySets} ${
      group.secondarySets === 1 ? 'set' : 'sets'
    }`;
  }
  return `${group.sets} ${group.sets === 1 ? 'set' : 'sets'} · ${group.sessions} ${
    group.sessions === 1 ? 'session' : 'sessions'
  }`;
}

/** Each bucket's working sets as a small bar, oldest first, the busiest full height. */
function TrendBars({
  group,
  period,
  accentColor,
}: {
  group: GroupActivity;
  period: ActivityPeriod;
  accentColor: string;
}) {
  const most = Math.max(1, ...group.trend.map((bucket) => bucket.sets));
  const first = group.trend[0]?.start;
  const label = (start: Date) =>
    period === 7
      ? start.toLocaleDateString(undefined, { weekday: 'narrow' })
      : start.toLocaleDateString(undefined, { month: 'short', day: 'numeric' });
  return (
    <View
      testID="muscle-activity-trend"
      accessible
      accessibilityLabel={`Sets ${period === 7 ? 'each day' : 'each week'}: ${group.trend
        .map((bucket) => `${label(bucket.start)}, ${bucket.sets}`)
        .join('; ')}`}
    >
      <View style={styles.bars}>
        {group.trend.map((bucket) => (
          <View key={bucket.start.toISOString()} style={styles.barSlot}>
            <View
              style={[
                styles.bar,
                {
                  height: bucket.sets === 0 ? 2 : Math.max(4, (bucket.sets / most) * 56),
                  backgroundColor: bucket.sets === 0 ? colors.border : accentColor,
                },
              ]}
            />
          </View>
        ))}
      </View>
      <View style={styles.barLabels}>
        <Text style={styles.barLabel}>{first ? label(first) : ''}</Text>
        <Text style={styles.barLabel}>{period === 7 ? 'Today' : 'This week'}</Text>
      </View>
    </View>
  );
}

/**
 * Progress's Muscles tab -- Muscle Activity: which muscle groups have been trained lately, from the
 * sets logged -- never a recovery figure. 7, 30 or 90 days; the anatomy figure from the front or
 * behind, each muscle coloured by its group's level (recently, frequently, less, or not trained),
 * a tap on a muscle -- or its row -- showing that group: its sets, sessions, volume, when it was
 * last trained, how it went week by week and the exercises behind it. The groups trained least are
 * pointed out, never judged. The person's own workouts only, read each time the tab opens (the
 * last 90 days, one read), so a workout finished one hop away is in it.
 */
export function MuscleActivitySection({
  accentColor,
  onAccentColor,
  weightUnit,
  onOpenExercise,
}: {
  accentColor: string;
  onAccentColor: string;
  weightUnit: 'kg' | 'lb';
  onOpenExercise: (exerciseId: string, exerciseName: string) => void;
}) {
  const { user } = useAuth();
  const userId = user?.id ?? '';
  const [period, setPeriod] = useState<ActivityPeriod>(30);
  const [side, setSide] = useState<FigureSide>('front');
  const [selected, setSelected] = useState<MuscleGroup | null>(null);
  const [read, setRead] = useState<{
    entries: ActivityEntry[];
    secondary: Map<string, readonly MuscleGroup[]>;
    at: Date;
  } | null>(null);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(async () => {
    if (!userId) return;
    setError(null);
    try {
      const at = new Date();
      const [entries, extras] = await Promise.all([
        fetchMuscleActivity(userId, periodStart(90, at)),
        loadBuiltinExtras(),
      ]);
      const secondary = new Map<string, readonly MuscleGroup[]>();
      extras.forEach((extra, id) => secondary.set(id, extra.secondaryMuscleGroups));
      setRead({ entries, secondary, at });
    } catch (err) {
      setError(err instanceof Error ? err.message : "Couldn't load your training.");
    }
  }, [userId]);

  // Read as the tab opens (it's drawn afresh each time it's chosen).
  useEffect(() => {
    void load();
  }, [load]);

  const activity = useMemo(
    () =>
      read
        ? muscleActivity(read.entries, period, read.at, (id) => read.secondary.get(id) ?? [])
        : null,
    [read, period],
  );
  const palette = useMemo(() => levelColors(accentColor), [accentColor]);

  const choose = (group: MuscleGroup) => {
    setSelected((current) => (current === group ? null : group));
    // A group chosen from a list turns the figure to the side that shows it.
    setSide(sideOf(group));
  };

  if (!activity && !error) {
    return <SkeletonCards testID="muscle-activity-loading" heights={[44, 380, 168]} />;
  }

  if (!activity) {
    return (
      <ErrorState
        testID="muscle-activity-error"
        message={error ?? "Couldn't load your training."}
        onRetry={() => void load()}
      />
    );
  }

  const chosen = selected ? activity.find((group) => group.group === selected) : undefined;
  const fewest = lessTrained(activity).slice(0, LESS_TRAINED_SHOWN);
  const anything = activity.some((group) => group.level !== 'none');
  const now = read!.at;
  const days = `${period} days`;

  return (
    <ScrollView
      keyboardDismissMode="on-drag"
      testID="muscle-activity-scroll"
      style={styles.fill}
      contentContainerStyle={styles.content}
      showsVerticalScrollIndicator={false}
    >
      <SegmentedControl<`${ActivityPeriod}`>
        testID="muscle-activity-period"
        options={ACTIVITY_PERIODS.map((value) => ({
          value: `${value}`,
          label: `${value} Days`,
        }))}
        value={`${period}`}
        onChange={(value) => setPeriod(Number(value) as ActivityPeriod)}
        accentColor={accentColor}
        onAccentColor={onAccentColor}
        stretch
      />

      <View testID="muscle-activity-map" style={styles.block}>
        <ProgressCardHeader
          title="Your Muscles"
          subtitle={
            anything
              ? `What you've trained in the last ${days}. Tap a muscle.`
              : `Nothing logged in the last ${days} yet.`
          }
        />
        <View style={styles.sideRow}>
          <SegmentedControl<FigureSide>
            testID="muscle-activity-side"
            options={[
              { value: 'front', label: 'Front' },
              { value: 'back', label: 'Back' },
            ]}
            value={side}
            onChange={setSide}
            accentColor={accentColor}
            onAccentColor={onAccentColor}
          />
        </View>
        <MuscleActivityFigure
          activity={activity}
          side={side}
          selected={selected}
          onSelect={choose}
          accentColor={accentColor}
          height={FIGURE_HEIGHT}
        />
        <View testID="muscle-activity-legend" style={styles.legend}>
          {ACTIVITY_LEVELS.map((level) => (
            <View
              key={level}
              style={styles.legendItem}
              accessible
              accessibilityLabel={`${ACTIVITY_LEVEL_LABELS[level]}: ${ACTIVITY_LEVEL_NOTES[level]}`}
            >
              <Swatch color={palette[level]} />
              <Text style={styles.legendText}>{ACTIVITY_LEVEL_LABELS[level]}</Text>
            </View>
          ))}
        </View>
        <Text style={styles.note}>
          From the sets you&apos;ve logged: each exercise&apos;s own muscle group and, for
          built-ins, the muscles they also work. It shows how you&apos;ve trained, not how recovered
          a muscle is.
        </Text>
      </View>

      {chosen ? (
        <View testID="muscle-activity-group" style={styles.block}>
          <View style={styles.groupHead}>
            <View style={styles.flex}>
              <Text style={styles.groupTitle} accessibilityRole="header">
                {MUSCLE_GROUP_LABELS[chosen.group]}
              </Text>
              <View style={styles.levelRow}>
                <Swatch color={palette[chosen.level]} />
                <Text testID="muscle-activity-group-level" style={styles.levelText}>
                  {ACTIVITY_LEVEL_LABELS[chosen.level]} · {ACTIVITY_LEVEL_NOTES[chosen.level]}
                </Text>
              </View>
            </View>
            <TouchableOpacity
              testID="muscle-activity-group-close"
              onPress={() => setSelected(null)}
              hitSlop={12}
              accessibilityRole="button"
              accessibilityLabel={`Close ${MUSCLE_GROUP_LABELS[chosen.group]}`}
            >
              <Feather name="x" size={20} color={colors.textMuted} />
            </TouchableOpacity>
          </View>

          <View style={styles.stats}>
            <StatBlock
              testID="muscle-activity-group-sets"
              value={String(chosen.sets)}
              label="Sets"
            />
            <StatBlock
              testID="muscle-activity-group-sessions"
              value={String(chosen.sessions)}
              label={period === 7 ? 'Sessions' : `Sessions · ${chosen.perWeek.toFixed(1)}/wk`}
            />
          </View>
          <View style={styles.stats}>
            <StatBlock
              testID="muscle-activity-group-volume"
              value={
                chosen.volumeKg > 0
                  ? `${formatVolume(fromKg(chosen.volumeKg, weightUnit))} ${weightUnit}`
                  : '--'
              }
              label="Volume"
            />
            <StatBlock
              testID="muscle-activity-group-last"
              value={sinceText(chosen.lastTrainedAt, now) ?? 'Not yet'}
              label="Last Trained"
            />
          </View>
          {chosen.secondarySets > 0 ? (
            <Text testID="muscle-activity-group-also" style={styles.also}>
              Also worked in {chosen.secondarySets} {chosen.secondarySets === 1 ? 'set' : 'sets'} of
              other exercises
              {chosen.secondarySessions > 0
                ? `, in ${chosen.secondarySessions} more ${
                    chosen.secondarySessions === 1 ? 'session' : 'sessions'
                  }`
                : ''}
              .
            </Text>
          ) : null}

          <Text style={styles.kicker}>{period === 7 ? 'EACH DAY' : 'EACH WEEK'}</Text>
          <TrendBars group={chosen} period={period} accentColor={accentColor} />

          {chosen.exercises.length > 0 ? (
            <>
              <Text style={styles.kicker}>RECENT EXERCISES</Text>
              {chosen.exercises.slice(0, EXERCISES_SHOWN).map((exercise, i) => (
                <ListRow
                  key={exercise.exerciseId}
                  testID={`muscle-activity-exercise-${exercise.exerciseId}`}
                  title={exercise.name}
                  subtitle={`${exercise.sets} ${exercise.sets === 1 ? 'set' : 'sets'} · ${
                    sinceText(exercise.lastDoneAt, now) ?? ''
                  }${exercise.primary ? '' : ' · Also works it'}`}
                  divider={i > 0}
                  onPress={() => onOpenExercise(exercise.exerciseId, exercise.name)}
                />
              ))}
            </>
          ) : null}
        </View>
      ) : null}

      {anything && fewest.length > 0 ? (
        <View testID="muscle-activity-less" style={styles.block}>
          <ProgressCardHeader
            title="Trained Less Lately"
            subtitle={`The main muscle groups you've trained least in the last ${days}.`}
          />
          {fewest.map((group, i) => (
            <ListRow
              key={group.group}
              testID={`muscle-activity-less-${group.group}`}
              leading={<Swatch color={palette[group.level]} />}
              title={MUSCLE_GROUP_LABELS[group.group]}
              subtitle={
                group.lastWorkedAt
                  ? `${setsLine(group)} · last ${sinceText(group.lastWorkedAt, now)?.toLowerCase()}`
                  : `Nothing logged in the last ${days}`
              }
              divider={i > 0}
              onPress={() => choose(group.group)}
            />
          ))}
        </View>
      ) : null}

      <View testID="muscle-activity-all" style={styles.block}>
        <ProgressCardHeader title="Every Muscle" subtitle={`The last ${days}, from your sets.`} />
        {activity.map((group, i) => (
          <ListRow
            key={group.group}
            testID={`muscle-activity-row-${group.group}`}
            leading={<Swatch color={palette[group.level]} />}
            title={MUSCLE_GROUP_LABELS[group.group]}
            subtitle={setsLine(group)}
            value={sinceText(group.lastTrainedAt, now) ?? undefined}
            divider={i > 0}
            accessibilityLabel={`${MUSCLE_GROUP_LABELS[group.group]}. ${
              ACTIVITY_LEVEL_LABELS[group.level]
            }. ${setsLine(group)}${
              group.lastTrainedAt ? `. Last trained ${sinceText(group.lastTrainedAt, now)}` : ''
            }`}
            onPress={() => choose(group.group)}
          />
        ))}
      </View>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  fill: {
    flex: 1,
  },
  content: {
    paddingBottom: spacing.xxxl,
  },
  // Each part of the tab: a group of its own, spaced as Overview's are.
  block: {
    marginTop: spacing.xxl,
  },
  flex: {
    flex: 1,
    minWidth: 0,
  },
  sideRow: {
    alignItems: 'center',
    marginTop: spacing.md,
    marginBottom: spacing.lg,
  },
  legend: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    justifyContent: 'center',
    columnGap: spacing.lg,
    rowGap: spacing.sm,
    marginTop: spacing.lg,
  },
  legendItem: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.xs,
  },
  legendText: {
    ...typeScale.caption,
    color: colors.textSecondary,
  },
  swatch: {
    width: 12,
    height: 12,
    borderRadius: radii.pill,
  },
  // No recent training: the figure's own unworked grey.
  swatchNone: {
    backgroundColor: MATERIALS.definition.light,
    opacity: 0.5,
  },
  note: {
    ...typeScale.caption,
    color: colors.textMuted,
    marginTop: spacing.md,
    textAlign: 'center',
  },
  groupHead: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: spacing.md,
    marginBottom: spacing.md,
  },
  groupTitle: {
    ...typeScale.cardTitle,
    color: colors.textPrimary,
  },
  levelRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.xs,
    marginTop: spacing.xs,
  },
  levelText: {
    ...typeScale.secondary,
    color: colors.textSecondary,
    flexShrink: 1,
  },
  stats: {
    flexDirection: 'row',
    gap: widgetGap,
    marginBottom: widgetGap,
  },
  also: {
    ...typeScale.secondary,
    color: colors.textSecondary,
    marginTop: spacing.sm,
  },
  kicker: {
    ...typeScale.caption,
    fontFamily: fonts.semibold,
    color: colors.textMuted,
    letterSpacing: 0.8,
    marginTop: spacing.lg,
    marginBottom: spacing.sm,
  },
  bars: {
    flexDirection: 'row',
    alignItems: 'flex-end',
    height: 56,
    gap: 3,
  },
  barSlot: {
    flex: 1,
    justifyContent: 'flex-end',
  },
  bar: {
    borderRadius: 2,
  },
  barLabels: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginTop: spacing.xs,
  },
  barLabel: {
    ...typeScale.caption,
    color: colors.textMuted,
  },
});
