import { useCallback, useEffect, useMemo, useRef, useState, type ReactNode } from 'react';
import {
  Animated,
  Easing,
  Pressable,
  ScrollView,
  StyleSheet,
  TouchableOpacity,
  View,
  useWindowDimensions,
} from 'react-native';
import { Feather, MaterialCommunityIcons } from '@expo/vector-icons';
import { useAuth } from '../auth/AuthProvider';
import { AnimatedBar } from '../design/AnimatedBar';
import { BottomSheet } from '../design/BottomSheet';
import { TextButton } from '../design/Button';
import { ErrorState } from '../design/ErrorState';
import { ListRow } from '../design/ListRow';
import { SegmentedControl } from '../design/SegmentedControl';
import { SkeletonCards } from '../design/Skeleton';
import { StatBlock } from '../design/StatBlock';
import { Text } from '../design/Text';
import {
  colors,
  fonts,
  minTouchTarget,
  radii,
  spacing,
  typeScale,
  widgetGap,
} from '../design/theme';
import { loadBuiltinExtras } from '../exercises/builtinExtras';
// Plugs the built-in extras' reads in, for the muscles each built-in also works.
import '../exercises/exerciseGuide';
import { sideOf } from '../exercises/illustrations/muscleMap';
import { MATERIALS } from '../exercises/illustrations/palette';
import { MuscleFigure } from '../exercises/MuscleFigure';
import { MUSCLE_GROUP_LABELS, type MuscleGroup } from '../exercises/muscleGroups';
import { fromKg } from '../lib/units';
import { useReduceMotionPreference } from '../navigation/navigationTransitions';
import { levelColors, MuscleActivityFigure, type FigureSide } from './MuscleActivityFigure';
import {
  ACTIVITY_LEVEL_LABELS,
  ACTIVITY_LEVEL_NOTES,
  ACTIVITY_LEVELS,
  ACTIVITY_PERIODS,
  BREAKDOWN_SORT_LABELS,
  BREAKDOWN_SORTS,
  muscleActivity,
  musclesTrained,
  periodStart,
  sessionShare,
  sinceText,
  sortBreakdown,
  type ActivityPeriod,
  type BreakdownSort,
  type GroupActivity,
} from './muscleActivity';
import { fetchMuscleActivity, type ActivityEntry } from './muscleActivityQueries';
import { ProgressCardHeader } from './ProgressCardHeader';
import { formatVolume } from '../workouts/workoutSummary';

const FIGURE_HEIGHT = 300;
/** How many muscles Muscle Breakdown lists before View All Muscles. */
const ROWS_SHOWN = 6;
/** How many of a group's exercises its details list. */
const EXERCISES_SHOWN = 5;
/** A breakdown row's muscle picture. */
const THUMB = 40;
/** Below this screen width, the legend goes under the figure rather than beside it. */
const STACK_BELOW_WIDTH = 350;

/** A level's swatch: its colour, or the figure's grey for none. */
function Swatch({ color, size = 12 }: { color: string | null; size?: number }) {
  return (
    <View
      style={[
        { width: size, height: size, borderRadius: size / 2 },
        color ? { backgroundColor: color } : styles.swatchNone,
      ]}
      importantForAccessibility="no"
    />
  );
}

/** "5 sessions · 14 sets" -- what a row says it was. */
function setsLine(group: GroupActivity): string {
  if (group.sets === 0 && group.secondarySets === 0) return 'Nothing logged';
  if (group.sets === 0) {
    return `Also worked · ${group.secondarySets} ${group.secondarySets === 1 ? 'set' : 'sets'}`;
  }
  return `${group.sessions} ${group.sessions === 1 ? 'session' : 'sessions'} · ${group.sets} ${
    group.sets === 1 ? 'set' : 'sets'
  }`;
}

