import { StyleSheet, View } from 'react-native';
import { AppCard } from '../design/AppCard';
import { PrimaryButton, SecondaryButton } from '../design/Button';
import { StatBlock } from '../design/StatBlock';
import { Text } from '../design/Text';
import { colors, spacing, typeScale } from '../design/theme';
import type { FoodInterpretation } from '../lib/api';
import { componentSourceLabel } from './interpretedFood';

interface Props {
  interpretation: FoodInterpretation;
  /** Set when the user's Food Library already has this food by name -- adding it again is blocked. */
  duplicateName: string | null;
  adding: boolean;
  onAdd: () => void;
  onDescribeAgain: () => void;
  accentColor: string;
  onAccentColor: string;
}

// Shows an interpreted food before anything is saved. Every figure states where
// it came from: Progresso's food data, or Claude's unverified estimate. An
// estimate is never presented as a measurement.
export function InterpretedFoodReview({
  interpretation,
  duplicateName,
  adding,
  onAdd,
  onDescribeAgain,
  accentColor,
  onAccentColor,
}: Props) {
  const { totals } = interpretation;
  const servingLine = `${interpretation.servingSize} ${interpretation.servingUnit} ${interpretation.name}`;

  return (
    <AppCard testID="ai-food-review">
      <View style={styles.group}>
        <Text style={styles.title}>Review before adding</Text>
        <Text testID="ai-food-review-serving" style={styles.serving}>
          {servingLine}
        </Text>
        {interpretation.preparation ? (
          <Text testID="ai-food-review-preparation" style={styles.secondary}>
            {`Prepared: ${interpretation.preparation}`}
          </Text>
        ) : null}

        {interpretation.hasEstimate ? (
          <Text testID="ai-food-review-estimate-warning" style={styles.warning}>
            {
              "Includes an AI estimate that hasn't been checked against food data. Check it before adding."
            }
          </Text>
        ) : null}

        <View style={styles.stats}>
          <StatBlock
            testID="ai-food-review-calories"
            value={`${totals.calories}`}
            label="Calories"
          />
          <StatBlock
            testID="ai-food-review-protein"
            value={`${totals.proteinG} g`}
            label="Protein"
          />
          <StatBlock testID="ai-food-review-carbs" value={`${totals.carbsG} g`} label="Carbs" />
          <StatBlock testID="ai-food-review-fat" value={`${totals.fatG} g`} label="Fat" />
        </View>

        <View style={styles.components}>
          {interpretation.components.map((component, index) => (
            <View
              key={`${component.role}-${index}`}
              testID={`ai-food-review-component-${index}`}
              style={styles.component}
            >
              <Text style={styles.componentName}>
                {`${component.quantity} ${component.unit} ${component.name}`}
              </Text>
              <Text style={styles.componentDetail}>
                {`${component.calories} kcal · ${componentSourceLabel(component)}`}
              </Text>
              {component.assumption ? (
                <Text style={styles.componentDetail}>{component.assumption}</Text>
              ) : null}
            </View>
          ))}
        </View>

        {duplicateName ? (
          <Text testID="ai-food-review-duplicate" style={styles.warning}>
            {`"${duplicateName}" is already in your Food Library, so it won't be added twice.`}
          </Text>
        ) : null}

        <PrimaryButton
          testID="ai-food-add"
          label={adding ? 'Adding…' : 'Add to Food Library'}
          loading={adding}
          disabled={adding || duplicateName !== null}
          onPress={onAdd}
          accentColor={accentColor}
          onAccentColor={onAccentColor}
        />
        <SecondaryButton
          testID="ai-food-describe-again"
          label="Describe again"
          disabled={adding}
          onPress={onDescribeAgain}
        />
      </View>
    </AppCard>
  );
}

const styles = StyleSheet.create({
  group: {
    gap: spacing.md,
  },
  title: {
    ...typeScale.cardTitle,
    color: colors.textPrimary,
  },
  serving: {
    ...typeScale.callout,
    color: colors.textPrimary,
  },
  secondary: {
    ...typeScale.secondary,
    color: colors.textSecondary,
  },
  warning: {
    ...typeScale.secondary,
    color: colors.textSecondary,
  },
  stats: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: spacing.md,
  },
  components: {
    gap: spacing.sm,
  },
  component: {
    gap: spacing.xs,
  },
  componentName: {
    ...typeScale.callout,
    color: colors.textPrimary,
  },
  componentDetail: {
    ...typeScale.caption,
    color: colors.textMuted,
  },
});
