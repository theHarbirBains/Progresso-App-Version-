import { StyleSheet, View } from 'react-native';
import { TextButton } from '../design/Button';
import { SectionHeader } from '../design/SectionHeader';
import { Text } from '../design/Text';
import { TextInput } from '../design/TextInput';
import { colors, spacing, typeScale } from '../design/theme';
import {
  MATCH_TOLERANCE_KCAL,
  caloriesFromMacros,
  draftCarbSuggestion,
  editDraft,
  parseTargets,
  perKgGuidelines,
  suggestMacros,
  takeSuggestedCarbs,
  type TargetDraft,
} from './targetMath';

interface Props {
  draft: TargetDraft;
  onChange: (draft: TargetDraft) => void;
  /** The person's body weight in kg, for the protein and fat suggestion; null when unknown. */
  weightKg: number | null;
  weightUnit: 'kg' | 'lb';
  testIDPrefix?: string;
}

function calories(value: number): string {
  return Math.round(value).toLocaleString();
}

/**
 * The four daily targets -- calories, protein, fat, carbs -- each the person's own to type, keep
 * blank or change. Around them, only suggestions, never applied without a tap:
 * - protein and fat from body weight (0.7-0.8 g and about 0.3 g per lb), with what they are and
 *   aren't (they don't make a deficit on their own);
 * - carbs from the calories left after protein and fat. Carbs fill in by themselves until the
 *   person types their own; after that their number stays, and the new suggestion is offered
 *   beside it with a "Use" button;
 * - the calories the four come to, and how far that is from the calorie target.
 * A conflict -- protein and fat alone past the calorie target -- is explained, never clamped.
 */