/** Comes in softly -- a short fade and lift -- when it first appears; at once under Reduce Motion. */
function SoftAppear({ children, testID }: { children: ReactNode; testID?: string }) {
  const reduceMotion = useReduceMotionPreference();
  const shown = useRef(new Animated.Value(reduceMotion ? 1 : 0)).current;
  useEffect(() => {
    if (reduceMotion) {
      shown.setValue(1);
      return undefined;
    }
    const animation = Animated.timing(shown, {
      toValue: 1,
      duration: 220,
      easing: Easing.out(Easing.cubic),
      useNativeDriver: true,
    });
    animation.start();
    return () => animation.stop();
  }, [reduceMotion, shown]);
  return (
    <Animated.View
      testID={testID}
      style={{
        opacity: shown,
        transform: [{ translateY: shown.interpolate({ inputRange: [0, 1], outputRange: [6, 0] }) }],
      }}
    >
      {children}
    </Animated.View>
  );
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
 * One muscle in Muscle Breakdown: its picture (Harbir's figure of it, a man's or a woman's, its
 * muscles in its level's colour), its name, sessions and sets, a bar of its sessions against the
 * busiest muscle's, and when it was last trained. A tap shows just it, with its details; tapped
 * again, every muscle.
 */
function BreakdownRow({
  group,
  share,
  color,
  now,
  selected,
  divider,
  onPress,
}: {
  group: GroupActivity;
  share: number;
  color: string | null;
  now: Date;
  selected: boolean;
  divider: boolean;
  onPress: () => void;
}) {
  const name = MUSCLE_GROUP_LABELS[group.group];
  const last = sinceText(group.lastTrainedAt, now);
  return (
    <Pressable
      testID={`muscle-activity-row-${group.group}`}
      onPress={onPress}
      style={({ pressed }) => [styles.row, divider && styles.rowDivider, pressed && styles.pressed]}
      accessibilityRole="button"
      accessibilityState={{ selected }}
      accessibilityLabel={`${name}. ${ACTIVITY_LEVEL_LABELS[group.level]}. ${setsLine(group)}${
        last ? `. Last trained ${last}` : ''
      }`}
      accessibilityHint={selected ? 'Shows every muscle again.' : 'Shows just this muscle.'}
    >
      <View style={styles.thumb}>
        <MuscleFigure
          group={group.group}
          accentColor={color ?? undefined}
          width={THUMB}
          height={THUMB}
        />
      </View>
      <View style={styles.rowText}>
        <Text style={styles.rowName} numberOfLines={1}>
          {name}
        </Text>
        <Text style={styles.rowSets} numberOfLines={1}>
          {setsLine(group)}
        </Text>
      </View>
      <View style={styles.rowBar}>
        <AnimatedBar
          fraction={share}
          color={color ?? colors.border}
          testID={`muscle-activity-bar-${group.group}`}
        />
      </View>
      <Text style={styles.rowWhen} numberOfLines={1}>
        {last ?? '—'}
      </Text>
      <Feather
        name={selected ? 'x' : 'chevron-right'}
        size={16}
        color={selected ? colors.textSecondary : colors.textMuted}
      />
    </Pressable>
  );
}

/**
 * Progress's Muscles tab -- Muscle Activity, laid out as Harbir's heat map (November 2026): which
 * muscle groups have been trained lately, from the sets logged -- never a recovery figure. 7, 30 or
 * 90 days; the Muscle Heat Map -- the anatomy figure from the front or behind, each muscle coloured
 * by how lately its group was trained (1–2, 3–7, 8–14 days, or longer), how many muscles were
 * trained and the legend beside it; then Muscle Breakdown -- every muscle's sessions, sets, a bar of
 * its sessions against the busiest's and when it was last trained, sorted Recent, Most or Least
 * Trained, six to start and View All Muscles. A tap on a muscle on the figure, or on its row, shows
 * just that muscle, outlined on the figure, with its details: sets, sessions, volume, when, how it
 * went week by week and the exercises behind it. Both come from one read: the person's own last 90
 * days, read each time the tab opens, so a workout finished one hop away is in it.
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
  const { width } = useWindowDimensions();
  const stacked = width < STACK_BELOW_WIDTH;
  const [period, setPeriod] = useState<ActivityPeriod>(30);
  const [side, setSide] = useState<FigureSide>('front');
  const [selected, setSelected] = useState<MuscleGroup | null>(null);
  const [sort, setSort] = useState<BreakdownSort>('recent');
  const [sortOpen, setSortOpen] = useState(false);
  const [showAll, setShowAll] = useState(false);
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
  const sorted = useMemo(() => (activity ? sortBreakdown(activity, sort) : []), [activity, sort]);

  // A muscle chosen on the figure or from its row shows just it; chosen again, every muscle.
  const choose = (group: MuscleGroup) => {
    setSelected((current) => (current === group ? null : group));
    // The figure turns to the side that shows it.
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
  const trained = musclesTrained(activity);
  const now = read!.at;
  const days = `${period} days`;
  const rows = showAll ? sorted : sorted.slice(0, ROWS_SHOWN);

  const row = (group: GroupActivity, index: number) => (
    <BreakdownRow
      key={group.group}
      group={group}
      share={sessionShare(group, activity)}
      color={palette[group.level]}
      now={now}
      selected={group.group === selected}
      divider={index > 0}
      onPress={() => choose(group.group)}
    />
  );

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
          title="Muscle Heat Map"
          subtitle={
            trained > 0
              ? `Your training by muscle group in the last ${days}. Tap a muscle.`
              : `Nothing logged in the last ${days} yet.`
          }
          action={
            <View
              testID="muscle-activity-count"
              style={styles.countTile}
              accessible
              accessibilityLabel={`${trained} ${trained === 1 ? 'muscle' : 'muscles'} trained`}
            >
              <MaterialCommunityIcons name="dumbbell" size={20} color={accentColor} />
              <View>
                <Text style={styles.countValue}>{trained}</Text>
                <Text style={styles.countLabel}>
                  {trained === 1 ? 'Muscle Trained' : 'Muscles Trained'}
                </Text>
              </View>
            </View>
          }
        />

        <View style={[styles.mapBody, stacked && styles.mapBodyStacked]}>
          <View style={styles.figureColumn}>
            <MuscleActivityFigure
              activity={activity}
              side={side}
              selected={selected}
              onSelect={choose}
              accentColor={accentColor}
              height={FIGURE_HEIGHT}
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
          </View>

          <View
            testID="muscle-activity-legend"
            style={[styles.legend, stacked && styles.legendRow]}
          >
            {ACTIVITY_LEVELS.map((level) => (
              <View
                key={level}
                style={[styles.legendItem, stacked && styles.legendItemHalf]}
                accessible
                accessibilityLabel={`${ACTIVITY_LEVEL_LABELS[level]}, ${ACTIVITY_LEVEL_NOTES[level]}`}
              >
                <Swatch color={palette[level]} size={14} />
                <View style={styles.legendText}>
                  <Text style={styles.legendLabel}>{ACTIVITY_LEVEL_LABELS[level]}</Text>
                  <Text style={styles.legendDays}>({ACTIVITY_LEVEL_NOTES[level]})</Text>
                </View>
              </View>
            ))}
          </View>
        </View>

        <Text style={styles.note}>
          From the sets you&apos;ve logged, each toward its exercise&apos;s own muscle group. It
          shows how you&apos;ve trained, not how recovered a muscle is.
        </Text>
      </View>

      <View testID="muscle-activity-breakdown" style={styles.block}>
        <ProgressCardHeader
          title="Muscle Breakdown"
          action={
            chosen ? undefined : (
              <TouchableOpacity
                testID="muscle-activity-sort"
                onPress={() => setSortOpen(true)}
                hitSlop={12}
                style={styles.sortButton}
                accessibilityRole="button"
                accessibilityLabel={`Sort: ${BREAKDOWN_SORT_LABELS[sort]}`}
              >
                <Text style={styles.sortText}>
                  Sort:{' '}
                  <Text style={[styles.sortValue, { color: accentColor }]}>
                    {BREAKDOWN_SORT_LABELS[sort]}
                  </Text>
                </Text>
                <Feather name="chevron-down" size={14} color={colors.textSecondary} />
              </TouchableOpacity>
            )
          }
        />

        {chosen ? (
          <>
            <View style={styles.filterLine}>
              <Text testID="muscle-activity-filter" style={styles.filterText}>
                Showing {MUSCLE_GROUP_LABELS[chosen.group]}
              </Text>
              <TextButton
                testID="muscle-activity-show-all"
                label="Show All Muscles"
                onPress={() => setSelected(null)}
              />
            </View>
            {row(chosen, 0)}
            <SoftAppear key={`${chosen.group}-details`} testID="muscle-activity-group">
              <View style={styles.levelRow}>
                <Swatch color={palette[chosen.level]} />
                <Text testID="muscle-activity-group-level" style={styles.levelText}>
                  {ACTIVITY_LEVEL_LABELS[chosen.level]} · {ACTIVITY_LEVEL_NOTES[chosen.level]}
                </Text>
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
                  Also worked in {chosen.secondarySets}{' '}
                  {chosen.secondarySets === 1 ? 'set' : 'sets'} of other exercises
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
            </SoftAppear>
          </>
        ) : (
          <>
            {rows.map((group, index) =>
              index < ROWS_SHOWN ? (
                row(group, index)
              ) : (
                <SoftAppear key={group.group}>{row(group, index)}</SoftAppear>
              ),
            )}
            {sorted.length > ROWS_SHOWN ? (
              <TouchableOpacity
                testID="muscle-activity-view-all"
                onPress={() => setShowAll((all) => !all)}
                style={styles.viewAll}
                accessibilityRole="button"
                accessibilityState={{ expanded: showAll }}
              >
                <Text style={[styles.viewAllText, { color: accentColor }]}>
                  {showAll ? 'Show Fewer' : 'View All Muscles'}
                </Text>
                <Feather
                  name={showAll ? 'chevron-up' : 'chevron-down'}
                  size={16}
                  color={accentColor}
                />
              </TouchableOpacity>
            ) : null}
          </>
        )}
      </View>

      <BottomSheet
        visible={sortOpen}
        onClose={() => setSortOpen(false)}
        swipeToDismiss
        testID="muscle-activity-sort-sheet"
      >
        <View style={styles.sheet}>
          <Text style={styles.sheetTitle}>Sort Muscles</Text>
          {BREAKDOWN_SORTS.map((value, index) => (
            <ListRow
              key={value}
              testID={`muscle-activity-sort-${value}`}
              title={BREAKDOWN_SORT_LABELS[value]}
              trailing={
                value === sort ? <Feather name="check" size={18} color={accentColor} /> : undefined
              }
              accessibilityLabel={`${BREAKDOWN_SORT_LABELS[value]}${value === sort ? ', chosen' : ''}`}
              divider={index > 0}
              onPress={() => {
                setSort(value);
                setSortOpen(false);
              }}
            />
          ))}
        </View>
      </BottomSheet>
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
  // Each part of the tab: a group of its own, spaced as Overview's are (inside the section's
  // card, so never a card of its own).
  block: {
    marginTop: spacing.xxl,
  },
  pressed: {
    opacity: 0.7,
  },

  // How many muscles were trained, in a raised tile at the heat map's head.
  countTile: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
    paddingVertical: spacing.sm,
    paddingHorizontal: spacing.md,
    borderRadius: radii.md,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: colors.border,
    backgroundColor: colors.surfaceRaised,
  },
  countValue: {
    ...typeScale.statMedium,
    color: colors.textPrimary,
  },
  countLabel: {
    ...typeScale.caption,
    color: colors.textSecondary,
  },

  // The figure, and the legend beside it -- or under it on a narrow phone.
  mapBody: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.md,
    marginTop: spacing.lg,
  },
  mapBodyStacked: {
    flexDirection: 'column',
    alignItems: 'stretch',
  },
  figureColumn: {
    flex: 1,
    alignItems: 'center',
  },
  sideRow: {
    alignItems: 'center',
    marginTop: spacing.md,
  },
  legend: {
    width: 148,
    gap: spacing.md,
    padding: spacing.md,
    borderRadius: radii.md,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: colors.border,
    backgroundColor: colors.surfaceRaised,
  },
  legendRow: {
    width: 'auto',
    flexDirection: 'row',
    flexWrap: 'wrap',
    rowGap: spacing.md,
    columnGap: 0,
  },
  legendItem: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
  },
  legendItemHalf: {
    width: '50%',
  },
  legendText: {
    flexShrink: 1,
  },
  legendLabel: {
    ...typeScale.secondary,
    color: colors.textPrimary,
  },
  legendDays: {
    ...typeScale.caption,
    color: colors.textSecondary,
  },
  // No recent training: the figure's own unworked grey.
  swatchNone: {
    backgroundColor: MATERIALS.definition.light,
    opacity: 0.5,
  },
  note: {
    ...typeScale.caption,
    color: colors.textMuted,
    marginTop: spacing.lg,
    textAlign: 'center',
  },

  // Muscle Breakdown.
  sortButton: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 2,
  },
  sortText: {
    ...typeScale.secondary,
    color: colors.textSecondary,
  },
  sortValue: {
    fontFamily: fonts.semibold,
  },
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
    minHeight: minTouchTarget + 12,
    paddingVertical: spacing.sm,
  },
  rowDivider: {
    borderTopWidth: StyleSheet.hairlineWidth,
    borderTopColor: colors.divider,
  },
  thumb: {
    width: THUMB,
    height: THUMB,
    borderRadius: THUMB / 2,
    overflow: 'hidden',
    backgroundColor: colors.surfaceRaised,
  },
  rowText: {
    flex: 1.3,
    minWidth: 0,
  },
  rowName: {
    ...typeScale.callout,
    fontFamily: fonts.semibold,
    color: colors.textPrimary,
  },
  rowSets: {
    ...typeScale.caption,
    color: colors.textSecondary,
    marginTop: 2,
  },
  rowBar: {
    flex: 1,
  },
  rowWhen: {
    ...typeScale.caption,
    color: colors.textSecondary,
    width: 64,
    textAlign: 'right',
  },
  viewAll: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: spacing.xs,
    minHeight: minTouchTarget,
    marginTop: spacing.xs,
    borderTopWidth: StyleSheet.hairlineWidth,
    borderTopColor: colors.divider,
  },
  viewAllText: {
    ...typeScale.callout,
    fontFamily: fonts.semibold,
  },
  filterLine: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: spacing.sm,
  },
  filterText: {
    ...typeScale.secondary,
    color: colors.textSecondary,
  },

  // A chosen muscle's details, under its row.
  levelRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.xs,
    marginTop: spacing.sm,
    marginBottom: spacing.md,
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

  // The sort sheet.
  sheet: {
    padding: spacing.lg,
    gap: spacing.sm,
  },
  sheetTitle: {
    ...typeScale.cardTitle,
    color: colors.textPrimary,
  },
});
