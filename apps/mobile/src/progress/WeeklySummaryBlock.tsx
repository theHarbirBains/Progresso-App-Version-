import { useState, type ReactNode } from 'react';
import { ActivityIndicator, StyleSheet, View } from 'react-native';
import { SectionHeader } from '../design/SectionHeader';
import { SegmentedControl } from '../design/SegmentedControl';
import { StatBlock } from '../design/StatBlock';
import { Text } from '../design/Text';
import { colors, spacing, typeScale, widgetGap } from '../design/theme';
import { formatWeightKg } from '../lib/units';
import { progressStyles } from './progressStyles';
import { COMPARISON_WEEKS, type WeeklySummary } from './weeklySummary';
import type { WeekSummaries } from './useWeeklySummaries';

type Week = 'thisWeek' | 'lastWeek';

const WEEK_OPTIONS: { label: string; value: Week }[] = [
  { label: 'This Week', value: 'thisWeek' },
  { label: 'Last Week', value: 'lastWeek' },
];

interface Props {
  /** Null while the weeks are read. */
  summaries: WeekSummaries | null;
  error: string | null;
  weightUnit: 'kg' | 'lb';
  accentColor: string;
  onAccentColor: string;
}

const MONTHS = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];

/** "Oct 13 – 19", or "Sep 29 – Oct 5" across a month. */
export function weekLabel(range: { start: Date; end: Date }): string {
  const last = new Date(range.end.getFullYear(), range.end.getMonth(), range.end.getDate() - 1);
  const first = `${MONTHS[range.start.getMonth()]} ${range.start.getDate()}`;
  return last.getMonth() === range.start.getMonth()
    ? `${first} – ${last.getDate()}`
    : `${first} – ${MONTHS[last.getMonth()]} ${last.getDate()}`;
}

function count(n: number, one: string, many: string): string {
  return `${n} ${n === 1 ? one : many}`;
}

function liftText(lift: { weightKg: number; reps: number }, unit: 'kg' | 'lb'): string {
  return `${formatWeightKg(lift.weightKg, unit)} ${unit} × ${lift.reps}`;
}

/** One of the summary's parts: a small heading, then its figures. */
function Part({ title, testID, children }: { title: string; testID: string; children: ReactNode }) {
  return (
    <View testID={testID} style={styles.part}>
      <SectionHeader label={title} />
      {children}
    </View>
  );
}

/** A line of a part: what on the left, its figures on the right. */
function Line({
  label,
  value,
  detail,
  testID,
}: {
  label: string;
  value: string;
  detail?: string;
  testID: string;
}) {
  return (
    <View
      testID={testID}
      style={styles.line}
      accessible
      accessibilityLabel={[label, value, detail].filter(Boolean).join(', ')}
    >
      <View style={styles.lineLabel}>
        <Text style={styles.lineTitle} numberOfLines={1}>
          {label}
        </Text>
        {detail ? <Text style={styles.lineDetail}>{detail}</Text> : null}
      </View>
      <Text style={styles.lineValue}>{value}</Text>
    </View>
  );
}