export function TargetsEditor({
  draft,
  onChange,
  weightKg,
  weightUnit,
  testIDPrefix = 'targets',
}: Props) {
  const { values, errors } = parseTargets(draft);
  const suggestion = draftCarbSuggestion(draft);
  const macros = weightKg !== null ? suggestMacros(weightKg) : null;
  const perKg = perKgGuidelines();

  let carbHint: string;
  let carbAction: { label: string; onPress: () => void } | null = null;
  if (values.calories === null) {
    carbHint = 'A carb suggestion needs a calorie target.';
  } else if (values.proteinG === null || values.fatG === null) {
    carbHint = 'Add protein and fat to get a carb suggestion.';
  } else if (suggestion?.kind === 'conflict') {
    carbHint = `Protein and fat come to ${calories(suggestion.proteinFatCalories)} cal, ${calories(suggestion.overBy)} more than your calorie target. Lower protein or fat, or raise calories, and carbs can be suggested again.`;
  } else if (suggestion?.kind === 'carbs') {
    if (draft.carbsFollow) {
      carbHint = `From the ${calories(suggestion.remainingCalories)} cal left after protein and fat.`;
    } else if (values.carbsG !== null && Math.abs(values.carbsG - suggestion.carbsG) <= 1) {
      carbHint = 'Matches the calories left after protein and fat.';
    } else {
      carbHint = `Your calories, protein and fat leave room for ${suggestion.carbsG} g. Your own number stays until you change it.`;
      carbAction = {
        label: `Use ${suggestion.carbsG} g`,
        onPress: () => onChange(takeSuggestedCarbs(draft)),
      };
    }
  } else {
    carbHint = '';
  }

  let totalLine: string | null = null;
  if (values.proteinG !== null && values.carbsG !== null && values.fatG !== null) {
    const total = caloriesFromMacros(values.proteinG, values.carbsG, values.fatG);
    totalLine = `Your macros come to ${calories(total)} cal`;
    if (values.calories !== null) {
      const difference = Math.round(total - values.calories);
      totalLine +=
        Math.abs(difference) <= MATCH_TOLERANCE_KCAL
          ? ', matching your calorie target.'
          : `, ${calories(Math.abs(difference))} ${difference > 0 ? 'over' : 'under'} your ${calories(values.calories)} cal target.`;
    } else {
      totalLine += '.';
    }
  }

  return (
    <View style={styles.group}>
      <TextInput
        testID={`${testIDPrefix}-calories`}
        label="Calories"
        placeholder="e.g. 2200"
        keyboardType="number-pad"
        value={draft.calories}
        onChangeText={(text) => onChange(editDraft(draft, 'calories', text))}
        error={errors.calories}
        rightAccessory={<Text style={styles.unit}>cal/day</Text>}
      />

      <View testID={`${testIDPrefix}-macro-suggestion`} style={styles.suggestion}>
        <SectionHeader label="Suggested protein and fat" />
        {macros ? (
          <>
            <Text style={styles.suggestionLine}>
              Protein {macros.proteinLowG}–{macros.proteinHighG} g · fat about {macros.fatG} g
            </Text>
            <Text style={styles.caption}>
              {weightUnit === 'kg'
                ? `About ${perKg.proteinLow}–${perKg.proteinHigh} g protein and ${perKg.fat} g fat per kg of body weight`
                : '0.7–0.8 g protein and about 0.3 g fat per lb of body weight'}
              , a rough starting point for a calorie deficit. They&apos;re guidelines, not rules,
              and they don&apos;t make a deficit on their own: that comes from your calories against
              what you burn.
            </Text>
            <TextButton
              testID={`${testIDPrefix}-use-macros`}
              label={`Use ${macros.proteinG} g Protein and ${macros.fatG} g Fat`}
              onPress={() =>
                onChange(
                  editDraft(
                    editDraft(draft, 'proteinG', String(macros.proteinG)),
                    'fatG',
                    String(macros.fatG),
                  ),
                )
              }
            />
          </>
        ) : (
          <Text style={styles.caption}>
            Add your weight under Personal Information to see suggested protein and fat.
          </Text>
        )}
      </View>

      <View style={styles.row}>
        <View style={styles.cell}>
          <TextInput
            testID={`${testIDPrefix}-protein`}
            label="Protein (g)"
            placeholder="Optional"
            keyboardType="decimal-pad"
            value={draft.proteinG}
            onChangeText={(text) => onChange(editDraft(draft, 'proteinG', text))}
            error={errors.proteinG}
          />
        </View>
        <View style={styles.cell}>
          <TextInput
            testID={`${testIDPrefix}-fat`}
            label="Fat (g)"
            placeholder="Optional"
            keyboardType="decimal-pad"
            value={draft.fatG}
            onChangeText={(text) => onChange(editDraft(draft, 'fatG', text))}
            error={errors.fatG}
          />
        </View>
      </View>

      <View>
        <TextInput
          testID={`${testIDPrefix}-carbs`}
          label={draft.carbsFollow ? 'Carbs (g) · suggested' : 'Carbs (g)'}
          placeholder="Optional"
          keyboardType="decimal-pad"
          value={draft.carbsG}
          onChangeText={(text) => onChange(editDraft(draft, 'carbsG', text))}
          error={errors.carbsG}
        />
        {carbHint ? (
          <Text testID={`${testIDPrefix}-carb-hint`} style={styles.caption}>
            {carbHint}
          </Text>
        ) : null}
        {carbAction ? (
          <TextButton
            testID={`${testIDPrefix}-use-carbs`}
            label={carbAction.label}
            onPress={carbAction.onPress}
          />
        ) : null}
      </View>

      {totalLine ? (
        <Text testID={`${testIDPrefix}-total`} style={styles.total}>
          {totalLine}
        </Text>
      ) : null}
    </View>
  );
}

const styles = StyleSheet.create({
  group: {
    gap: spacing.lg,
  },
  row: {
    flexDirection: 'row',
    gap: spacing.md,
  },
  cell: {
    flex: 1,
  },
  unit: {
    ...typeScale.secondary,
    color: colors.textMuted,
  },
  suggestion: {
    gap: spacing.xs,
  },
  suggestionLine: {
    ...typeScale.callout,
    color: colors.textPrimary,
  },
  caption: {
    ...typeScale.caption,
    color: colors.textMuted,
    marginTop: spacing.xs,
  },
  total: {
    ...typeScale.secondary,
    color: colors.textSecondary,
  },
});
