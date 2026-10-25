import { StyleSheet, View } from 'react-native';
import { AppCard } from '../design/AppCard';
import { TextButton } from '../design/Button';
import { Section } from '../design/Section';
import { Text } from '../design/Text';
import { colors, spacing, typeScale } from '../design/theme';
import { computeWeeklyCalorieSummary } from './nutritionCalculations';

interface Props {
  /** Calories eaten this week so far, Sunday to now; null while the earlier days are read. */
  consumed: number | null;
  /** The daily calorie target; the week's budget is 7 times it. Null when none is set. */
  dailyTarget: number | null;
  /** Days left in the week, today included. */
  daysLeft: number;
  /** The week's earlier days couldn't be read. */
  failed?: boolean;
  accentColor: string;
  onSetTarget: () => void;
}

function calories(value: number): string {
  return Math.round(value).toLocaleString();
}

/**
 * Nutrition Today's "This Week" widget: the week's calorie budget -- 7 times the daily target,
 * Sunday to Saturday -- against what's been eaten so far, as a bar in the accent, with what's
 * left and the days left to spread it over. Eating under the target one day leaves more for
 * another, and this is where that shows. Over budget is said plainly, never as an error. With
 * no daily target there's no budget to show, only a way to set one.
 */
export function WeeklyCalorieBudget({
  consumed,
  dailyTarget,
  daysLeft,
  failed = false,
  accentColor,
  onSetTarget,
}: Props) {
  const summary = consumed === null ? null : computeWeeklyCalorieSummary(consumed, dailyTarget);
  const days = `${daysLeft} ${daysLeft === 1 ? 'day' : 'days'} to go, today included`;
  const remainingText = summary
    ? summary.remaining >= 0
      ? `${calories(summary.remaining)} cal left · ${days}`
      : `${calories(-summary.remaining)} cal over this week's budget`
    : null;

  return (
    <AppCard testID="nutrition-today-week">
      <Section title="This Week">
        {dailyTarget === null ? (
          <View style={styles.noTarget}>
            <Text testID="weekly-budget-no-target" style={styles.caption}>
              Set a daily calorie target to get a weekly budget.
            </Text>
            <TextButton
              testID="weekly-budget-set-target"
              label="Set Target"
              onPress={onSetTarget}
            />
          </View>
        ) : failed ? (
          <Text testID="weekly-budget-error" style={styles.caption}>
            This week&apos;s total couldn&apos;t be loaded.
          </Text>
        ) : (
          <View
            accessible
            accessibilityLabel={
              summary
                ? `This week, ${calories(summary.consumed)} of ${calories(summary.target)} calories. ${remainingText}`
                : 'This week, loading'
            }
          >
            <View style={styles.figures}>
              <Text testID="weekly-budget-consumed" style={styles.value}>
                {summary ? calories(summary.consumed) : '—'}
              </Text>
              <Text testID="weekly-budget-target" style={styles.target}>
                / {calories(dailyTarget * 7)} cal
              </Text>
            </View>
            <View style={styles.track}>
              <View
                testID="weekly-budget-bar"
                style={[
                  styles.fill,
                  { width: `${(summary?.percent ?? 0) * 100}%`, backgroundColor: accentColor },
                ]}
              />
            </View>
            {remainingText ? (
              <Text testID="weekly-budget-remaining" style={styles.caption}>
                {remainingText}
              </Text>
            ) : null}
          </View>
        )}
      </Section>
    </AppCard>
  );
}

const styles = StyleSheet.create({
  figures: {
    flexDirection: 'row',
    alignItems: 'baseline',
    gap: spacing.xs,
  },
  value: {
    ...typeScale.statMedium,
    color: colors.textPrimary,
  },
  target: {
    ...typeScale.secondary,
    color: colors.textMuted,
  },
  // The macros' bar, a little heavier: it's this widget's one figure.
  track: {
    height: 8,
    borderRadius: 4,
    marginTop: spacing.sm,
    backgroundColor: colors.surfaceRaised,
    overflow: 'hidden',
  },
  fill: {
    height: '100%',
    borderRadius: 4,
  },
  caption: {
    ...typeScale.secondary,
    color: colors.textSecondary,
    marginTop: spacing.sm,
  },
  noTarget: {
    alignItems: 'flex-start',
  },
});
