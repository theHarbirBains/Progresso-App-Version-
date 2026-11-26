import { useState } from 'react';
import { Feather } from '@expo/vector-icons';
import { StyleSheet, View } from 'react-native';
import { AppCard } from '../design/AppCard';
import { TextButton } from '../design/Button';
import { Section } from '../design/Section';
import { Text } from '../design/Text';
import { colors, fonts, spacing, typeScale } from '../design/theme';
import {
  calorieGoalLabel,
  computeWeeklyCalorieSummary,
  weekGoalNote,
  type CalorieGoalReading,
} from './nutritionCalculations';
import { estimatedWeekSoFar, weekdayNames, type WeekLogging } from './weekLogging';
import { wholeFigureText } from './wholeFigures';
import { CandyStripes } from '../design/HolidayDecorations';
import { useAppTheme } from '../theme/appThemeContext';

interface Props {
  /** "This Week", or another week's name ("Week of October 18"). */
  title?: string;
  /** Whether the figures run through today (the default) or through another day shown. */
  today?: boolean;
  /**
   * Calories in the week so far, from its Sunday through the day shown; null while the week is
   * read.
   */
  consumed: number | null;
  /** The daily calorie target; the week's budget is 7 times it. Null when none is set. */
  dailyTarget: number | null;
  /** Days left in the week, the day shown included. */
  daysLeft: number;
  /**
   * What the daily target is for -- a cut, maintaining or a bulk (calorieGoalFor) -- so the week
   * is read for it: under is good for a cut, over can be good for a bulk. Null when unknown.
   */
  goal?: CalorieGoalReading | null;
  /** The week's earlier days couldn't be read. */
  failed?: boolean;
  /** The week's dates, "Nov 15 – 21" (weekRangeText). */
  rangeText?: string;
  /** How the week's days before the day shown were logged (weekLogging); null while it's read. */
  logging?: WeekLogging | null;
  accentColor: string;
  onSetTarget: () => void;
  /**
   * The whole widget as one card (the default); or, for the Nutrition screen's one page, `summary`
   * -- one slim card: the title and dates, the bar, the week so far against its budget and
   * what's left, and a line when a day's unlogged; a tap opens the rest (`onOpenDetails`) -- and
   * `details`, that rest on its own, for a sheet: when the week starts over, what's left in full,
   * the unlogged days, how the week sits with the goal, and Estimate the Missing Days.
   */
  layout?: 'card' | 'summary' | 'details';
  onOpenDetails?: () => void;
}

/**
 * Nutrition's week widget, on every day: the week's calorie budget -- 7 times the daily target,
 * Sunday to Saturday -- against what's been logged from its Sunday through the day shown, as a bar
 * in the accent, with what's left and the days left to spread it over. On today it's "This Week";
 * on a day in another week, that week by its Sunday. Eating under the target one day leaves more for
 * another, and this is where that shows. Over budget is said plainly, never as an error. With
 * no daily target there's no budget to show, only a way to set one.
 *
 * Under the title, the week's dates and when it starts over (Sunday at 12:00 AM, on the phone's
 * clock). A day before the one shown with nothing logged is named as unlogged, never counted as a
 * day of eating nothing; while there is one, the week isn't read for the goal (it would look
 * like a cut that isn't). Estimate the Missing Days shows, on a tap and labelled as an estimate,
 * the week had those days been like the logged ones -- with how it's worked out -- and never
 * changes the logged total or the bar.
 */