function SummaryBody({
  summary,
  week,
  weightUnit,
}: {
  summary: WeeklySummary;
  week: Week;
  weightUnit: 'kg' | 'lb';
}) {
  if (summary.isEmpty) {
    return (
      <Text testID="weekly-summary-empty" style={styles.empty}>
        {week === 'thisWeek' ? 'Nothing logged yet this week.' : 'Nothing was logged last week.'}
      </Text>
    );
  }
  const { training, nutrition, muscleGroups, strength } = summary;

  return (
    <>
      <Part title="Training" testID="weekly-summary-training">
        <View style={styles.blocks}>
          <StatBlock
            testID="weekly-summary-workout-days"
            value={
              training.goalDays !== null
                ? `${training.workoutDays} of ${training.goalDays}`
                : String(training.workoutDays)
            }
            label="Workout Days"
          />
          <StatBlock
            testID="weekly-summary-workouts"
            value={String(training.workouts)}
            label="Workouts"
          />
          <StatBlock testID="weekly-summary-sets" value={String(training.sets)} label="Sets" />
        </View>
      </Part>

      <Part title="Nutrition" testID="weekly-summary-nutrition">
        {nutrition.loggedDays === 0 ? (
          <Text testID="weekly-summary-no-food" style={styles.empty}>
            No food logged.
          </Text>
        ) : (
          <>
            <View style={styles.blocks}>
              <StatBlock
                testID="weekly-summary-avg-calories"
                value={nutrition.avgCalories!.toLocaleString()}
                label="Avg Calories"
              />
              <StatBlock
                testID="weekly-summary-avg-protein"
                value={`${nutrition.avgProteinG}g`}
                label="Avg Protein"
              />
            </View>
            {nutrition.daysWithinCalories !== null || nutrition.daysProteinMet !== null ? (
              <View style={[styles.blocks, styles.blocksSpaced]}>
                {nutrition.daysWithinCalories !== null ? (
                  <StatBlock
                    testID="weekly-summary-calorie-days"
                    value={`${nutrition.daysWithinCalories} of ${nutrition.loggedDays}`}
                    label="Days on Calories"
                  />
                ) : null}
                {nutrition.daysProteinMet !== null ? (
                  <StatBlock
                    testID="weekly-summary-protein-days"
                    value={`${nutrition.daysProteinMet} of ${nutrition.loggedDays}`}
                    label="Days on Protein"
                  />
                ) : null}
              </View>
            ) : null}
            <Text testID="weekly-summary-logged-days" style={styles.note}>
              Out of {count(nutrition.loggedDays, 'day', 'days')} with food logged
              {nutrition.budget
                ? ` · ${Math.round(nutrition.budget.consumed).toLocaleString()} of ${nutrition.budget.target.toLocaleString()} cal for the week`
                : ''}
            </Text>
          </>
        )}
      </Part>

      {muscleGroups.length > 0 ? (
        <Part title="Muscle Groups" testID="weekly-summary-muscle-groups">
          {muscleGroups.map((group) => (
            <Line
              key={group.group}
              testID={`weekly-summary-group-${group.group}`}
              label={group.label}
              value={count(group.sets, 'set', 'sets')}
              detail={`${COMPARISON_WEEKS}-week avg ${group.averageSets}`}
            />
          ))}
        </Part>
      ) : null}

      {strength.length > 0 ? (
        <Part title="Strength" testID="weekly-summary-strength">
          {strength.map((lift) => (
            <Line
              key={lift.exerciseId}
              testID={`weekly-summary-lift-${lift.exerciseId}`}
              label={lift.exerciseName}
              value={liftText(lift.top, weightUnit)}
              detail={
                lift.previousBest
                  ? `Best of the ${COMPARISON_WEEKS} weeks before: ${liftText(lift.previousBest, weightUnit)}`
                  : `First in ${COMPARISON_WEEKS} weeks`
              }
            />
          ))}
        </Part>
      ) : null}
    </>
  );
}

/**
 * Progress Overview's Weekly Summary: this week so far, or last week, Monday to Sunday, in
 * plain numbers -- training (workout days against the weekly goal, workouts, sets), nutrition
 * (averages over the days food was logged, the days within the calorie target and on protein,
 * the week's calorie budget), the sets per muscle group against the weeks before, and the main
 * lifts' top sets against their best in the weeks before. It says what happened, never why,
 * and never judges it. Sits inside Progress's section card, so it's a block, not a card.
 */
export function WeeklySummaryBlock({
  summaries,
  error,
  weightUnit,
  accentColor,
  onAccentColor,
}: Props) {
  const [week, setWeek] = useState<Week>('thisWeek');
  const shown = summaries?.[week];

  return (
    <View testID="weekly-summary" style={progressStyles.overviewCard}>
      <View style={progressStyles.overviewCardHeader}>
        <View style={progressStyles.overviewCardTitleColumn}>
          <Text style={progressStyles.overviewCardTitle}>Weekly Summary</Text>
          {shown ? (
            <Text testID="weekly-summary-dates" style={progressStyles.overviewCardSubtitle}>
              {weekLabel(shown.range)}
            </Text>
          ) : null}
        </View>
      </View>

      <View style={styles.switch}>
        <SegmentedControl
          testID="weekly-summary-week"
          options={WEEK_OPTIONS}
          value={week}
          onChange={setWeek}
          accentColor={accentColor}
          onAccentColor={onAccentColor}
        />
      </View>

      {error ? (
        <Text testID="weekly-summary-error" style={styles.empty}>
          {error}
        </Text>
      ) : !shown ? (
        <ActivityIndicator testID="weekly-summary-loading" color={colors.textMuted} />
      ) : (
        <SummaryBody summary={shown.summary} week={week} weightUnit={weightUnit} />
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  switch: {
    marginBottom: spacing.lg,
  },
  part: {
    marginBottom: spacing.lg,
  },
  blocks: {
    flexDirection: 'row',
    gap: widgetGap,
  },
  blocksSpaced: {
    marginTop: widgetGap,
  },
  note: {
    ...typeScale.secondary,
    color: colors.textMuted,
    marginTop: spacing.sm,
  },
  empty: {
    ...typeScale.secondary,
    color: colors.textSecondary,
  },
  line: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: spacing.md,
    paddingVertical: spacing.sm,
  },
  lineLabel: {
    flex: 1,
  },
  lineTitle: {
    ...typeScale.callout,
    color: colors.textPrimary,
  },
  lineDetail: {
    ...typeScale.caption,
    color: colors.textMuted,
    marginTop: 2,
  },
  lineValue: {
    ...typeScale.statSmall,
    color: colors.textPrimary,
  },
});
