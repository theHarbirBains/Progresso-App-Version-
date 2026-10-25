import { useEffect, useMemo, useState } from 'react';
import { ScrollView, StyleSheet, View } from 'react-native';
import { useAuth } from '../auth/AuthProvider';
import { TextButton } from '../design/Button';
import { ListRow } from '../design/ListRow';
import { SectionHeader } from '../design/SectionHeader';
import { SegmentedControl } from '../design/SegmentedControl';
import { SkeletonRows } from '../design/Skeleton';
import { StatBlock } from '../design/StatBlock';
import { Text } from '../design/Text';
import { colors, spacing, typeScale, widgetGap } from '../design/theme';
import { dayFromKey, dayKey } from '../lib/dayKey';
import { CalorieRing } from '../nutrition/CalorieRing';
import { fetchIntakeForRange, type Intake } from '../nutrition/foodLogQueries';
import { MacroRows } from '../nutrition/MacroRows';
import { useNutritionGoals } from '../nutrition/NutritionGoalsProvider';
import { wholeFigure, wholeFigureText } from '../nutrition/wholeFigures';
import { progressStyles } from './progressStyles';

type Range = 'week' | 'month' | 'quarter' | 'all';

/** Each range's days, up to and including today -- every day there is, for All Time. */
const RANGES: { label: string; value: Range; days: number | null }[] = [
  { label: 'Week', value: 'week', days: 7 },
  { label: 'Month', value: 'month', days: 30 },
  { label: '3 Months', value: 'quarter', days: 90 },
  { label: 'All Time', value: 'all', days: null },
];

/** A day's calories count as on target when no more than this share off it. */
const TOLERANCE = 0.1;
const RING_SIZE = 116;

export interface NutritionDay {
  key: string;
  calories: number;
  proteinG: number;
  carbsG: number;
  fatG: number;
  /** The daily calorie target; null with none. */
  calorieTarget: number | null;
}

/**
 * The days with food logged, newest first, each with the calorie target in force that day --
 * the daily target. Pure.
 */
export function nutritionDays(
  logs: Intake[],
  targetFor: (key: string) => number | null,
): NutritionDay[] {
  const byDay = new Map<
    string,
    { calories: number; proteinG: number; carbsG: number; fatG: number }
  >();
  for (const log of logs) {
    const key = dayKey(new Date(log.loggedAt));
    const day = byDay.get(key) ?? { calories: 0, proteinG: 0, carbsG: 0, fatG: 0 };
    day.calories += log.calories;
    day.proteinG += log.proteinG;
    day.carbsG += log.carbsG;
    day.fatG += log.fatG;
    byDay.set(key, day);
  }
  return [...byDay.entries()]
    .map(([key, day]) => ({ key, ...day, calorieTarget: targetFor(key) }))
    .sort((a, b) => b.key.localeCompare(a.key));
}

/** The average logged day: each figure over the days with food logged. Null with none. Pure. */
export function averageDay(
  days: NutritionDay[],
): { calories: number; proteinG: number; carbsG: number; fatG: number } | null {
  if (days.length === 0) return null;
  const total = days.reduce(
    (sum, day) => ({
      calories: sum.calories + day.calories,
      proteinG: sum.proteinG + day.proteinG,
      carbsG: sum.carbsG + day.carbsG,
      fatG: sum.fatG + day.fatG,
    }),
    { calories: 0, proteinG: 0, carbsG: 0, fatG: 0 },
  );
  return {
    calories: total.calories / days.length,
    proteinG: total.proteinG / days.length,
    carbsG: total.carbsG / days.length,
    fatG: total.fatG / days.length,
  };
}

interface Props {
  accentColor: string;
  onAccentColor: string;
  /** Opens Nutrition History on this day ("YYYY-MM-DD"), where its foods are. */
  onOpenDay: (key: string) => void;
  /** Opens Nutrition History, every day there is. */
  onOpenHistory: () => void;
}

/**
 * Progress's nutrition, All Time's second tab: all of it, or the last week, month or three months.
 * First the average logged day, as the Nutrition screen draws a day -- the calorie ring with the
 * average day's calories against the daily target, and protein, carbs and fat as rows of the way
 * to theirs -- then the days logged (out of the range's days, or all of them) and the days within
 * 10% of the calorie target, and, for a range, every logged day, newest first, each opening that
 * day in Nutrition History. All Time opens on Nutrition History instead of listing every day. A
 * day with nothing logged is never counted: averages are over the days food was logged.
 */
