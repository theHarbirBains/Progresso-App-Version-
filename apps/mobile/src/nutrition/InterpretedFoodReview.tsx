import { useState } from 'react';
import { ActivityIndicator, StyleSheet, View } from 'react-native';
import { AppCard } from '../design/AppCard';
import { PrimaryButton, SecondaryButton } from '../design/Button';
import { ChoiceTile } from '../design/ChoiceTile';
import { RiseInStack } from '../design/RiseIn';
import { Section } from '../design/Section';
import { StatBlock } from '../design/StatBlock';
import { Text } from '../design/Text';
import { TextInput } from '../design/TextInput';
import { colors, radii, spacing, typeScale, widgetGap } from '../design/theme';
import type {
  Choice,
  ComponentPick,
  ComponentRequest,
  ComponentStatus,
  FoodInterpretation,
} from '../lib/api';
import { componentSourceLabel, parseAmount } from './interpretedFood';
import { wholeFigure } from './wholeFigures';

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
  /** Goes on to check the numbers and log the food to today's diary. */
  onLog: () => void;
  onDescribeAgain: () => void;
  accentColor: string;
  onAccentColor: string;
}

const SOURCE_LABEL: Record<string, string> = {
  progresso_catalog: 'Progresso food data',
  open_food_facts: 'Open Food Facts',
  usda_fdc: 'USDA FoodData Central',
};

function grams(value: number): string {
  return `${wholeFigure(value)} g`;
}

type Figured = Extract<ComponentStatus, { component: unknown }>;

