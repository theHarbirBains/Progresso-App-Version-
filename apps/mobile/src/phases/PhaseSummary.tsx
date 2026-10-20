import { useEffect, useState } from 'react';
import { ActivityIndicator, StyleSheet, View } from 'react-native';
import { useAuth } from '../auth/AuthProvider';
import { StatBlock } from '../design/StatBlock';
import { Text } from '../design/Text';
import { colors, spacing, typeScale, widgetGap } from '../design/theme';
import { formatWeightKg } from '../lib/units';
import { fetchIntakeForRange } from '../nutrition/foodLogQueries';
import { useAllTimeStats } from '../progress/AllTimeStatsProvider';
import type { TrainingPhase } from './phaseQueries';
import { dayFromKey, phaseAdherence, type PhaseAdherence } from './phaseRules';

interface Props {
  phase: TrainingPhase;
  /** The calorie target in force during the phase: its own, or the daily one. */
  calorieTarget: number | null;
  weightUnit: 'kg' | 'lb';
  testID?: string;
}

/**
 * How a phase has gone, from what was logged in it: days so far, workouts a week, the days food
 * was logged on and how many of them were within 10% of the calorie target, and the average
 * calories. Its start and target weight are shown as entered; there are no weigh-ins to draw a
 * trend from, so none is drawn. Never a forecast or a promised rate of change.
 */
export function PhaseSummary({ phase, calorieTarget, weightUnit, testID }: Props) {
  const { user } = useAuth();
  const userId = user?.id;
  const { allWorkouts } = useAllTimeStats();
  const [intake, setIntake] = useState<{ loggedAt: string; calories: number }[] | null>(null);
  const [failed, setFailed] = useState(false);

  useEffect(() => {
    if (!userId) return;
    let cancelled = false;
    const end = phase.endDate ? dayFromKey(phase.endDate) : new Date();
    end.setHours(0, 0, 0, 0);
    end.setDate(end.getDate() + 1);
    fetchIntakeForRange(userId, dayFromKey(phase.startDate), end)
      .then((rows) => {
        if (!cancelled) setIntake(rows);
      })
      .catch(() => {
        if (!cancelled) setFailed(true);
      });
    return () => {
      cancelled = true;
    };
  }, [userId, phase.startDate, phase.endDate]);

  const adherence: PhaseAdherence | null = intake
    ? phaseAdherence({ phase, calorieTarget, foodLogs: intake, workouts: allWorkouts })
    : null;

  const weights = [
    phase.startWeightKg !== null
      ? `Started at ${formatWeightKg(phase.startWeightKg, weightUnit)} ${weightUnit}`
      : null,
    phase.targetWeightKg !== null
      ? `target ${formatWeightKg(phase.targetWeightKg, weightUnit)} ${weightUnit}`
      : null,
  ].filter(Boolean);

  return (
    <View testID={testID} style={styles.group}>
      {failed ? (
        <Text style={styles.caption}>The phase&apos;s food logs couldn&apos;t be loaded.</Text>
      ) : !adherence ? (
        <ActivityIndicator color={colors.textMuted} />
      ) : (
        <>
          <View style={styles.blocks}>
            <StatBlock
              testID={testID ? `${testID}-days` : undefined}
              value={String(adherence.days)}
              label="Days"
            />
            <StatBlock
              testID={testID ? `${testID}-workouts` : undefined}
              value={String(adherence.workoutsPerWeek)}
              label="Workouts / Week"
            />
          </View>
          <View style={styles.blocks}>
            <StatBlock
              testID={testID ? `${testID}-calorie-days` : undefined}
              value={
                adherence.daysOnCalories !== null
                  ? `${adherence.daysOnCalories} of ${adherence.loggedDays}`
                  : '—'
              }
              label="Days on Calories"
            />
            <StatBlock
              testID={testID ? `${testID}-avg-calories` : undefined}
              value={adherence.avgCalories !== null ? adherence.avgCalories.toLocaleString() : '—'}
              label="Avg Calories"
            />
          </View>
          <Text style={styles.caption}>
            {adherence.loggedDays === 0
              ? 'No food logged in this phase yet.'
              : `Out of ${adherence.loggedDays} ${adherence.loggedDays === 1 ? 'day' : 'days'} with food logged${calorieTarget === null ? '. Set a calorie target to see the days on target.' : ', within 10% of the calorie target.'}`}
          </Text>
        </>
      )}
      {weights.length > 0 ? (
        <Text testID={testID ? `${testID}-weights` : undefined} style={styles.caption}>
          {weights.join(', ')}.
        </Text>
      ) : null}
    </View>
  );
}

const styles = StyleSheet.create({
  group: {
    gap: widgetGap,
  },
  blocks: {
    flexDirection: 'row',
    gap: widgetGap,
  },
  caption: {
    ...typeScale.caption,
    color: colors.textMuted,
    marginTop: spacing.xs,
  },
});
