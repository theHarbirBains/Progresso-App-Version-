import { Feather } from '@expo/vector-icons';
import { StyleSheet, useWindowDimensions, View } from 'react-native';
import { AnimatedBar } from '../design/AnimatedBar';
import { AppCard } from '../design/AppCard';
import { Text } from '../design/Text';
import { colors, fonts, spacing, typeScale } from '../design/theme';
import type { StepsToday } from '../health/useStepsToday';
import { useAppTheme } from '../theme/appThemeContext';

interface Props {
  steps: StepsToday;
  /** Opens Progress's Health tab: today's steps, the week and the last four weeks. */
  onOpen: () => void;
}

// A third of the screen, kept between these, so the greeting beside it always has room.
const MIN_WIDTH = 108;
const MAX_WIDTH = 136;

/**
 * Today's steps, from Apple Health, as a small widget beside Feed's greeting (iPhone only): the
 * count in the mono face, then a thin bar of today against the 7-day average with that average
 * under it -- there's no step goal, so the bar never says "short". Until Progresso has asked it
 * says Connect; when Apple Health can't be reached it says so. A tap always opens the Health tab,
 * which connects, explains and shows the rest. Nothing at all off iPhone.
 */
export function DailyStepsWidget({ steps, onOpen }: Props) {
  const accent = useAppTheme().accent.accent;
  const { width } = useWindowDimensions();
  const { access, failure, average } = steps;
  const broken = failure !== null && access !== 'asked';
  if (!broken && (access === null || access === 'unavailable')) return null;

  const count = access === 'asked' && steps.steps !== null ? steps.steps : null;
  const fraction = count !== null && average !== null && average > 0 ? count / average : null;
  const label = broken
    ? 'Daily steps. Apple Health couldn’t be reached.'
    : access === 'notAsked'
      ? 'Daily steps. Connect Apple Health.'
      : `Daily steps: ${count === null ? 'not read yet' : count.toLocaleString()} today${
          fraction !== null && average !== null
            ? `, ${Math.round(fraction * 100)}% of your 7-day average of ${average.toLocaleString()}`
            : ''
        }.`;

  return (
    <AppCard
      testID="feed-daily-steps"
      onPress={onOpen}
      accessibilityLabel={`${label} Opens your steps.`}
      style={[
        styles.widget,
        { width: Math.round(Math.min(MAX_WIDTH, Math.max(MIN_WIDTH, width * 0.32))) },
      ]}
    >
      <View style={styles.kickerRow}>
        <Feather name="trending-up" size={13} color={accent} />
        <Text style={styles.kicker}>STEPS</Text>
      </View>
      {broken ? (
        <>
          <Text testID="feed-daily-steps-count" style={styles.count}>
            —
          </Text>
          <Text testID="feed-daily-steps-note" style={styles.note} numberOfLines={1}>
            Health unavailable
          </Text>
        </>
      ) : access === 'notAsked' ? (
        <>
          <Text testID="feed-daily-steps-connect" style={[styles.connect, { color: accent }]}>
            Connect
          </Text>
          <Text style={styles.note} numberOfLines={1}>
            Apple Health
          </Text>
        </>
      ) : (
        <>
          <Text
            testID="feed-daily-steps-count"
            style={styles.count}
            numberOfLines={1}
            adjustsFontSizeToFit
          >
            {count === null ? '—' : count.toLocaleString()}
          </Text>
          {fraction !== null && average !== null ? (
            <>
              <View style={styles.bar}>
                <AnimatedBar testID="feed-daily-steps-bar" fraction={fraction} color={accent} />
              </View>
              <Text testID="feed-daily-steps-note" style={styles.note} numberOfLines={1}>
                7-day avg {average.toLocaleString()}
              </Text>
            </>
          ) : (
            <Text testID="feed-daily-steps-note" style={styles.note} numberOfLines={1}>
              Today
            </Text>
          )}
        </>
      )}
    </AppCard>
  );
}

const styles = StyleSheet.create({
  widget: {
    padding: spacing.md,
    flexShrink: 0,
  },
  kickerRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.xs,
  },
  kicker: {
    ...typeScale.caption,
    fontFamily: fonts.semibold,
    color: colors.textSecondary,
    letterSpacing: 0.8,
  },
  count: {
    ...typeScale.statMedium,
    fontFamily: fonts.monoBold,
    color: colors.textPrimary,
    marginTop: spacing.xs,
  },
  connect: {
    ...typeScale.callout,
    fontFamily: fonts.semibold,
    marginTop: spacing.xs,
  },
  bar: {
    marginTop: spacing.xs,
  },
  note: {
    ...typeScale.caption,
    color: colors.textMuted,
    marginTop: spacing.xs,
  },
});