// The review of an interpreted food, before anything is saved, as widgets that roll out in turn:
// - the food: its name and amount, how it was prepared, the AI-estimate warning, and its totals
//   as four StatBlocks (or a line saying they come once every part is set);
// - one widget per part still waiting on the person: "Which potato did you mean?" with each
//   candidate as a tile -- its name and brand, where the figures come from, its calories in the
//   accent and protein / carbs / fat, for the amount described (or per 100 g / per serving when
//   that amount can't be worked out), the closest match marked -- or "How much?" with the
//   source's own amounts as tiles and a field for their own;
// - what's in it: each settled part with its amount, calories and where they came from;
// - the actions: Review & Log, Add to Food Library, Describe again.
// Each part says where its figures came from, and a part can be settled right here, so the
// whole search never has to restart.
export function InterpretedFoodReview({
  interpretation,
  duplicateName,
  adding,
  resolvingIndex,
  onResolve,
  onAdd,
  onLog,
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
  const pending = interpretation.components.filter(
    (status) => status.state !== 'resolved' && status.state !== 'ai_estimate',
  );
  const figured = interpretation.components.filter(
    (status): status is Figured => status.state === 'resolved' || status.state === 'ai_estimate',
  );

  return (
    <View style={styles.widgets}>
      <RiseInStack>
        <AppCard hero topAccent={accentColor} testID="ai-food-review">
          <Text style={styles.eyebrow}>Your food</Text>
          <Text testID="ai-food-review-serving" style={styles.title}>
            {servingLine}
          </Text>
          {interpretation.preparation ? (
            <Text testID="ai-food-review-preparation" style={styles.secondary}>
              {`Prepared: ${interpretation.preparation}`}
            </Text>
          ) : null}
          {interpretation.hasEstimate ? (
            <Text testID="ai-food-review-estimate-warning" style={styles.secondary}>
              {
                "Includes an AI estimate that hasn't been checked against food data. Check it before adding."
              }
            </Text>
          ) : null}
          {totals ? (
            <View style={styles.statRows}>
              <View style={styles.statRow}>
                <StatBlock
                  testID="ai-food-review-calories"
                  value={`${wholeFigure(totals.calories)}`}
                  label="Calories"
                  valueColor={accentColor}
                />
                <StatBlock
                  testID="ai-food-review-protein"
                  value={grams(totals.proteinG)}
                  label="Protein"
                />
              </View>
              <View style={styles.statRow}>
                <StatBlock
                  testID="ai-food-review-carbs"
                  value={grams(totals.carbsG)}
                  label="Carbs"
                />
                <StatBlock testID="ai-food-review-fat" value={grams(totals.fatG)} label="Fat" />
              </View>
            </View>
          ) : (
            <Text testID="ai-food-review-incomplete" style={styles.secondary}>
              {pending.length === 1
                ? 'One part needs you below; then the totals appear.'
                : `${pending.length} parts need you below; then the totals appear.`}
            </Text>
          )}
        </AppCard>

        {pending.map((status) => {
          const index = status.request.index;
          const busy = resolvingIndex === index;
          return (
            <AppCard key={index} testID={`ai-food-review-component-${index}`}>
              {status.state === 'choose' ? (
                <Section title={`Which ${status.request.name} did you mean?`}>
                  <Text style={styles.secondary}>Tap the one closest to what you ate.</Text>
                  <View style={styles.tiles}>
                    {status.choices.map((choice, choiceIndex) => (
                      <ChoiceTile
                        key={`${choice.sourceKind}-${choice.sourceId}`}
                        testID={`ai-food-choice-${index}-${choiceIndex}`}
                        onPress={() => {
                          if (busy) return;
                          onResolve(
                            status.request,
                            { sourceKind: choice.sourceKind, sourceId: choice.sourceId },
                            status.request.quantity,
                          );
                        }}
                        accentColor={accentColor}
                        onAccentColor={onAccentColor}
                        accessibilityLabel={choiceLabel(choice)}
                      >
                        <ChoiceBody
                          choice={choice}
                          best={choiceIndex === 0}
                          accentColor={accentColor}
                        />
                      </ChoiceTile>
                    ))}
                  </View>
                </Section>
              ) : null}

              {status.state === 'needs_quantity' ? (
                <Section title={`How much ${status.request.name}?`}>
                  <Text style={styles.secondary}>{status.reason}</Text>
                  <View style={styles.amounts}>
                    {status.options.map((option, optionIndex) => (
                      <ChoiceTile
                        key={`${option.label}-${optionIndex}`}
                        testID={`ai-food-option-${index}-${optionIndex}`}
                        onPress={() => {
                          if (busy) return;
                          onResolve(status.request, null, {
                            amount: option.amount,
                            unit: option.unit,
                          });
                        }}
                        accessibilityLabel={`Use ${option.label}`}
                        style={styles.amountTile}
                      >
                        <Text style={styles.amountText}>{option.label}</Text>
                      </ChoiceTile>
                    ))}
                  </View>
                  <View style={styles.ownAmount}>
                    <TextInput
                      testID={`ai-food-amount-input-${index}`}
                      label="Or your own amount"
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
                </Section>
              ) : null}

              {status.state === 'not_found' ? (
                <Section title={status.request.name}>
                  <Text style={styles.secondary}>{status.reason}</Text>
                </Section>
              ) : null}

              {busy ? (
                <View testID={`ai-food-review-busy-${index}`} style={styles.busy}>
                  <ActivityIndicator color={colors.textMuted} />
                  <Text style={styles.caption}>Looking this up…</Text>
                </View>
              ) : null}
            </AppCard>
          );
        })}

        {figured.length > 0 ? (
          <AppCard testID="ai-food-review-parts">
            <Section title="What's in it">
              {figured.map((status, position) => (
                <View
                  key={status.request.index}
                  testID={`ai-food-review-part-${status.request.index}`}
                  style={[styles.part, position > 0 && styles.partDivider]}
                >
                  <View style={styles.partHead}>
                    <Text style={styles.partName}>
                      {`${status.component.quantity.amount} ${status.component.quantity.unit} ${status.component.name}`}
                    </Text>
                    <Text style={styles.partCalories}>
                      {`${wholeFigure(status.component.nutrients.calories)} cal`}
                    </Text>
                  </View>
                  <Text style={styles.caption}>{componentSourceLabel(status)}</Text>
                  {status.component.provenance.assumptions.map((assumption) => (
                    <Text key={assumption} style={styles.caption}>
                      {assumption}
                    </Text>
                  ))}
                </View>
              ))}
            </Section>
          </AppCard>
        ) : null}

        <AppCard testID="ai-food-review-actions">
          <View style={styles.actions}>
            {duplicateName ? (
              <Text testID="ai-food-review-duplicate" style={styles.secondary}>
                {`"${duplicateName}" is already in your Food Library, so it won't be added twice.`}
              </Text>
            ) : null}
            <PrimaryButton
              testID="ai-food-log"
              label="Review & Log"
              disabled={adding || !interpretation.complete}
              onPress={onLog}
              accentColor={accentColor}
              onAccentColor={onAccentColor}
            />
            <SecondaryButton
              testID="ai-food-add"
              label={adding ? 'Adding…' : 'Add to Food Library'}
              loading={adding}
              disabled={adding || !interpretation.complete || duplicateName !== null}
              onPress={onAdd}
            />
            <SecondaryButton
              testID="ai-food-describe-again"
              label="Describe again"
              disabled={adding}
              onPress={onDescribeAgain}
            />
          </View>
        </AppCard>
      </RiseInStack>
    </View>
  );
}

function choiceName(choice: Choice): string {
  return choice.brand ? `${choice.brand} · ${choice.matchedName}` : choice.matchedName;
}

function choiceLabel(choice: Choice): string {
  const name = choiceName(choice);
  if (!choice.figures) return `Choose ${name}`;
  const { nutrients, per } = choice.figures;
  return `Choose ${name}: ${wholeFigure(nutrients.calories)} calories, ${wholeFigure(nutrients.proteinG)} grams protein, ${wholeFigure(nutrients.carbsG)} carbs, ${wholeFigure(nutrients.fatG)} fat, ${per}`;
}

/** One candidate: its name, where it's from, and what it comes to. */
function ChoiceBody({
  choice,
  best,
  accentColor,
}: {
  choice: Choice;
  best: boolean;
  accentColor: string;
}) {
  return (
    <View style={styles.choice}>
      <View style={styles.choiceHead}>
        <View style={styles.choiceNames}>
          <Text style={styles.choiceName}>{choice.matchedName}</Text>
          <Text style={styles.caption}>
            {[choice.brand, SOURCE_LABEL[choice.sourceKind] ?? choice.sourceKind]
              .filter(Boolean)
              .join(' · ')}
          </Text>
        </View>
        {best ? (
          <View style={[styles.bestTag, { borderColor: accentColor }]}>
            <Text style={[styles.bestText, { color: accentColor }]}>Best match</Text>
          </View>
        ) : null}
      </View>
      {choice.figures ? (
        <View style={styles.figures}>
          <View style={styles.calories}>
            <Text style={[styles.caloriesValue, { color: accentColor }]}>
              {wholeFigure(choice.figures.nutrients.calories)}
            </Text>
            <Text style={styles.caption}>{`cal ${choice.figures.per}`}</Text>
          </View>
          <View style={styles.macros}>
            <Macro label="Protein" value={choice.figures.nutrients.proteinG} />
            <Macro label="Carbs" value={choice.figures.nutrients.carbsG} />
            <Macro label="Fat" value={choice.figures.nutrients.fatG} />
          </View>
        </View>
      ) : null}
    </View>
  );
}

function Macro({ label, value }: { label: string; value: number }) {
  return (
    <View style={styles.macro}>
      <Text style={styles.macroValue}>{grams(value)}</Text>
      <Text style={styles.caption}>{label}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  widgets: {
    gap: widgetGap,
    marginTop: widgetGap,
  },
  eyebrow: {
    ...typeScale.sectionHeading,
    color: colors.textMuted,
  },
  title: {
    ...typeScale.cardTitle,
    color: colors.textPrimary,
    marginTop: spacing.xs,
  },
  secondary: {
    ...typeScale.secondary,
    color: colors.textSecondary,
    marginTop: spacing.xs,
  },
  caption: {
    ...typeScale.caption,
    color: colors.textMuted,
  },
  statRows: {
    gap: widgetGap,
    marginTop: spacing.md,
  },
  statRow: {
    flexDirection: 'row',
    gap: widgetGap,
  },
  tiles: {
    gap: widgetGap,
    marginTop: spacing.md,
  },
  choice: {
    gap: spacing.md,
    // Room for the check a chosen tile shows in its corner.
    paddingRight: spacing.lg,
  },
  choiceHead: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: spacing.sm,
  },
  choiceNames: {
    flex: 1,
    gap: 2,
  },
  choiceName: {
    ...typeScale.callout,
    fontFamily: typeScale.cardTitle.fontFamily,
    color: colors.textPrimary,
  },
  bestTag: {
    borderWidth: 1,
    borderRadius: radii.pill,
    paddingHorizontal: spacing.sm,
    paddingVertical: 2,
  },
  bestText: {
    ...typeScale.caption,
  },
  figures: {
    flexDirection: 'row',
    alignItems: 'flex-end',
    gap: spacing.md,
  },
  calories: {
    flexShrink: 1,
  },
  caloriesValue: {
    ...typeScale.statMedium,
  },
  macros: {
    flex: 1,
    flexDirection: 'row',
    justifyContent: 'flex-end',
    gap: spacing.md,
  },
  macro: {
    alignItems: 'flex-end',
  },
  macroValue: {
    ...typeScale.statSmall,
    color: colors.textPrimary,
  },
  amounts: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: widgetGap,
    marginTop: spacing.md,
  },
  amountTile: {
    minWidth: 96,
  },
  amountText: {
    ...typeScale.callout,
    fontFamily: typeScale.cardTitle.fontFamily,
    color: colors.textPrimary,
    textAlign: 'center',
  },
  ownAmount: {
    gap: spacing.sm,
    marginTop: spacing.md,
  },
  busy: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
    marginTop: spacing.md,
  },
  part: {
    gap: 2,
    paddingVertical: spacing.sm,
  },
  partDivider: {
    borderTopWidth: StyleSheet.hairlineWidth,
    borderTopColor: colors.divider,
  },
  partHead: {
    flexDirection: 'row',
    alignItems: 'baseline',
    justifyContent: 'space-between',
    gap: spacing.md,
  },
  partName: {
    ...typeScale.callout,
    color: colors.textPrimary,
    flex: 1,
  },
  partCalories: {
    ...typeScale.statSmall,
    color: colors.textPrimary,
  },
  actions: {
    gap: spacing.sm,
  },
});
