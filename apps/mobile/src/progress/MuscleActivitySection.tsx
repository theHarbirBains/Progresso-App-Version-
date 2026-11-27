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
import { Feather } from '@expo/vector-icons';
import { useAuth } from '../auth/AuthProvider';
import { AnimatedBar } from '../design/AnimatedBar';
import { BottomSheet } from '../design/BottomSheet';
import { TextButton } from '../design/Button';
import { ErrorState } from '../design/ErrorState';
import { ListRow } from '../design/ListRow';
import { SegmentedControl } from '../design/SegmentedControl';
import { SkeletonCards } from '../design/Skeleton';
import { Text } from '../design/Text';
import {
  analyticsColors,
  colors,
  fonts,
  minTouchTarget,
  radii,
  spacing,
  typeScale,
} from '../design/theme';
import { sideOf } from '../exercises/illustrations/muscleMap';
import { MuscleFigure } from '../exercises/MuscleFigure';
import { MUSCLE_GROUP_LABELS, type MuscleGroup } from '../exercises/muscleGroups';
import { fromKg } from '../lib/units';
import { useReduceMotionPreference } from '../navigation/navigationTransitions';
import { LEVEL_COLORS, MuscleActivityFigure, type FigureSide } from './MuscleActivityFigure';
import {
  ACTIVITY_GROUPS,
  ACTIVITY_LEVEL_LABELS,
  ACTIVITY_LEVEL_NOTES,
  ACTIVITY_LEVELS,
  ACTIVITY_PERIODS,
  BREAKDOWN_SORT_LABELS,
  BREAKDOWN_SORTS,
  breakdownShare,
  muscleActivity,
  musclesTrained,
  periodStart,
  periodTotals,
  sinceText,
  sortBreakdown,
  trainingBalance,
  type ActivityPeriod,
  type BreakdownSort,
  type GroupActivity,
} from './muscleActivity';
import { fetchMuscleActivity, type ActivityEntry } from './muscleActivityQueries';
import { ProgressCardHeader } from './ProgressCardHeader';

const FIGURE_HEIGHT = 300;
/** How many muscles Muscle Breakdown lists before View All Muscles. */
const ROWS_SHOWN = 6;
/** How many of a group's exercises its row lists, opened. */
const EXERCISES_SHOWN = 5;
/** A breakdown row's muscle picture. */
const THUMB = 40;
/** Below this screen width, the legend goes under the figure rather than beside it. */
const STACK_BELOW_WIDTH = 350;

/** "3,240 lb" -- a volume in the person's unit, to the whole number. */
function volumeText(kg: number, unit: 'kg' | 'lb'): string {
  return `${Math.round(fromKg(kg, unit)).toLocaleString('en-US')} ${unit}`;
}

const plural = (n: number, one: string, many: string) =>
  `${n.toLocaleString('en-US')} ${n === 1 ? one : many}`;

/** A level's swatch, in its colour. */
function Swatch({ color, size = 12 }: { color: string; size?: number }) {
  return (
    <View
      style={{ width: size, height: size, borderRadius: size / 2, backgroundColor: color }}
      importantForAccessibility="no"
    />
  );
}