export function NutritionProgressSection({
  accentColor,
  onAccentColor,
  onOpenDay,
  onOpenHistory,
}: Props) {
  const { user } = useAuth();
  const userId = user?.id;
  const { goals } = useNutritionGoals();
  const [range, setRange] = useState<Range>('all');
  const [logs, setLogs] = useState<Intake[] | null>(null);
  const [error, setError] = useState<string | null>(null);
  const span = RANGES.find((r) => r.value === range)!.days;

  useEffect(() => {
    if (!userId) return;
    let cancelled = false;
    setLogs(null);
    setError(null);
    // Up to the end of today: food planned for a day ahead isn't eaten yet.
    const tomorrow = dayFromKey(dayKey(new Date()));
    tomorrow.setDate(tomorrow.getDate() + 1);
    const start = new Date(span === null ? 0 : tomorrow.getTime());
    if (span !== null) start.setDate(start.getDate() - span);
    fetchIntakeForRange(userId, start, tomorrow)
      .then((rows) => {
        if (!cancelled) setLogs(rows);
      })
      .catch((err: unknown) => {
        if (!cancelled) setError(err instanceof Error ? err.message : 'Failed to load food logs');
      });
    return () => {
      cancelled = true;
    };
  }, [userId, span]);

  const days = useMemo(
    () => (logs ? nutritionDays(logs, () => goals?.calories ?? null) : []),
    [logs, goals],
  );
  const average = useMemo(() => averageDay(days), [days]);
  const onTarget = (day: NutritionDay) =>
    day.calorieTarget !== null &&
    Math.abs(day.calories - day.calorieTarget) <= day.calorieTarget * TOLERANCE;
  const withTarget = days.filter((day) => day.calorieTarget !== null);
  const firstDay = days[days.length - 1]?.key ?? null;

  return (
    <ScrollView
      testID="progress-nutrition-scroll"
      style={progressStyles.sectionFill}
      contentContainerStyle={styles.content}
      showsVerticalScrollIndicator={false}
    >
      <SegmentedControl
        testID="progress-nutrition-range"
        options={RANGES.map(({ label, value }) => ({ label, value }))}
        value={range}
        onChange={setRange}
        accentColor={accentColor}
        onAccentColor={onAccentColor}
      />

      {error ? (
        <Text testID="progress-nutrition-error" style={styles.empty}>
          {error}
        </Text>
      ) : logs === null ? (
        <SkeletonRows testID="progress-nutrition-loading" count={4} />
      ) : average === null ? (
        <Text testID="progress-nutrition-empty" style={styles.empty}>
          {range === 'all' ? 'No food logged yet.' : 'No food logged in this time.'}
        </Text>
      ) : (
        <>
          <View testID="progress-nutrition-average">
            <SectionHeader label="Average Day" />
            <View style={styles.averageRow}>
              <CalorieRing
                testID="progress-nutrition-ring"
                consumed={average.calories}
                goal={goals?.calories ?? null}
                accentColor={accentColor}
                size={RING_SIZE}
                strokeWidth={12}
                spokenPeriod="a day on average"
              />
              <MacroRows
                testIDPrefix="progress-nutrition-"
                spokenSuffix="a day on average"
                accentColor={accentColor}
                macros={[
                  {
                    key: 'protein',
                    label: 'Protein',
                    consumed: average.proteinG,
                    goal: goals?.proteinG ?? null,
                  },
                  {
                    key: 'carbs',
                    label: 'Carbs',
                    consumed: average.carbsG,
                    goal: goals?.carbsG ?? null,
                  },
                  { key: 'fat', label: 'Fat', consumed: average.fatG, goal: goals?.fatG ?? null },
                ]}
              />
            </View>
          </View>

          <View style={styles.blocks}>
            <StatBlock
              testID="progress-nutrition-logged"
              value={span !== null ? `${days.length} of ${span}` : days.length.toLocaleString()}
              label="Days Logged"
            />
            <StatBlock
              testID="progress-nutrition-on-target"
              value={
                withTarget.length > 0
                  ? `${withTarget.filter(onTarget).length} of ${withTarget.length}`
                  : '—'
              }
              label="Days on Calories"
            />
          </View>
          <Text testID="progress-nutrition-note" style={styles.caption}>
            {range === 'all' && firstDay
              ? `Since ${dayFromKey(firstDay).toLocaleDateString(undefined, {
                  month: 'long',
                  day: 'numeric',
                  year: 'numeric',
                })}. `
              : ''}
            Averages are over the days with food logged. On target is within 10% of the daily
            calorie target.
          </Text>

          {range === 'all' ? (
            <View style={styles.historyLink}>
              <TextButton
                testID="progress-nutrition-history"
                label="Every Day in Nutrition History"
                onPress={onOpenHistory}
              />
            </View>
          ) : (
            <View style={styles.list}>
              {days.map((day, index) => {
                const diff =
                  day.calorieTarget !== null ? wholeFigure(day.calories - day.calorieTarget) : null;
                return (
                  <ListRow
                    key={day.key}
                    testID={`progress-nutrition-day-${day.key}`}
                    title={dayFromKey(day.key).toLocaleDateString(undefined, {
                      weekday: 'short',
                      month: 'short',
                      day: 'numeric',
                    })}
                    subtitle={
                      diff === null
                        ? `${wholeFigure(day.proteinG)} g protein`
                        : onTarget(day)
                          ? `On target · ${wholeFigure(day.proteinG)} g protein`
                          : `${Math.abs(diff).toLocaleString()} ${diff > 0 ? 'over' : 'under'} · ${wholeFigure(day.proteinG)} g protein`
                    }
                    value={`${wholeFigureText(day.calories)} cal`}
                    divider={index > 0}
                    onPress={() => onOpenDay(day.key)}
                  />
                );
              })}
            </View>
          )}
        </>
      )}
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  content: {
    gap: widgetGap,
    paddingBottom: spacing.xxxl,
  },
  // The average day: the ring beside the three macros, as on the Nutrition screen.
  averageRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.lg,
    marginTop: spacing.sm,
  },
  blocks: {
    flexDirection: 'row',
    gap: widgetGap,
  },
  caption: {
    ...typeScale.caption,
    color: colors.textMuted,
  },
  empty: {
    ...typeScale.secondary,
    color: colors.textSecondary,
    marginTop: spacing.md,
  },
  historyLink: {
    alignItems: 'center',
  },
  list: {
    marginTop: spacing.md,
  },
});
