import { Feather } from '@expo/vector-icons';
import { StyleSheet, View } from 'react-native';
import { SecondaryButton } from '../design/Button';
import { Card } from '../design/Card';
import { StatValue } from '../design/StatValue';
import { Text } from '../design/Text';
import { colors, spacing, typeScale } from '../design/theme';
import type { StepsAccess } from '../health/steps';

interface Props {
  access: StepsAccess | null;
  steps: number | null;
  connecting: boolean;
  onConnect: () => void;
}

/**
 * Feed's Steps card, under Next Workout: today's steps from Apple Health, or, until Progresso has
 * asked, a way to connect it. A regular neutral card -- the count is a neutral readout, like
 * Feed's other figures. Absent off iPhone. Apple Health hides whether reading was allowed, so a
 * count of 0 comes with where to check.
 */
export function StepsCard({ access, steps, connecting, onConnect }: Props) {
  if (access === null || access === 'unavailable') return null;

  const heading = (
    <View style={styles.heading}>
      <Feather name="trending-up" size={13} color={colors.textMuted} />
      <Text style={styles.label}>{access === 'asked' ? 'Steps Today' : 'Steps'}</Text>
      <Text style={styles.source}>Apple Health</Text>
    </View>
  );

  if (access === 'notAsked') {
    return (
      <Card testID="feed-steps">
        {heading}
        <Text style={styles.body}>
          See today’s steps here and on your Home Screen. Progresso only reads them, and they stay
          on your phone.
        </Text>
        <View style={styles.action}>
          <SecondaryButton
            testID="feed-steps-connect"
            label="Connect Apple Health"
            icon="heart"
            size="md"
            loading={connecting}
            onPress={onConnect}
          />
        </View>
      </Card>
    );
  }

  const count = steps === null ? '—' : steps.toLocaleString();
  return (
    <Card testID="feed-steps">
      {heading}
      <StatValue testID="feed-steps-count" value={count} color={colors.textPrimary} />
      {steps === 0 ? (
        <Text testID="feed-steps-hint" style={styles.hint}>
          No steps showing? In the Health app, tap your picture, then Apps, then Progresso, and turn
          on Steps.
        </Text>
      ) : null}
    </Card>
  );
}

const styles = StyleSheet.create({
  heading: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.xs,
    marginBottom: spacing.sm,
  },
  label: {
    ...typeScale.label,
    color: colors.textPrimary,
    flex: 1,
  },
  source: {
    ...typeScale.caption,
    color: colors.textMuted,
  },
  body: {
    ...typeScale.secondary,
    color: colors.textSecondary,
  },
  action: {
    marginTop: spacing.md,
  },
  hint: {
    ...typeScale.secondary,
    color: colors.textSecondary,
    marginTop: spacing.xs,
  },
});