/** "5 sessions · 14 sets · 3,240 lb" -- what a row says it was. */
function statsLine(group: GroupActivity, unit: 'kg' | 'lb'): string {
  if (group.sets === 0) {
    return group.secondarySets > 0
      ? `Also worked · ${plural(group.secondarySets, 'set', 'sets')}`
      : 'Nothing logged';
  }
  const parts = [plural(group.sessions, 'session', 'sessions'), plural(group.sets, 'set', 'sets')];
  if (group.volumeKg > 0) parts.push(volumeText(group.volumeKg, unit));
  return parts.join(' · ');
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

/** A small tile of the Training Summary: a figure over its name. */
function SummaryTile({
  value,
  suffix,
  label,
  testID,
}: {
  value: string;
  suffix?: string;
  label: string;
  testID: string;
}) {
  return (
    <View
      testID={testID}
      style={styles.summaryTile}
      accessible
      accessibilityLabel={`${label}: ${value}${suffix ? ` ${suffix.replace('/', 'of ')}` : ''}`}
    >
      <Text style={styles.summaryValue} numberOfLines={1}>
        {value}
        {suffix ? <Text style={styles.summarySuffix}>{suffix}</Text> : null}
      </Text>
      <Text style={styles.summaryLabel}>{label}</Text>
    </View>
  );
}

/**
 * One muscle in Muscle Breakdown: its picture (Harbir's figure of it, a man's or a woman's, its
 * muscles in its level's colour), its name and when it was last trained, its sessions, sets and
 * volume, and a bar of the figure it's sorted by against the busiest muscle's. A tap opens it: its
 * level and the exercises behind it.
 */
function BreakdownRow({
  group,
  share,
  now,
  unit,
  period,
  expanded,
  divider,
  onPress,
  onOpenExercise,
}: {
  group: GroupActivity;
  share: number;
  now: Date;
  unit: 'kg' | 'lb';
  period: ActivityPeriod;
  expanded: boolean;
  divider: boolean;
  onPress: () => void;
  onOpenExercise: (exerciseId: string, exerciseName: string) => void;
}) {
  const name = MUSCLE_GROUP_LABELS[group.group];
  // When it was last worked -- as the main muscle or one an exercise also works, as its colour.
  const last = sinceText(group.lastWorkedAt, now);
  const color = LEVEL_COLORS[group.level];
  return (
    <View style={divider && styles.rowDivider}>
      <Pressable
        testID={`muscle-activity-row-${group.group}`}
        onPress={onPress}
        style={({ pressed }) => [styles.row, pressed && styles.pressed]}
        accessibilityRole="button"
        accessibilityState={{ expanded }}
        accessibilityLabel={`${name}. ${ACTIVITY_LEVEL_LABELS[group.level]}. ${statsLine(
          group,
          unit,
        )}${last ? `. Last trained ${last}` : ''}`}
        accessibilityHint={expanded ? 'Closes its details.' : 'Shows its exercises.'}
      >
        <View style={styles.thumb}>
          <MuscleFigure
            group={group.group}
            accentColor={group.level === 'none' ? undefined : color}
            width={THUMB}
            height={THUMB}
          />
        </View>
        <View style={styles.rowBody}>
          <View style={styles.rowTop}>
            <Text style={styles.rowName} numberOfLines={1}>
              {name}
            </Text>
            <Text style={styles.rowWhen} numberOfLines={1}>
              {last ?? '—'}
            </Text>
          </View>
          <Text style={styles.rowStats} numberOfLines={1}>
            {statsLine(group, unit)}
          </Text>
          <View style={styles.rowBar}>
            <AnimatedBar
              fraction={share}
              color={color}
              testID={`muscle-activity-bar-${group.group}`}
            />
          </View>
        </View>
        <Feather
          name={expanded ? 'chevron-up' : 'chevron-down'}
          size={16}
          color={colors.textMuted}
        />
      </Pressable>

      {expanded ? (
        <SoftAppear testID="muscle-activity-group">
          <View style={styles.details}>
            <View style={styles.levelRow}>
              <Swatch color={color} />
              <Text testID="muscle-activity-group-level" style={styles.levelText}>
                {ACTIVITY_LEVEL_LABELS[group.level]} · {ACTIVITY_LEVEL_NOTES[group.level]}
                {period !== 7 && group.sessions > 0
                  ? ` · ${group.perWeek.toFixed(1)} sessions a week`
                  : ''}
              </Text>
            </View>

            {group.exercises.length > 0 ? (
              <>
                <Text style={styles.kicker}>EXERCISES</Text>
                {group.exercises.slice(0, EXERCISES_SHOWN).map((exercise, i) => (
                  <ListRow
                    key={exercise.exerciseId}
                    testID={`muscle-activity-exercise-${exercise.exerciseId}`}
                    title={exercise.name}
                    subtitle={[
                      plural(exercise.sets, 'set', 'sets'),
                      ...(exercise.volumeKg > 0 ? [volumeText(exercise.volumeKg, unit)] : []),
                      sinceText(exercise.lastDoneAt, now) ?? '',
                      ...(exercise.primary ? [] : ['Also works it']),
                    ].join(' · ')}
                    divider={i > 0}
                    onPress={() => onOpenExercise(exercise.exerciseId, exercise.name)}
                  />
                ))}
              </>
            ) : null}
            {group.secondarySets > 0 && group.sets > 0 ? (
              <Text testID="muscle-activity-group-also" style={styles.also}>
                Also worked in {plural(group.secondarySets, 'set', 'sets')} of other exercises.
              </Text>
            ) : null}
          </View>
        </SoftAppear>
      ) : null}
    </View>
  );
}

/**
 * Progress's Muscles tab -- Muscle Analytics (Harbir's redesign, November 2026), from the sets
 * logged and nothing else, never a recovery figure. 7, 30 or 90 days, then:
 * - **Training Summary**: the muscles trained, the working sets and the workouts in the period;
 * - **Muscle Heat Map**: Harbir's figure (a man's or a woman's) from the front or behind, each
 *   muscle group in its level's colour -- coral, amber, teal or slate, by how lately it was trained
 *   -- with the legend beside it; a tap on a muscle shows just it in the breakdown, opened;
 * - **Training Balance**: upper body against lower body, by training volume;
 * - **Muscle Breakdown**: every group's sessions, sets, volume and last trained, sorted Recent,
 *   Sets, Volume or Frequency, six to start and View All Muscles; a row opens to its exercises.
 * All from one read: the person's own last 90 days, each time the tab opens.
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
  // A muscle tapped on the figure: the breakdown shows just it.
  const [focused, setFocused] = useState<MuscleGroup | null>(null);
  // The row opened, if any.
  const [expanded, setExpanded] = useState<MuscleGroup | null>(null);
  const [sort, setSort] = useState<BreakdownSort>('recent');
  const [sortOpen, setSortOpen] = useState(false);
  const [showAll, setShowAll] = useState(false);
  const [read, setRead] = useState<{ entries: ActivityEntry[]; at: Date } | null>(null);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(async () => {
    if (!userId) return;
    setError(null);
    try {
      const at = new Date();
      // Each exercise comes with the muscles it also works, built-in or custom.
      const entries = await fetchMuscleActivity(userId, periodStart(90, at));
      setRead({ entries, at });
    } catch (err) {
      setError(err instanceof Error ? err.message : "Couldn't load your training.");
    }
  }, [userId]);

  // Read as the tab opens (it's drawn afresh each time it's chosen).
  useEffect(() => {
    void load();
  }, [load]);

  const activity = useMemo(
    () => (read ? muscleActivity(read.entries, period, read.at) : null),
    [read, period],
  );
  const totals = useMemo(
    () => (read ? periodTotals(read.entries, period, read.at) : null),
    [read, period],
  );
  const sorted = useMemo(() => (activity ? sortBreakdown(activity, sort) : []), [activity, sort]);

  // A muscle tapped on the figure: just it in the breakdown, opened; tapped again, every muscle.
  const focus = (group: MuscleGroup) => {
    if (focused === group) {
      setFocused(null);
      setExpanded(null);
      return;
    }
    setFocused(group);
    setExpanded(group);
  };
  // A row tapped: opened or closed where it is, and turned to on the figure.
  const toggle = (group: MuscleGroup) => {
    if (expanded === group) {
      setExpanded(null);
      if (focused === group) setFocused(null);
      return;
    }
    setExpanded(group);
    setSide(sideOf(group));
  };

  if (!activity || !totals) {
    if (!error) {
      return <SkeletonCards testID="muscle-activity-loading" heights={[44, 72, 380, 96, 168]} />;
    }
    return (
      <ErrorState
        testID="muscle-activity-error"
        message={error ?? "Couldn't load your training."}
        onRetry={() => void load()}
      />
    );
  }

  const trained = musclesTrained(activity);
  const balance = trainingBalance(activity);
  const hasBalance = balance.upper.volumeKg + balance.lower.volumeKg > 0;
  const now = read!.at;
  const days = `${period} days`;
  const highlighted = focused ?? expanded;
  const focusedGroup = focused ? activity.find((group) => group.group === focused) : undefined;
  const rows = showAll ? sorted : sorted.slice(0, ROWS_SHOWN);

  const row = (group: GroupActivity, index: number) => (
    <BreakdownRow
      key={group.group}
      group={group}
      share={breakdownShare(group, activity, sort)}
      now={now}
      unit={weightUnit}
      period={period}
      expanded={expanded === group.group}
      divider={index > 0}
      onPress={() => toggle(group.group)}
      onOpenExercise={onOpenExercise}
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

      <View testID="muscle-activity-summary" style={[styles.summary, styles.blockTight]}>
        <SummaryTile
          testID="muscle-activity-count"
          value={String(trained)}
          suffix={`/${ACTIVITY_GROUPS.length}`}
          label="Muscles"
        />
        <SummaryTile
          testID="muscle-activity-sets"
          value={totals.sets.toLocaleString('en-US')}
          label="Sets"
        />
        <SummaryTile
          testID="muscle-activity-workouts"
          value={totals.workouts.toLocaleString('en-US')}
          label="Workouts"
        />
      </View>

      <View testID="muscle-activity-map" style={styles.block}>
        <ProgressCardHeader
          title="Muscle Heat Map"
          subtitle={trained > 0 ? undefined : `Nothing logged in the last ${days} yet.`}
          action={
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
          }
        />

        <View style={[styles.mapBody, stacked && styles.mapBodyStacked]}>
          <View style={styles.figureColumn}>
            <MuscleActivityFigure
              activity={activity}
              side={side}
              selected={highlighted}
              onSelect={focus}
              height={FIGURE_HEIGHT}
            />
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
                <Swatch color={LEVEL_COLORS[level]} size={12} />
                <View style={styles.legendText}>
                  <Text style={styles.legendLabel}>{ACTIVITY_LEVEL_LABELS[level]}</Text>
                  <Text style={styles.legendDays}>{ACTIVITY_LEVEL_NOTES[level]}</Text>
                </View>
              </View>
            ))}
          </View>
        </View>

        <Text style={styles.note}>From your logged sets -- not how recovered a muscle is.</Text>
      </View>

      <View testID="muscle-activity-balance" style={styles.block}>
        <ProgressCardHeader title="Training Balance" />
        {hasBalance ? (
          <>
            <View
              style={styles.balanceBar}
              accessible
              accessibilityLabel={`Upper body ${Math.round(
                balance.upper.share * 100,
              )} percent of volume, lower body ${Math.round(balance.lower.share * 100)} percent`}
            >
              {balance.upper.share > 0 ? (
                <View
                  style={[
                    styles.balancePart,
                    { flex: balance.upper.share, backgroundColor: analyticsColors.chart },
                  ]}
                />
              ) : null}
              {balance.lower.share > 0 ? (
                <View
                  style={[
                    styles.balancePart,
                    { flex: balance.lower.share, backgroundColor: accentColor },
                  ]}
                />
              ) : null}
            </View>
            <View style={styles.balanceSides}>
              {(
                [
                  ['upper', 'Upper Body', analyticsColors.chart],
                  ['lower', 'Lower Body', accentColor],
                ] as const
              ).map(([key, label, color], i) => (
                <View
                  key={key}
                  testID={`muscle-activity-balance-${key}`}
                  style={[styles.balanceSide, i === 1 && styles.balanceSideEnd]}
                >
                  <View style={styles.balanceLabelRow}>
                    <Swatch color={color} size={8} />
                    <Text style={styles.balanceLabel}>{label}</Text>
                  </View>
                  <Text style={styles.balancePercent}>{Math.round(balance[key].share * 100)}%</Text>
                  <Text style={styles.balanceDetail}>
                    {volumeText(balance[key].volumeKg, weightUnit)} ·{' '}
                    {plural(balance[key].sets, 'set', 'sets')}
                  </Text>
                </View>
              ))}
            </View>
          </>
        ) : (
          <Text testID="muscle-activity-balance-empty" style={styles.empty}>
            No weighted sets in the last {days}.
          </Text>
        )}
      </View>

      <View testID="muscle-activity-breakdown" style={styles.block}>
        <ProgressCardHeader
          title="Muscle Breakdown"
          action={
            focusedGroup ? undefined : (
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

        {focusedGroup ? (
          <>
            <View style={styles.filterLine}>
              <Text testID="muscle-activity-filter" style={styles.filterText}>
                Showing {MUSCLE_GROUP_LABELS[focusedGroup.group]}
              </Text>
              <TextButton
                testID="muscle-activity-show-all"
                label="Show All Muscles"
                onPress={() => setFocused(null)}
              />
            </View>
            {row(focusedGroup, 0)}
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
  // Each part of the tab: a group of its own (inside the section's card, so never a card).
  block: {
    marginTop: spacing.xxl,
  },
  blockTight: {
    marginTop: spacing.md,
  },
  pressed: {
    opacity: 0.7,
  },

  // Training Summary: three small raised tiles in a row.
  summary: {
    flexDirection: 'row',
    gap: spacing.sm,
  },
  summaryTile: {
    flex: 1,
    paddingVertical: spacing.sm,
    paddingHorizontal: spacing.md,
    borderRadius: radii.md,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: colors.border,
    backgroundColor: colors.surfaceRaised,
  },
  summaryValue: {
    ...typeScale.statMedium,
    color: colors.textPrimary,
  },
  summarySuffix: {
    ...typeScale.secondary,
    color: colors.textMuted,
  },
  summaryLabel: {
    ...typeScale.caption,
    color: colors.textSecondary,
    marginTop: 2,
  },

  // The figure, and the legend beside it -- or under it on a narrow phone.
  mapBody: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.md,
    marginTop: spacing.md,
  },
  mapBodyStacked: {
    flexDirection: 'column',
    alignItems: 'stretch',
  },
  figureColumn: {
    flex: 1,
    alignItems: 'center',
  },
  legend: {
    width: 136,
    gap: spacing.md,
  },
  legendRow: {
    width: 'auto',
    flexDirection: 'row',
    flexWrap: 'wrap',
    rowGap: spacing.md,
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
    color: colors.textMuted,
  },
  note: {
    ...typeScale.caption,
    color: colors.textMuted,
    marginTop: spacing.md,
    textAlign: 'center',
  },

  // Training Balance: one bar in two, then each half's share, volume and sets.
  balanceBar: {
    flexDirection: 'row',
    height: 10,
    gap: 2,
    marginTop: spacing.md,
    borderRadius: radii.pill,
    overflow: 'hidden',
    backgroundColor: colors.chartMuted,
  },
  balancePart: {
    height: '100%',
  },
  balanceSides: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginTop: spacing.sm,
  },
  balanceSide: {
    flex: 1,
  },
  balanceSideEnd: {
    alignItems: 'flex-end',
  },
  balanceLabelRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.xs,
  },
  balanceLabel: {
    ...typeScale.caption,
    color: colors.textSecondary,
  },
  balancePercent: {
    ...typeScale.statMedium,
    color: colors.textPrimary,
  },
  balanceDetail: {
    ...typeScale.caption,
    color: colors.textMuted,
  },
  empty: {
    ...typeScale.secondary,
    color: colors.textSecondary,
    marginTop: spacing.sm,
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
    gap: spacing.md,
    minHeight: minTouchTarget + 16,
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
  rowBody: {
    flex: 1,
    minWidth: 0,
    gap: 2,
  },
  rowTop: {
    flexDirection: 'row',
    alignItems: 'baseline',
    gap: spacing.sm,
  },
  rowName: {
    ...typeScale.callout,
    fontFamily: fonts.semibold,
    color: colors.textPrimary,
    flex: 1,
  },
  rowWhen: {
    ...typeScale.caption,
    color: colors.textSecondary,
  },
  rowStats: {
    ...typeScale.caption,
    color: colors.textSecondary,
  },
  rowBar: {
    marginTop: 4,
  },
  details: {
    paddingLeft: THUMB + spacing.md,
    paddingBottom: spacing.md,
  },
  levelRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.xs,
  },
  levelText: {
    ...typeScale.secondary,
    color: colors.textSecondary,
    flexShrink: 1,
  },
  also: {
    ...typeScale.caption,
    color: colors.textMuted,
    marginTop: spacing.sm,
  },
  kicker: {
    ...typeScale.caption,
    fontFamily: fonts.semibold,
    color: colors.textMuted,
    letterSpacing: 0.8,
    marginTop: spacing.md,
    marginBottom: spacing.sm,
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
