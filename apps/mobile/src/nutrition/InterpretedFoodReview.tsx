import { useState } from 'react';
import { Pressable, StyleSheet, View } from 'react-native';
import { AppCard } from '../design/AppCard';
import { PrimaryButton, SecondaryButton } from '../design/Button';
import { StatBlock } from '../design/StatBlock';
import { Text } from '../design/Text';
import { TextInput } from '../design/TextInput';
import { colors, radii, spacing, typeScale } from '../design/theme';
import type {
  ComponentPick,
  ComponentRequest,
  ComponentStatus,
  FoodInterpretation,
} from '../lib/api';
import { componentSourceLabel, parseAmount } from './interpretedFood';

interface Props {
  interpretation: FoodInterpretation;
  /** Set when the user's Food Library already has this food by name -- adding it again is blocked. */
  duplicateName: string | null;
  adding: boolean;
  /** The index of the component being resolved right now, if any. */
  resolvingIndex: number | null;
  /**
   * Resolves one pending component. Pass a pick for a candidate the user chose, or a quantity
   * for an amount they gave. Only that component is re-run.
   */
  onResolve: (
    request: ComponentRequest,
    pick: ComponentPick | null,
    quantity: { amount: number; unit: string } | null,
  ) => void;
  onAdd: () => void;
  onDescribeAgain: () => void;
  accentColor: string;
  onAccentColor: string;
}

const SOURCE_LABEL: Record<string, string> = {
  progresso_catalog: 'Progresso food data',
  open_food_facts: 'Open Food Facts',
  usda_fdc: 'USDA FoodData Central',
};

// The review of an interpreted food, before anything is saved. Each part states where its figures
// came from. Parts still missing an amount or a choice can be resolved right here, so the whole
// search never has to restart.
export function InterpretedFoodReview({
  interpretation,
  duplicateName,
  adding,
  resolvingIndex,
  onResolve,
  onAdd,
  onDescribeAgain,
  accentColor,
  onAccentColor,
}: Props) {
  const [amountDrafts, setAmountDrafts] = useState<Record<number, string>>({});
  const { totals } = interpretation;
  const servingLine =
    interpretation.servingSize !== null && interpretation.servingUnit !== null
      ? `${interpretation.servingSize} ${interpretation.servingUnit} ${interpretation.name}`
      : interpretation.name;

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

        {totals ? (
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
        ) : (
          <Text testID="ai-food-review-incomplete" style={styles.secondary}>
            Totals appear once every part has its amount and source.
          </Text>
        )}

        <View style={styles.components}>
          {interpretation.components.map((status) => {
            const index = status.request.index;
            const busy = resolvingIndex === index;
            return (
              <View
                key={index}
                testID={`ai-food-review-component-${index}`}
                style={styles.component}
              >
                {status.state === 'resolved' || status.state === 'ai_estimate' ? (
                  <FigureRow status={status} />
                ) : null}

                {status.state === 'needs_quantity' ? (
                  <View style={styles.pending}>
                    <Text style={styles.componentName}>{`How much ${status.request.name}?`}</Text>
                    <Text style={styles.componentDetail}>{status.reason}</Text>
                    <View style={styles.chips}>
                      {status.options.map((option, optionIndex) => (
                        <Pressable
                          key={`${option.label}-${optionIndex}`}
                          testID={`ai-food-option-${index}-${optionIndex}`}
                          disabled={busy}
                          onPress={() =>
                            onResolve(status.request, null, {
                              amount: option.amount,
                              unit: option.unit,
                            })
                          }
                          accessibilityRole="button"
                          accessibilityLabel={`Use ${option.label}`}
                          style={[styles.chip, { borderColor: accentColor }]}
                        >
                          <Text style={styles.chipText}>{option.label}</Text>
                        </Pressable>
                      ))}
                    </View>
                    <View style={styles.amountRow}>
                      <TextInput
                        testID={`ai-food-amount-input-${index}`}
                        placeholder="e.g. 2 large or 150 g"
                        value={amountDrafts[index] ?? ''}
                        onChangeText={(text) =>
                          setAmountDrafts((drafts) => ({ ...drafts, [index]: text }))
                        }
                        autoCapitalize="none"
                      />
                      <SecondaryButton
                        testID={`ai-food-amount-submit-${index}`}
                        label="Use amount"
                        disabled={busy || parseAmount(amountDrafts[index] ?? '') === null}
                        onPress={() => {
                          const parsed = parseAmount(amountDrafts[index] ?? '');
                          if (parsed) onResolve(status.request, null, parsed);
                        }}
                      />
                    </View>
                  </View>
                ) : null}

                {status.state === 'choose' ? (
                  <View style={styles.pending}>
                    <Text
                      style={styles.componentName}
                    >{`Which ${status.request.name} did you mean?`}</Text>
                    {status.choices.map((choice, choiceIndex) => (
                      <Pressable
                        key={`${choice.sourceKind}-${choice.sourceId}`}
                        testID={`ai-food-choice-${index}-${choiceIndex}`}
                        disabled={busy}
                        onPress={() =>
                          onResolve(
                            status.request,
                            { sourceKind: choice.sourceKind, sourceId: choice.sourceId },
                            status.request.quantity,
                          )
                        }
                        accessibilityRole="button"
                        accessibilityLabel={`Choose ${choice.matchedName}`}
                        style={styles.choice}
                      >
                        <Text style={styles.componentName}>
                          {choice.brand
                            ? `${choice.brand} · ${choice.matchedName}`
                            : choice.matchedName}
                        </Text>
                        <Text style={styles.componentDetail}>
                          {SOURCE_LABEL[choice.sourceKind] ?? choice.sourceKind}
                        </Text>
                      </Pressable>
                    ))}
                  </View>
                ) : null}

                {status.state === 'not_found' ? (
                  <Text style={styles.warning}>{`${status.request.name}: ${status.reason}`}</Text>
                ) : null}
                {busy ? <Text style={styles.componentDetail}>Looking this up…</Text> : null}
              </View>
            );
          })}
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
          disabled={adding || !interpretation.complete || duplicateName !== null}
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

function FigureRow({ status }: { status: Extract<ComponentStatus, { component: unknown }> }) {
  const { component } = status;
  return (
    <>
      <Text style={styles.componentName}>
        {`${component.quantity.amount} ${component.quantity.unit} ${component.name}`}
      </Text>
      <Text style={styles.componentDetail}>
        {`${component.nutrients.calories} kcal · ${componentSourceLabel(status)}`}
      </Text>
      {component.provenance.assumptions.map((assumption) => (
        <Text key={assumption} style={styles.componentDetail}>
          {assumption}
        </Text>
      ))}
    </>
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
    gap: spacing.md,
  },
  component: {
    gap: spacing.xs,
  },
  pending: {
    gap: spacing.sm,
  },
  componentName: {
    ...typeScale.callout,
    color: colors.textPrimary,
  },
  componentDetail: {
    ...typeScale.caption,
    color: colors.textMuted,
  },
  chips: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: spacing.sm,
  },
  chip: {
    minHeight: 44,
    justifyContent: 'center',
    paddingHorizontal: spacing.md,
    borderWidth: 1,
    borderRadius: radii.md,
  },
  chipText: {
    ...typeScale.callout,
    color: colors.textPrimary,
  },
  amountRow: {
    gap: spacing.sm,
  },
  choice: {
    minHeight: 44,
    gap: spacing.xs,
    paddingVertical: spacing.xs,
  },
});
