import { useMemo, useState } from 'react';
import { StyleSheet, View } from 'react-native';
import { PrimaryButton, TextButton } from '../design/Button';
import { FilterChips } from '../design/FilterChips';
import { Text } from '../design/Text';
import { TextInput } from '../design/TextInput';
import { colors, spacing, typeScale } from '../design/theme';
import type { ActivityLevel, FitnessGoal, Gender } from '../lib/api';
import { ageFromBirthday } from '../nutrition/calorieEstimationInput';
import { computeCalorieTargets } from '../nutrition/calorieTargets';
import { carbsFor, macroGuidance, parseField, type TargetValues } from '../nutrition/targetMath';
import { useAppTheme } from '../theme/appThemeContext';

type Plan = 'lose' | 'maintain' | 'gain';

const PLAN_LABELS: Record<Plan, string> = {
  lose: 'Lose weight',
  maintain: 'Maintain',
  gain: 'Gain weight',
};

interface Props {
  testID: string;
  gender: Gender | null;
  birthday: string | null;
  weightKg: number | null;
  heightCm: number | null;
  activityLevel: ActivityLevel | null;
  fitnessGoals: FitnessGoal[];
  /** Targets already chosen here, when coming back to this step. */
  value: TargetValues | null;
  onUse: (targets: TargetValues) => void;
  onSkip: () => void;
}

/** Where their goals point: losing fat, building muscle, or neither. */
function planFor(goals: FitnessGoal[]): Plan {
  if (goals.includes('lose_fat')) return 'lose';
  if (goals.includes('build_muscle')) return 'gain';
  return 'maintain';
}

const text = (value: number | null | undefined) => (value == null ? '' : String(value));

/**
 * Onboarding's daily targets, for a membership with Nutrition: calories from the same estimate
 * Nutrition Goals' calculator makes (Mifflin-St Jeor from their sex, age, height, weight and how
 * active they are) -- to lose (300 under), maintain or gain (300 over), starting from their goals
 * -- and protein (0.8 g/lb), fat (0.3 g/lb) and carbs (what's left) as Nutrition Goals recommends
 * them. Every figure is theirs to change; nothing's saved unless they use them, and they can set
 * them later instead. Without a sex the formula knows, calories are theirs to type.
 */
