import { MaterialCommunityIcons } from '@expo/vector-icons';
import { StyleSheet, View } from 'react-native';
import { AnimatedBar } from '../design/AnimatedBar';
import { TextButton } from '../design/Button';
import { Text } from '../design/Text';
import { TextInput } from '../design/TextInput';
import { colors, spacing, typeScale } from '../design/theme';
import {
  FAT_G_PER_LB,
  KCAL_PER_GRAM,
  PROTEIN_G_PER_LB,
  macroGuidance,
  macroTotal,
  parseField,
  parseTargets,
  type TargetDraft,
} from './targetMath';

// Each macro's glyph -- the same set as Nutrition Today's macro rows.
const GLYPHS = {
  protein: 'food-drumstick-outline',
  carbs: 'barley',
  fat: 'water-outline',
} as const satisfies Record<string, keyof typeof MaterialCommunityIcons.glyphMap>;

function cal(value: number): string {
  return Math.round(value).toLocaleString();
}

function shareOf(macroCalories: number, calories: number | null): number | null {
  return calories !== null && calories > 0 ? macroCalories / calories : null;
}

interface FieldProps {
  draft: TargetDraft;
  onChange: (draft: TargetDraft) => void;
  testIDPrefix?: string;
}

/** The calorie target, typed. */
export function CalorieTargetField({ draft, onChange, testIDPrefix = 'targets' }: FieldProps) {
  const parsed = parseField(draft.calories, 'calories');
  return (
    <TextInput
      testID={`${testIDPrefix}-calories`}
      label="Calories"
      placeholder="e.g. 2200"
      keyboardType="number-pad"
      value={draft.calories}
      onChangeText={(text) => onChange({ ...draft, calories: text })}
      error={parsed === 'invalid' ? 'Enter whole calories, above 0' : undefined}
      rightAccessory={<Text style={styles.unit}>cal/day</Text>}
    />
  );
}

interface MacroProps extends FieldProps {
  /** The person's body weight in kg, which protein and fat are recommended from; null when unknown. */
  weightKg: number | null;
  weightUnit: 'kg' | 'lb';
  accentColor: string;
  /** Where to add a body weight when there isn't one; left out, it's only said. */
  onAddWeight?: () => void;
}

/**
 * Protein, fat and carbs, one row each with its glyph and the rule it's recommended by:
 * - protein 0.8 g and fat 0.3 g per lb of body weight, every time;
 * - carbs, whatever calories are left after protein and fat, at 4 cal a gram.
 * Every field is the person's own to type. The recommendation sits faded in a blank field and is
 * what's saved unless they type over it; a field typed differently offers it back with
 * "Use N g". Each row has a bar of its share of the calories, gliding as
 * the figures change, and under them what the macros come to against the calorie target.
 * Protein and fat past the calories are said plainly, never clamped.
 */