export function WeeklyCalorieBudget({
  title = 'This Week',
  today = true,
  consumed,
  dailyTarget,
  daysLeft,
  goal = null,
  failed = false,
  rangeText,
  logging = null,
  accentColor,
  onSetTarget,
  layout = 'card',
  onOpenDetails,
}: Props) {
  const [estimateOpen, setEstimateOpen] = useState(false);
  const { decorating } = useAppTheme();
  const summary = consumed === null ? null : computeWeeklyCalorieSummary(consumed, dailyTarget);
  const unlogged = logging?.unloggedBefore ?? [];
  const estimate = summary && logging ? estimatedWeekSoFar(summary.consumed, logging) : null;
  const loggingText =
    logging && logging.daysBefore > 0
      ? unlogged.length === 0
        ? `Food logged on every day so far.`
        : `Nothing logged on ${weekdayNames(unlogged)}: ${
            unlogged.length === 1 ? 'that day counts' : 'those days count'
          } as missing, not as 0 eaten.`
      : null;
  const days = `${daysLeft} ${daysLeft === 1 ? 'day' : 'days'} to go, ${today ? 'today' : 'this day'} included`;
  const remainingText = summary
    ? summary.remaining >= 0
      ? `${wholeFigureText(summary.remaining)} cal left · ${days}`
      : `${wholeFigureText(-summary.remaining)} cal over ${today ? "this week's" : "the week's"} budget`
    : null;
  // The week so far, read for the goal: its days up to the day shown, that day included.
  // A day with nothing logged would read as eating under the target: the week isn't read then.
  const goalNote =
    summary && goal && dailyTarget !== null
      ? unlogged.length > 0
        ? 'Log the missing days to see how the week sits with your goal.'
        : weekGoalNote(goal.goal, summary.consumed, dailyTarget, 8 - daysLeft)
      : null;
  const goalLabel = goal ? calorieGoalLabel(goal) : null;
  const spoken = summary
    ? [
        `${title}, ${wholeFigureText(summary.consumed)} of ${wholeFigureText(summary.target)} calories.`,
        remainingText,
        loggingText,
        goalLabel,
        goalNote,
      ]
        .filter(Boolean)
        .join(' ')
    : `${title}, loading`;

  if (layout === 'summary') {
    const short = summary
      ? summary.remaining >= 0
        ? `${wholeFigureText(summary.remaining)} cal left · ${daysLeft} ${
            daysLeft === 1 ? 'day' : 'days'
          } to go`
        : `${wholeFigureText(-summary.remaining)} cal over`
      : null;
    return (
      <AppCard
        testID="nutrition-today-week"
        onPress={dailyTarget !== null && !failed ? onOpenDetails : undefined}
        accessibilityLabel={
          dailyTarget !== null && !failed ? `${spoken} Opens the week in full.` : undefined
        }
        style={styles.summaryCard}
      >
        <View style={styles.summaryHead}>
          <Feather name="trending-up" size={18} color={accentColor} />
          <Text style={styles.summaryTitle} numberOfLines={1}>
            {title}
          </Text>
          {rangeText ? (
            <Text testID="weekly-budget-range" style={styles.summaryRange}>
              {rangeText}
            </Text>
          ) : null}
        </View>
        {dailyTarget === null ? (
          <View style={styles.summaryNoTarget}>
            <Text testID="weekly-budget-no-target" style={styles.summaryCaption}>
              Set a daily calorie target to get a weekly budget.
            </Text>
            <TextButton
              testID="weekly-budget-set-target"
              label="Set Target"
              onPress={onSetTarget}
            />
          </View>
        ) : failed ? (
          <Text testID="weekly-budget-error" style={styles.summaryCaption}>
            {today ? 'This' : 'The'} week&apos;s total couldn&apos;t be loaded.
          </Text>
        ) : (
          <>
            <View style={styles.summaryTrack}>
              <View
                testID="weekly-budget-bar"
                style={[
                  styles.fill,
                  { width: `${(summary?.percent ?? 0) * 100}%`, backgroundColor: accentColor },
                ]}
              >
                {decorating ? <CandyStripes radius={3} /> : null}
              </View>
            </View>
            <View style={styles.summaryFigures}>
              <Text style={styles.summaryValueLine}>
                <Text testID="weekly-budget-consumed" style={styles.summaryValue}>
                  {summary ? wholeFigureText(summary.consumed) : '—'}
                </Text>
                <Text testID="weekly-budget-target" style={styles.target}>
                  {' '}
                  / {wholeFigureText(dailyTarget * 7)} cal
                </Text>
              </Text>
              {short ? (
                <Text testID="weekly-budget-remaining" style={styles.summaryRemaining}>
                  {short}
                </Text>
              ) : null}
            </View>
            {unlogged.length > 0 ? (
              <Text testID="weekly-budget-unlogged" style={styles.summaryCaption} numberOfLines={1}>
                Nothing logged on {weekdayNames(unlogged)} · tap for the week
              </Text>
            ) : null}
          </>
        )}
      </AppCard>
    );
  }

  if (layout === 'details') {
    return (
      <View testID="weekly-budget-details" accessible={false}>
        <Text style={styles.detailsTitle}>{title}</Text>
        {rangeText ? (
          <Text testID="weekly-budget-starts-over" style={styles.range}>
            {rangeText} · starts over Sunday at 12:00 AM
          </Text>
        ) : null}
        {remainingText ? (
          <Text testID="weekly-budget-remaining-full" style={styles.caption}>
            {remainingText}
          </Text>
        ) : null}
        {loggingText ? (
          <Text testID="weekly-budget-logging" style={styles.caption}>
            {loggingText}
          </Text>
        ) : null}
        {goalLabel && goalNote ? (
          <View testID="weekly-budget-goal" style={styles.goal}>
            <Text testID="weekly-budget-goal-label" style={styles.goalLabel}>
              {goalLabel}
            </Text>
            <Text testID="weekly-budget-goal-note" style={styles.goalNote}>
              {goalNote}
            </Text>
          </View>
        ) : null}
        {estimateBlock()}
      </View>
    );
  }

  /** Estimate the Missing Days: apart from the figures, and only on a tap. */
  function estimateBlock() {
    if (
      dailyTarget === null ||
      failed ||
      estimate === null ||
      logging?.averageLoggedDay == null ||
      !summary
    ) {
      return null;
    }
    return estimateOpen ? (
      <View testID="weekly-budget-estimate" style={styles.goal}>
        <Text style={styles.goalLabel}>Estimate</Text>
        <Text testID="weekly-budget-estimate-value" style={styles.goalNote}>
          About {wholeFigureText(estimate)} of {wholeFigureText(dailyTarget * 7)} cal, had{' '}
          {unlogged.length === 1 ? 'the unlogged day' : 'the unlogged days'} been like the rest.
        </Text>
        <Text testID="weekly-budget-estimate-how" style={styles.goalNote}>
          Each day with nothing logged is counted as your logged days&apos; average,{' '}
          {wholeFigureText(logging.averageLoggedDay)} cal. What you&apos;ve logged is still{' '}
          {wholeFigureText(summary.consumed)} cal.
        </Text>
        <TextButton
          testID="weekly-budget-estimate-toggle"
          label="Hide Estimate"
          onPress={() => setEstimateOpen(false)}
        />
      </View>
    ) : (
      <View style={styles.estimateToggle}>
        <TextButton
          testID="weekly-budget-estimate-toggle"
          label="Estimate the Missing Days"
          onPress={() => setEstimateOpen(true)}
        />
      </View>
    );
  }

  return (
    <AppCard testID="nutrition-today-week">
      <Section title={title}>
        {rangeText ? (
          <Text testID="weekly-budget-range" style={styles.range}>
            {rangeText} · starts over Sunday at 12:00 AM
          </Text>
        ) : null}
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
            {today ? 'This' : 'The'} week&apos;s total couldn&apos;t be loaded.
          </Text>
        ) : (
          <View accessible accessibilityLabel={spoken}>
            <View style={styles.figures}>
              <Text testID="weekly-budget-consumed" style={styles.value}>
                {summary ? wholeFigureText(summary.consumed) : '—'}
              </Text>
              <Text testID="weekly-budget-target" style={styles.target}>
                / {wholeFigureText(dailyTarget * 7)} cal
              </Text>
            </View>
            <View style={styles.track}>
              <View
                testID="weekly-budget-bar"
                style={[
                  styles.fill,
                  { width: `${(summary?.percent ?? 0) * 100}%`, backgroundColor: accentColor },
                ]}
              >
                {/* Through the holidays, a candy cane's stripes. */}
                {decorating ? <CandyStripes radius={4} /> : null}
              </View>
            </View>
            {remainingText ? (
              <Text testID="weekly-budget-remaining" style={styles.caption}>
                {remainingText}
              </Text>
            ) : null}
            {loggingText ? (
              <Text testID="weekly-budget-logging" style={styles.caption}>
                {loggingText}
              </Text>
            ) : null}
            {goalLabel && goalNote ? (
              <View testID="weekly-budget-goal" style={styles.goal}>
                <Text testID="weekly-budget-goal-label" style={styles.goalLabel}>
                  {goalLabel}
                </Text>
                <Text testID="weekly-budget-goal-note" style={styles.goalNote}>
                  {goalNote}
                </Text>
              </View>
            ) : null}
          </View>
        )}
        {/* Apart from the figures above, and only on a tap: never read as what was eaten. */}
        {estimateBlock()}
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
  range: {
    ...typeScale.secondary,
    color: colors.textMuted,
    marginBottom: spacing.sm,
  },
  estimateToggle: {
    alignItems: 'flex-start',
    marginTop: spacing.xs,
  },
  // The one-page summary card: slimmer padding, the title and dates on one line, a 6pt bar.
  summaryCard: {
    paddingVertical: 10,
  },
  summaryHead: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
  },
  summaryTitle: {
    ...typeScale.cardTitle,
    color: colors.textPrimary,
    flex: 1,
  },
  summaryRange: {
    ...typeScale.secondary,
    color: colors.textSecondary,
  },
  summaryTrack: {
    height: 6,
    borderRadius: 3,
    marginTop: spacing.sm,
    backgroundColor: colors.surfaceRaised,
    overflow: 'hidden',
  },
  summaryFigures: {
    flexDirection: 'row',
    alignItems: 'baseline',
    justifyContent: 'space-between',
    gap: spacing.sm,
    marginTop: spacing.sm,
  },
  summaryValueLine: {
    flexShrink: 0,
  },
  summaryValue: {
    ...typeScale.statSmall,
    fontFamily: fonts.mono,
    color: colors.textPrimary,
  },
  summaryRemaining: {
    ...typeScale.secondary,
    color: colors.textSecondary,
    flexShrink: 1,
    textAlign: 'right',
  },
  summaryCaption: {
    ...typeScale.secondary,
    color: colors.textSecondary,
    marginTop: spacing.xs,
  },
  summaryNoTarget: {
    alignItems: 'flex-start',
    marginTop: spacing.xs,
  },
  detailsTitle: {
    ...typeScale.cardTitle,
    color: colors.textPrimary,
    marginBottom: spacing.xs,
  },
  // What the target is for, and how the week so far sits with it.
  goal: {
    marginTop: spacing.md,
    paddingTop: spacing.md,
    borderTopWidth: StyleSheet.hairlineWidth,
    borderTopColor: colors.divider,
    gap: 2,
  },
  goalLabel: {
    ...typeScale.label,
    color: colors.textPrimary,
  },
  goalNote: {
    ...typeScale.secondary,
    color: colors.textSecondary,
  },
});