export function NutritionTargetsStep({
  testID,
  gender,
  birthday,
  weightKg,
  heightCm,
  activityLevel,
  fitnessGoals,
  value,
  onUse,
  onSkip,
}: Props) {
  const { accent } = useAppTheme();
  const estimate = useMemo(() => {
    const age = birthday ? ageFromBirthday(birthday) : null;
    if ((gender !== 'male' && gender !== 'female') || !weightKg || !heightCm || !activityLevel)
      return null;
    if (age === null) return null;
    return computeCalorieTargets({ gender, age, heightCm, weightKg, activityLevel });
  }, [gender, birthday, weightKg, heightCm, activityLevel]);
  const guidance = weightKg ? macroGuidance(weightKg) : null;

  const caloriesFor = (plan: Plan) =>
    estimate
      ? plan === 'lose'
        ? estimate.deficit
        : plan === 'gain'
          ? estimate.surplus
          : estimate.maintenance
      : null;
  const carbsText = (calories: number | null, proteinG: number | null, fatG: number | null) => {
    if (calories === null || proteinG === null || fatG === null) return '';
    const carbs = carbsFor(calories, proteinG, fatG);
    return carbs.kind === 'carbs' ? String(carbs.carbsG) : '';
  };

  const [plan, setPlan] = useState<Plan>(() => planFor(fitnessGoals));
  const [calories, setCalories] = useState(() =>
    value ? text(value.calories) : text(caloriesFor(plan)),
  );
  const [protein, setProtein] = useState(() =>
    value ? text(value.proteinG) : text(guidance?.proteinG),
  );
  const [fat, setFat] = useState(() => (value ? text(value.fatG) : text(guidance?.fatG)));
  const [carbs, setCarbs] = useState(() =>
    value
      ? text(value.carbsG)
      : carbsText(caloriesFor(plan), guidance?.proteinG ?? null, guidance?.fatG ?? null),
  );
  // Carbs follow the rest until they're typed themselves.
  const [carbsTyped, setCarbsTyped] = useState(value !== null);
  const [error, setError] = useState<string | null>(null);

  function number(field: string, key: 'calories' | 'proteinG' | 'carbsG' | 'fatG') {
    const parsed = parseField(field, key);
    return parsed === 'invalid' ? null : parsed;
  }

  function refreshCarbs(next: { calories?: string; protein?: string; fat?: string }) {
    if (carbsTyped) return;
    setCarbs(
      carbsText(
        number(next.calories ?? calories, 'calories'),
        number(next.protein ?? protein, 'proteinG'),
        number(next.fat ?? fat, 'fatG'),
      ),
    );
  }

  function choosePlan(next: Plan) {
    setPlan(next);
    const nextCalories = text(caloriesFor(next));
    setCalories(nextCalories);
    refreshCarbs({ calories: nextCalories });
  }

  function use() {
    const parsed = {
      calories: parseField(calories, 'calories'),
      proteinG: parseField(protein, 'proteinG'),
      carbsG: parseField(carbs, 'carbsG'),
      fatG: parseField(fat, 'fatG'),
    };
    if (parsed.calories === null || parsed.calories === 'invalid') {
      setError('Enter a daily calorie target, in whole calories.');
      return;
    }
    if (Object.values(parsed).some((field) => field === 'invalid')) {
      setError('Enter each target in grams, above 0 -- or leave it blank.');
      return;
    }
    setError(null);
    onUse(parsed as TargetValues);
  }

  return (
    <View testID={testID} style={styles.root}>
      {estimate ? (
        <View style={styles.plans}>
          <FilterChips
            testID={`${testID}-plan`}
            options={(['lose', 'maintain', 'gain'] as const).map((option) => ({
              value: option,
              label: PLAN_LABELS[option],
            }))}
            value={plan}
            onChange={choosePlan}
            accentColor={accent.accent}
            onAccentColor={accent.onAccent}
          />
          <Text style={styles.note}>
            About {estimate.maintenance.toLocaleString('en-US')} calories a day keeps you where you
            are. Losing is 300 under it, gaining 300 over.
          </Text>
        </View>
      ) : (
        <Text testID={`${testID}-no-estimate`} style={styles.note}>
          Type a daily calorie target -- or skip, and set one later in Nutrition Goals.
        </Text>
      )}

      <TextInput
        testID={`${testID}-calories`}
        label="Calories"
        placeholder="e.g. 2,200"
        keyboardType="number-pad"
        value={calories}
        onChangeText={(next) => {
          setCalories(next);
          refreshCarbs({ calories: next });
        }}
      />
      <View style={styles.macros}>
        <View style={styles.macro}>
          <TextInput
            testID={`${testID}-protein`}
            label="Protein (g)"
            keyboardType="decimal-pad"
            value={protein}
            onChangeText={(next) => {
              setProtein(next);
              refreshCarbs({ protein: next });
            }}
          />
        </View>
        <View style={styles.macro}>
          <TextInput
            testID={`${testID}-carbs`}
            label="Carbs (g)"
            keyboardType="decimal-pad"
            value={carbs}
            onChangeText={(next) => {
              setCarbsTyped(true);
              setCarbs(next);
            }}
          />
        </View>
        <View style={styles.macro}>
          <TextInput
            testID={`${testID}-fat`}
            label="Fat (g)"
            keyboardType="decimal-pad"
            value={fat}
            onChangeText={(next) => {
              setFat(next);
              refreshCarbs({ fat: next });
            }}
          />
        </View>
      </View>
      {guidance ? (
        <Text style={styles.note}>
          Protein is 0.8 g and fat 0.3 g for each pound you weigh ({guidance.weightLb} lb); carbs
          are the calories left. Change any of them now or later in Nutrition Goals.
        </Text>
      ) : null}

      {error ? (
        <Text testID={`${testID}-error`} style={styles.error}>
          {error}
        </Text>
      ) : null}

      <PrimaryButton
        testID={`${testID}-use`}
        label="Use These Targets"
        onPress={use}
        accentColor={accent.accent}
        onAccentColor={accent.onAccent}
      />
      <TextButton testID={`${testID}-skip`} label="Skip for now" onPress={onSkip} />
    </View>
  );
}

const styles = StyleSheet.create({
  root: {
    gap: spacing.lg,
  },
  plans: {
    gap: spacing.sm,
  },
  note: {
    ...typeScale.secondary,
    color: colors.textSecondary,
  },
  macros: {
    flexDirection: 'row',
    gap: spacing.sm,
  },
  macro: {
    flex: 1,
  },
  error: {
    ...typeScale.callout,
    color: colors.destructive,
  },
});
