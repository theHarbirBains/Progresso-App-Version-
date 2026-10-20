import { useEffect, useMemo, useState } from 'react';
import { ActivityIndicator, ScrollView, StyleSheet, View } from 'react-native';
import { useAuth } from '../auth/AuthProvider';
import { ListRow } from '../design/ListRow';
import { SegmentedControl } from '../design/SegmentedControl';
import { StatBlock } from '../design/StatBlock';
import { Text } from '../design/Text';
import { colors, spacing, typeScale, widgetGap } from '../design/theme';
import { fetchIntakeForRange } from '../nutrition/foodLogQueries';
import { useNutritionGoals } from '../nutrition/NutritionGoalsProvider';
import { usePhases } from '../phases/PhaseProvider';
import { dayFromKey, dayKey, effectiveTargets, phaseOn } from '../phases/phaseRules';
import { progressStyles } from './progressStyles';

type Range = 'week' | 'month' | 'quarter';

const RANGES: { label: string; value: Range; days: number }[] = [
  { label: 'Week', value: 'week', days: 7 },
  { label: 'Month', value: 'month', days: 30 },
  { label: '3 Months', value: 'quarter', days: 90 },
];

/** A day's calories count as on target when no more than this share off it. */
const TOLERANCE = 0.1;

export interface NutritionDay {
  key: string;
  calories: number;
  proteinG: number;
  /** The calorie target in force that day: a phase's own, or the daily one; null with none. */
  calorieTarget: number | null;
}

/**
 * The days with food logged, newest first, each with the calorie target in force that day --
 * the phase going that day's own where it had one, the daily target otherwise. Pure.
 */
export function nutritionDays(
  logs: { loggedAt: string; calories: number; proteinG: number }[],
  targetFor: (key: string) => number | null,
): NutritionDay[] {
  const byDay = new Map<string, { calories: number; proteinG: number }>();
  for (const log of logs) {
    const key = dayKey(new Date(log.loggedAt));
    const day = byDay.get(key) ?? { calories: 0, proteinG: 0 };
    day.calories += log.calories;
    day.proteinG += log.proteinG;
    byDay.set(key, day);
  }
  return [...byDay.entries()]
    .map(([key, day]) => ({ key, ...day, calorieTarget: targetFor(key) }))
    .sort((a, b) => b.key.localeCompare(a.key));
}

interface Props {
  accentColor: string;
  onAccentColor: string;
  /** Opens Nutrition History on this day ("YYYY-MM-DD"), where its foods are. */
  onOpenDay: (key: string) => void;
}

/**
 * Progress's Nutrition section: the last week, month or three months of logged food, in plain
 * numbers -- days logged out of the days in the range, average calories and protein over the
 * logged days, the days within 10% of the calorie target in force that day -- then every logged
 * day, newest first, each opening that day in Nutrition History to see the foods behind it. A
 * day with nothing logged is never counted as on or off target.
 */
export function NutritionProgressSection({ accentColor, onAccentColor, onOpenDay }: Props) {
  const { user } = useAuth();
  const userId = user?.id;
  const { goals } = useNutritionGoals();
  const { phases } = usePhases();
  const [range, setRange] = useState<Range>('week');
  const [logs, setLogs] = useState<
    { loggedAt: string; calories: number; proteinG: number }[] | null
  >(null);
  const [error, setError] = useState<string | null>(null);
  const span = RANGES.find((r) => r.value === range)!.days;

  useEffect(() => {
    if (!userId) return;
    let cancelled = false;
    setLogs(null);
    setError(null);
    const tomorrow = dayFromKey(dayKey(new Date()));
    tomorrow.setDate(tomorrow.getDate() + 1);
    const start = new Date(tomorrow);
    start.setDate(start.getDate() - span);
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
    () =>
      logs
        ? nutritionDays(logs, (key) => effectiveTargets(goals, phaseOn(phases, key)).calories)
        : [],
    [logs, goals, phases],
  );
  const onTarget = (day: NutritionDay) =>
    day.calorieTarget !== null &&
    Math.abs(day.calories - day.calorieTarget) <= day.calorieTarget * TOLERANCE;
  const withTarget = days.filter((day) => day.calorieTarget !== null);
  const avg = (pick: (day: NutritionDay) => number) =>
    days.length > 0
      ? Math.round(days.reduce((sum, day) => sum + pick(day), 0) / days.length)
      : null;
  const avgCalories = avg((day) => day.calories);
  const avgProtein = avg((day) => day.proteinG);

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
        <ActivityIndicator testID="progress-nutrition-loading" color={colors.textMuted} />
      ) : days.length === 0 ? (
        <Text testID="progress-nutrition-empty" style={styles.empty}>
          No food logged in this time.
        </Text>
      ) : (
        <>
          <View style={styles.blocks}>
            <StatBlock
              testID="progress-nutrition-logged"
              value={`${days.length} of ${span}`}
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
          <View style={styles.blocks}>
            <StatBlock
              testID="progress-nutrition-avg-calories"
              value={avgCalories !== null ? avgCalories.toLocaleString() : '—'}
              label="Avg Calories"
            />
            <StatBlock
              testID="progress-nutrition-avg-protein"
              value={avgProtein !== null ? `${avgProtein}g` : '—'}
              label="Avg Protein"
            />
          </View>
          <Text style={styles.caption}>
            Averages are over the days with food logged. On target is within 10% of the calorie
            target in force that day.
          </Text>

          <View style={styles.list}>
            {days.map((day, index) => {
              const diff =
                day.calorieTarget !== null ? Math.round(day.calories - day.calorieTarget) : null;
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
                      ? `${Math.round(day.proteinG)} g protein`
                      : onTarget(day)
                        ? `On target · ${Math.round(day.proteinG)} g protein`
                        : `${Math.abs(diff).toLocaleString()} ${diff > 0 ? 'over' : 'under'} · ${Math.round(day.proteinG)} g protein`
                  }
                  value={`${Math.round(day.calories).toLocaleString()} cal`}
                  divider={index > 0}
                  onPress={() => onOpenDay(day.key)}
                />
              );
            })}
          </View>
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
  list: {
    marginTop: spacing.md,
  },
});