export function MacroTargets({
  draft,
  onChange,
  weightKg,
  weightUnit,
  accentColor,
  onAddWeight,
  testIDPrefix = 'targets',
}: MacroProps) {
  const { values, recommended, carbs, errors } = parseTargets(draft, weightKg);
  const guide = weightKg !== null ? macroGuidance(weightKg) : null;
  const total = macroTotal(values);

  const rows = [
    {
      key: 'protein' as const,
      label: 'Protein',
      field: 'proteinG' as const,
      kcal: KCAL_PER_GRAM.protein,
      rule: guide
        ? `${PROTEIN_G_PER_LB} g × ${guide.weightLb} lb = ${guide.proteinG} g`
        : `${PROTEIN_G_PER_LB} g per lb of body weight`,
    },
    {
      key: 'fat' as const,
      label: 'Fat',
      field: 'fatG' as const,
      kcal: KCAL_PER_GRAM.fat,
      rule: guide
        ? `${FAT_G_PER_LB} g × ${guide.weightLb} lb = ${guide.fatG} g`
        : `${FAT_G_PER_LB} g per lb of body weight`,
    },
    {
      key: 'carbs' as const,
      label: 'Carbs',
      field: 'carbsG' as const,
      kcal: KCAL_PER_GRAM.carbs,
      rule:
        carbs?.kind === 'carbs'
          ? `${cal(carbs.remainingCalories)} cal left ÷ 4 = ${carbs.carbsG} g`
          : carbs?.kind === 'conflict'
            ? 'No calories left after protein and fat'
            : 'The calories left after protein and fat',
    },
  ];

  const lead = guide
    ? `Faded numbers are recommended, from your body weight (${weightText(weightKg ?? 0, weightUnit, guide.weightLb)}). Type over any to set your own.`
    : 'Add your body weight to get protein and fat recommended: 0.8 g and 0.3 g per lb.';

  return (
    <View style={styles.group}>
      <View testID={`${testIDPrefix}-guidance`} style={styles.leadBlock}>
        <Text style={styles.lead}>{lead}</Text>
        {!guide && onAddWeight ? (
          <TextButton
            testID={`${testIDPrefix}-add-weight`}
            label="Add Weight"
            onPress={onAddWeight}
          />
        ) : null}
      </View>

      {rows.map((row) => {
        const typed = draft[row.field].trim() !== '';
        const recommendation = recommended[row.field];
        const grams = values[row.field];
        const share = grams !== null ? shareOf(grams * row.kcal, values.calories) : null;
        // A typed number that isn't the recommendation is offered it back, by clearing the field
        // so the faded number shows again.
        const offer = recommendation !== null && typed && grams !== recommendation;
        return (
          <View key={row.key} testID={`${testIDPrefix}-${row.key}-row`} style={styles.row}>
            <View style={styles.head}>
              <View style={styles.glyph}>
                <MaterialCommunityIcons name={GLYPHS[row.key]} size={18} color={accentColor} />
              </View>
              <View style={styles.body}>
                <Text style={styles.label}>{row.label}</Text>
                <Text testID={`${testIDPrefix}-${row.key}-rule`} style={styles.rule}>
                  {row.rule}
                </Text>
              </View>
              <View style={styles.input}>
                <TextInput
                  testID={`${testIDPrefix}-${row.key}`}
                  accessibilityLabel={`${row.label} (g)`}
                  placeholder={recommendation !== null ? String(recommendation) : '—'}
                  keyboardType="decimal-pad"
                  value={draft[row.field]}
                  onChangeText={(text) => onChange({ ...draft, [row.field]: text })}
                  error={errors[row.field]}
                  rightAccessory={<Text style={styles.unit}>g</Text>}
                />
              </View>
            </View>
            {share !== null ? <AnimatedBar fraction={share} color={accentColor} /> : null}
            <View style={styles.foot}>
              <Text testID={`${testIDPrefix}-${row.key}-source`} style={styles.caption}>
                {[
                  grams === null ? 'No target' : typed ? 'Yours' : 'Recommended',
                  grams !== null ? `${cal(grams * row.kcal)} cal` : null,
                  share !== null ? `${Math.round(share * 100)}%` : null,
                ]
                  .filter(Boolean)
                  .join(' · ')}
              </Text>
              {offer ? (
                <TextButton
                  testID={`${testIDPrefix}-${row.key}-use`}
                  label={`Use ${recommendation} g`}
                  accessibilityLabel={`Use the recommended ${recommendation} grams of ${row.label.toLowerCase()}`}
                  onPress={() => onChange({ ...draft, [row.field]: '' })}
                />
              ) : null}
            </View>
          </View>
        );
      })}

      {carbs?.kind === 'conflict' ? (
        <Text testID={`${testIDPrefix}-conflict`} style={styles.conflict}>
          Protein and fat come to {cal(carbs.proteinFatCalories)} cal, {cal(carbs.overBy)} more than
          your {cal(values.calories ?? 0)} cal, so no carbs are recommended. Lower protein or fat,
          or raise calories, if that isn&apos;t what you meant.
        </Text>
      ) : null}
      {total ? (
        <Text testID={`${testIDPrefix}-total`} style={styles.total}>
          {total.matches
            ? `Your macros come to ${cal(total.total)} cal, matching your calorie target.`
            : `Your macros come to ${cal(total.total)} cal, ${cal(Math.abs(total.difference))} ${total.difference > 0 ? 'over' : 'under'} your ${cal(values.calories ?? 0)} cal target.`}
        </Text>
      ) : null}
    </View>
  );
}

function weightText(weightKg: number, unit: 'kg' | 'lb', weightLb: number): string {
  return unit === 'kg' ? `${Math.round(weightKg * 10) / 10} kg, ${weightLb} lb` : `${weightLb} lb`;
}

const styles = StyleSheet.create({
  group: {
    gap: spacing.xs,
  },
  unit: {
    ...typeScale.secondary,
    color: colors.textMuted,
  },
  leadBlock: {
    alignItems: 'flex-start',
  },
  lead: {
    ...typeScale.secondary,
    color: colors.textSecondary,
  },
  row: {
    gap: spacing.xs,
    paddingVertical: spacing.sm,
    borderTopWidth: StyleSheet.hairlineWidth,
    borderTopColor: colors.divider,
  },
  head: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.md,
  },
  glyph: {
    width: 36,
    height: 36,
    borderRadius: 18,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: colors.surfaceLift,
  },
  body: {
    flex: 1,
  },
  label: {
    ...typeScale.callout,
    fontFamily: typeScale.cardTitle.fontFamily,
    color: colors.textPrimary,
  },
  rule: {
    ...typeScale.secondary,
    color: colors.textSecondary,
    marginTop: 2,
  },
  input: {
    width: 104,
  },
  foot: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    minHeight: 28,
  },
  caption: {
    ...typeScale.caption,
    color: colors.textMuted,
  },
  conflict: {
    ...typeScale.secondary,
    color: colors.destructive,
  },
  total: {
    ...typeScale.secondary,
    color: colors.textSecondary,
    marginTop: spacing.xs,
  },
});
