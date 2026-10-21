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
export function CalorieTargetField({
  draft,
  onChange,
  label = 'Calories',
  testIDPrefix = 'targets',
}: FieldProps & { label?: string }) {
  const { errors } = parseTargets(draft);
  return (
    <TextInput
      testID={`${testIDPrefix}-calories`}
      label={label}
      placeholder="e.g. 2200"
      keyboardType="number-pad"
      value={draft.calories}
      onChangeText={(text) => onChange({ ...draft, calories: text })}
      error={errors.calories}
      rightAccessory={<Text style={styles.unit}>cal/day</Text>}
    />
  );
}

interface MacroProps extends FieldProps {
  /** The person's body weight in kg, which protein and fat come from; null when unknown. */
  weightKg: number | null;
  weightUnit: 'kg' | 'lb';
  accentColor: string;
  /** Where to add a body weight when there isn't one; left out, it's only said. */
  onAddWeight?: () => void;
}

/**
 * Protein, fat and carbs, laid out as the rule they follow -- one row each, with its glyph:
 * - protein: 0.8 g per lb of body weight, and fat 0.3 g per lb, every time. Each is the person's
 *   own to type; one that isn't the rule's number offers it with a "Use N g" button, never put
 *   in by itself;
 * - carbs: never typed -- whatever calories are left after protein and fat, at 4 cal a gram.
 * Each row has a bar of its share of the calories, gliding as the figures change. Protein and fat
 * that come to more than the calories are said plainly; carbs wait until one of them changes.
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
  const { values, carbs, errors } = parseTargets(draft);
  const guide = weightKg !== null ? macroGuidance(weightKg) : null;
  const weightText = guide
    ? weightUnit === 'kg'
      ? `${Math.round((weightKg ?? 0) * 10) / 10} kg (${guide.weightLb} lb)`
      : `${guide.weightLb} lb`
    : null;

  const rows = [
    {
      key: 'protein' as const,
      label: 'Protein',
      field: 'proteinG' as const,
      perLb: PROTEIN_G_PER_LB,
      grams: values.proteinG,
      suggested: guide?.proteinG ?? null,
      kcal: KCAL_PER_GRAM.protein,
    },
    {
      key: 'fat' as const,
      label: 'Fat',
      field: 'fatG' as const,
      perLb: FAT_G_PER_LB,
      grams: values.fatG,
      suggested: guide?.fatG ?? null,
      kcal: KCAL_PER_GRAM.fat,
    },
  ];

  const carbsLine =
    values.calories === null
      ? 'Set your calories to work out carbs.'
      : values.proteinG === null || values.fatG === null
        ? 'Add protein and fat to work out carbs.'
        : carbs?.kind === 'carbs'
          ? `${cal(carbs.remainingCalories)} cal left after protein and fat, ÷ 4`
          : null;
  const carbShare =
    carbs?.kind === 'carbs' ? shareOf(carbs.carbsG * KCAL_PER_GRAM.carbs, values.calories) : null;

  return (
    <View style={styles.group}>
      {guide ? (
        <Text testID={`${testIDPrefix}-guidance`} style={styles.lead}>
          From your body weight, {weightText}
        </Text>
      ) : (
        <View testID={`${testIDPrefix}-no-weight`} style={styles.noWeight}>
          <Text style={styles.lead}>
            Add your body weight to get protein and fat from it: 0.8 g and 0.3 g per lb.
          </Text>
          {onAddWeight ? (
            <TextButton
              testID={`${testIDPrefix}-add-weight`}
              label="Add Weight"
              onPress={onAddWeight}
            />
          ) : null}
        </View>
      )}

      {rows.map((row) => {
        const share = row.grams !== null ? shareOf(row.grams * row.kcal, values.calories) : null;
        const offRule = row.suggested !== null && row.grams !== row.suggested;
        return (
          <View key={row.key} testID={`${testIDPrefix}-${row.key}-row`} style={styles.row}>
            <View style={styles.head}>
              <View style={styles.glyph}>
                <MaterialCommunityIcons name={GLYPHS[row.key]} size={18} color={accentColor} />
              </View>
              <View style={styles.body}>
                <Text style={styles.label}>{row.label}</Text>
                <Text testID={`${testIDPrefix}-${row.key}-rule`} style={styles.rule}>
                  {guide ? `${row.perLb} g × ${guide.weightLb} lb` : `${row.perLb} g per lb`}
                </Text>
              </View>
              <View style={styles.input}>
                <TextInput
                  testID={`${testIDPrefix}-${row.key}`}
                  accessibilityLabel={`${row.label} (g)`}
                  placeholder="—"
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
              <Text style={styles.caption}>
                {row.grams !== null
                  ? `${cal(row.grams * row.kcal)} cal${share !== null ? ` · ${Math.round(share * 100)}%` : ''}`
                  : 'No target'}
              </Text>
              {offRule ? (
                <TextButton
                  testID={`${testIDPrefix}-${row.key}-use`}
                  label={`Use ${row.suggested} g`}
                  accessibilityLabel={`Use ${row.suggested} grams of ${row.label.toLowerCase()}, ${row.perLb} grams per pound`}
                  onPress={() => onChange({ ...draft, [row.field]: String(row.suggested) })}
                />
              ) : null}
            </View>
          </View>
        );
      })}

      <View testID={`${testIDPrefix}-carbs-row`} style={styles.row}>
        <View style={styles.head}>
          <View style={styles.glyph}>
            <MaterialCommunityIcons name={GLYPHS.carbs} size={18} color={accentColor} />
          </View>
          <View style={styles.body}>
            <Text style={styles.label}>Carbs</Text>
            {carbsLine ? (
              <Text testID={`${testIDPrefix}-carbs-rule`} style={styles.rule}>
                {carbsLine}
              </Text>
            ) : null}
          </View>
          <View style={styles.readout}>
            <Text testID={`${testIDPrefix}-carbs`} style={styles.readoutValue}>
              {carbs?.kind === 'carbs' ? `${carbs.carbsG} g` : '—'}
            </Text>
            <Text style={styles.readoutTag}>Auto</Text>
          </View>
        </View>
        {carbs?.kind === 'carbs' && carbShare !== null ? (
          <>
            <AnimatedBar fraction={carbShare} color={accentColor} />
            <View style={styles.foot}>
              <Text style={styles.caption}>
                {`${cal(carbs.carbsG * KCAL_PER_GRAM.carbs)} cal · ${Math.round(carbShare * 100)}%`}
              </Text>
            </View>
          </>
        ) : null}
        {carbs?.kind === 'conflict' ? (
          <Text testID={`${testIDPrefix}-conflict`} style={styles.conflict}>
            Protein and fat come to {cal(carbs.proteinFatCalories)} cal, {cal(carbs.overBy)} more
            than your {cal(values.calories ?? 0)} cal. Lower protein or fat, or raise calories.
          </Text>
        ) : null}
      </View>
    </View>
  );
}

/** Calories and the macros under them, as one block -- a phase's own targets. */
export function TargetsEditor(props: MacroProps) {
  return (
    <View style={styles.editor}>
      <CalorieTargetField
        draft={props.draft}
        onChange={props.onChange}
        testIDPrefix={props.testIDPrefix}
      />
      <MacroTargets {...props} />
    </View>
  );
}

const styles = StyleSheet.create({
  editor: {
    gap: spacing.lg,
  },
  group: {
    gap: spacing.xs,
  },
  unit: {
    ...typeScale.secondary,
    color: colors.textMuted,
  },
  lead: {
    ...typeScale.secondary,
    color: colors.textSecondary,
  },
  noWeight: {
    alignItems: 'flex-start',
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
  readout: {
    width: 104,
    alignItems: 'flex-end',
  },
  readoutValue: {
    ...typeScale.statSmall,
    color: colors.textPrimary,
  },
  readoutTag: {
    ...typeScale.caption,
    color: colors.textMuted,
    marginTop: 2,
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
});
