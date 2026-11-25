import { StyleSheet, TouchableOpacity, View } from 'react-native';
import { SecondaryButton } from '../design/Button';
import { StatBlock } from '../design/StatBlock';
import { Text } from '../design/Text';
import { colors, spacing, typeScale } from '../design/theme';
import type { StepsToday } from '../health/useStepsToday';
import { ProgressCardHeader } from './ProgressCardHeader';
import { progressStyles as styles } from './progressStyles';

interface Props {
  steps: StepsToday;
  accentColor: string;
  /** Opens Progress's Steps tab: the last four weeks. */
  onOpenSteps: () => void;
}

/**
 * Today's steps at the top of Progress's Overview, from Apple Health (iPhone only): the count,
 * with a way to the Steps tab's four weeks -- or, until Progresso has asked, a way to connect it.
 * Apple Health hides whether reading was allowed, so a count of 0 comes with where to check.
 * Nothing at all off iPhone.
 */
export function StepsTodayBlock({ steps, accentColor, onOpenSteps }: Props) {
  const { access, failure } = steps;
  if (failure && access !== 'asked') {
    return (
      <View testID="progress-steps-today" style={styles.overviewCard}>
        <ProgressCardHeader
          title="Steps"
          icon="trending-up"
          accentColor={accentColor}
          subtitle="Apple Health couldn’t be reached, so steps can’t show."
        />
        <Text testID="progress-steps-today-failure" style={local.failure}>
          {failure}
        </Text>
      </View>
    );
  }
  if (access === null || access === 'unavailable') return null;

  if (access === 'notAsked') {
    return (
      <View testID="progress-steps-today" style={styles.overviewCard}>
        <ProgressCardHeader
          title="Steps"
          icon="trending-up"
          accentColor={accentColor}
          subtitle="See today’s steps here and on your Home Screen. Progresso only reads them, and they stay on your phone."
        />
        <SecondaryButton
          testID="progress-steps-today-connect"
          label="Connect Apple Health"
          icon="heart"
          size="md"
          loading={steps.connecting}
          onPress={() => void steps.connect()}
        />
      </View>
    );
  }

  return (
    <View testID="progress-steps-today" style={styles.overviewCard}>
      <ProgressCardHeader
        title="Steps Today"
        icon="trending-up"
        accentColor={accentColor}
        subtitle="From Apple Health"
        action={
          <TouchableOpacity
            testID="progress-steps-today-history"
            onPress={onOpenSteps}
            accessibilityRole="button"
            accessibilityLabel="See your steps over the last four weeks"
          >
            <Text style={[styles.viewAllText, { color: accentColor }]}>4 Weeks</Text>
          </TouchableOpacity>
        }
      />
      <StatBlock
        testID="progress-steps-today-count"
        value={steps.steps === null ? '—' : steps.steps.toLocaleString()}
        label="Steps"
        valueColor={accentColor}
      />
      {steps.steps === 0 ? (
        <Text testID="progress-steps-today-hint" style={local.hint}>
          No steps showing? In the Health app, tap your picture, then Apps, then Progresso, and turn
          on Steps.
        </Text>
      ) : null}
    </View>
  );
}

const local = StyleSheet.create({
  hint: {
    ...typeScale.secondary,
    color: colors.textSecondary,
    marginTop: spacing.xs,
  },
  failure: {
    ...typeScale.caption,
    color: colors.textMuted,
  },
});
