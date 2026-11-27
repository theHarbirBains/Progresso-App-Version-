import { ScrollView, StyleSheet, View } from 'react-native';
import { AnimatedBar } from '../design/AnimatedBar';
import { SecondaryButton } from '../design/Button';
import { SectionHeader } from '../design/SectionHeader';
import { SkeletonCards } from '../design/Skeleton';
import { StatBlock } from '../design/StatBlock';
import { Text } from '../design/Text';
import { colors, fonts, spacing, typeScale, widgetGap } from '../design/theme';
import { useStepsHistory } from '../health/useStepsHistory';
import { ProgressCardHeader } from './ProgressCardHeader';
import { progressStyles } from './progressStyles';
import { stepsDaysToRead, stepsHistory } from './stepsHistory';
import { weekLabel } from './WeeklySummaryBlock';

interface Props {
  accentColor: string;
  now?: () => Date;
  /** Inside another page's scroll (the Health prototype's Activity page): no scroll of its own. */
  embedded?: boolean;
}

const WEEKDAYS = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];
const MONTHS = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];

/** "Today", or "Thu, Nov 12". */
function dayName(day: string, today: string): string {
  if (day === today) return 'Today';
  const [year, month, date] = day.split('-').map(Number);
  const at = new Date(year, month - 1, date);
  return `${WEEKDAYS[at.getDay()]}, ${MONTHS[at.getMonth()]} ${at.getDate()}`;
}

function share(value: number, most: number): number {
  return most > 0 ? value / most : 0;
}

/**
 * Progress's Health tab's steps (iPhone only): from Apple Health -- today, this week and the 7-day
 * average as figures, then the last 7 days and the last 4 weeks (Monday to Sunday) as rows with
 * bars of the way to the most in the list. No line graph, no goal and no judgement: the figures
 * say what happened. Read on the phone each time the tab opens and kept nowhere. Until Progresso
 * has asked, it offers to connect Apple Health, as Feed's Steps card does.
 */
export function StepsSection({ accentColor, now = () => new Date(), embedded = false }: Props) {
  const today = now();
  const { access, days, connecting, failure, connect } = useStepsHistory(
    stepsDaysToRead(today),
    now,
  );

  if (failure && access !== 'asked') {
    return (
      <View testID="progress-steps" style={styles.content}>
        <ProgressCardHeader title="Steps" />
        <Text style={styles.body}>Apple Health couldn’t be reached, so steps can’t show.</Text>
        <Text testID="progress-steps-failure" style={styles.caption}>
          {failure}
        </Text>
      </View>
    );
  }

  if (access === 'unavailable') {
    return (
      <View testID="progress-steps" style={styles.content}>
        <ProgressCardHeader title="Steps" />
        <Text testID="progress-steps-unavailable" style={styles.body}>
          Steps come from Apple Health, which isn’t available here.
        </Text>
      </View>
    );
  }

  if (access === 'notAsked') {
    return (
      <View testID="progress-steps" style={styles.content}>
        <ProgressCardHeader
          title="Steps"
          subtitle="Your daily and weekly steps, from Apple Health"
        />
        <Text style={styles.body}>
          Connect Apple Health to see your steps each day and each week. Progresso only reads them,
          and they stay on your phone.
        </Text>
        <View style={styles.action}>
          <SecondaryButton
            testID="progress-steps-connect"
            label="Connect Apple Health"
            icon="heart"
            size="md"
            loading={connecting}
            onPress={() => void connect()}
          />
        </View>
      </View>
    );
  }

  if (access === null || days === null) {
    return <SkeletonCards testID="progress-steps-loading" heights={[96, 220, 160]} />;
  }

  const history = stepsHistory(days, today);
  const todayKey = history.lastSevenDays[history.lastSevenDays.length - 1].day;
  const mostInADay = Math.max(...history.lastSevenDays.map((day) => day.steps));
  const mostInAWeek = Math.max(...history.weeks.map((week) => week.total));
  const nothing = days.every((day) => day.steps === 0);

  const body = (
    <>
      <ProgressCardHeader title="Steps" subtitle="From Apple Health, on this phone" />
      <View style={styles.figures}>
        <StatBlock
          testID="progress-steps-today"
          value={history.today.toLocaleString()}
          label="Today"
          valueColor={accentColor}
        />
        <StatBlock
          testID="progress-steps-this-week"
          value={history.thisWeek.toLocaleString()}
          label="This Week"
        />
        <StatBlock
          testID="progress-steps-average"
          value={history.sevenDayAverage.toLocaleString()}
          label="7-Day Average"
        />
      </View>
      {nothing ? (
        <Text testID="progress-steps-hint" style={styles.body}>
          No steps showing? In the Health app, tap your picture, then Apps, then Progresso, and turn
          on Steps.
        </Text>
      ) : null}

      <View style={styles.part}>
        <SectionHeader label="Last 7 Days" />
        {[...history.lastSevenDays].reverse().map((day) => {
          const name = dayName(day.day, todayKey);
          return (
            <View
              key={day.day}
              testID={`progress-steps-day-${day.day}`}
              style={styles.row}
              accessible
              accessibilityLabel={`${name}, ${day.steps.toLocaleString()} steps`}
            >
              <View style={styles.rowLine}>
                <Text style={styles.rowLabel}>{name}</Text>
                <Text style={styles.rowValue}>{day.steps.toLocaleString()}</Text>
              </View>
              <AnimatedBar fraction={share(day.steps, mostInADay)} color={accentColor} />
            </View>
          );
        })}
      </View>

      <View style={styles.part}>
        <SectionHeader label="Weekly Totals" />
        {history.weeks.map((week) => {
          const name = week.current ? 'This Week' : weekLabel(week);
          const average = `${week.dailyAverage.toLocaleString()} a day${week.current ? ' so far' : ''}`;
          return (
            <View
              key={week.start.toISOString()}
              testID={week.current ? 'progress-steps-week-current' : 'progress-steps-week'}
              style={styles.row}
              accessible
              accessibilityLabel={`${name}, ${week.total.toLocaleString()} steps, ${average}`}
            >
              <View style={styles.rowLine}>
                <View style={styles.rowText}>
                  <Text style={styles.rowLabel}>{name}</Text>
                  <Text style={styles.caption}>{average}</Text>
                </View>
                <Text style={styles.rowValue}>{week.total.toLocaleString()}</Text>
              </View>
              <AnimatedBar fraction={share(week.total, mostInAWeek)} color={accentColor} />
            </View>
          );
        })}
      </View>
    </>
  );
  return embedded ? (
    <View testID="progress-steps">{body}</View>
  ) : (
    <ScrollView
      keyboardDismissMode="on-drag"
      testID="progress-steps"
      style={progressStyles.sectionFill}
      contentContainerStyle={styles.content}
      showsVerticalScrollIndicator={false}
    >
      {body}
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  content: {
    paddingBottom: spacing.xxxl,
  },
  figures: {
    flexDirection: 'row',
    gap: widgetGap,
  },
  part: {
    marginTop: spacing.xl,
  },
  row: {
    paddingVertical: spacing.sm,
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
  body: {
    ...typeScale.secondary,
    color: colors.textSecondary,
    marginTop: spacing.sm,
  },
  caption: {
    ...typeScale.caption,
    color: colors.textMuted,
    marginTop: 2,
  },
  action: {
    marginTop: spacing.md,
  },
});
