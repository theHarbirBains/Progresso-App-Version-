import { Feather, MaterialCommunityIcons } from '@expo/vector-icons';
import { useMemo, useRef, useState, type Ref } from 'react';
import {
  Pressable,
  StyleSheet,
  TextInput as RNTextInput,
  View,
  type TextInputInstance,
} from 'react-native';
import { AppCard } from '../design/AppCard';
import { PrimaryButton, TextButton } from '../design/Button';
import { RiseIn } from '../design/RiseIn';
import { SegmentedControl } from '../design/SegmentedControl';
import { Text } from '../design/Text';
import { colors, fonts, radii, spacing, typeScale } from '../design/theme';
import type { ActivityLevel, FitnessGoal, Gender } from '../lib/api';
import { ageFromBirthday } from '../nutrition/calorieEstimationInput';
import { computeCalorieTargets } from '../nutrition/calorieTargets';
import {
  KCAL_PER_GRAM,
  carbsFor,
  macroGuidance,
  parseField,
  type TargetValues,
} from '../nutrition/targetMath';
import { withAlpha } from '../theme/accentColor';
import { useAppTheme } from '../theme/appThemeContext';

type Plan = 'lose' | 'maintain' | 'gain';

const PLAN_LABELS: Record<Plan, string> = {
  lose: 'Lose weight',
  maintain: 'Maintain',
  gain: 'Gain weight',
};

type MacroKey = 'protein' | 'carbs' | 'fat';

// Each macro's glyph -- the same set as Nutrition Today's macro rows -- and how strong its accent
// is in the calorie bar and on its widget, so the two read together.
const MACROS: {
  key: MacroKey;
  label: string;
  glyph: keyof typeof MaterialCommunityIcons.glyphMap;
  strength: number;
}[] = [
  { key: 'protein', label: 'Protein', glyph: 'food-drumstick-outline', strength: 1 },
  { key: 'carbs', label: 'Carbs', glyph: 'barley', strength: 0.6 },
  { key: 'fat', label: 'Fat', glyph: 'water-outline', strength: 0.32 },
];

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

/** A figure typed straight into its widget: the number in mono, a faint line under it to say it
 * can be changed. */
function FigureInput({
  testID,
  value,
  onChangeText,
  placeholder,
  keyboardType,
  large = false,
  accessibilityLabel,
  inputRef,
}: {
  testID: string;
  value: string;
  onChangeText: (next: string) => void;
  placeholder: string;
  keyboardType: 'number-pad' | 'decimal-pad';
  large?: boolean;
  accessibilityLabel: string;
  inputRef?: Ref<TextInputInstance>;
}) {
  return (
    <RNTextInput
      ref={inputRef}
      testID={testID}
      value={value}
      onChangeText={onChangeText}
      placeholder={placeholder}
      placeholderTextColor={colors.textMuted}
      keyboardType={keyboardType}
      selectTextOnFocus
      maxLength={5}
      accessibilityLabel={accessibilityLabel}
      style={[styles.figureInput, large ? styles.figureLarge : styles.figureSmall]}
    />
  );
}

/**
 * Onboarding's daily targets, for a membership with Nutrition: calories from the same estimate
 * Nutrition Goals' calculator makes (Mifflin-St Jeor from their sex, age, height, weight and how
 * active they are) -- to lose (300 under), maintain or gain (300 over), starting from their goals
 * -- and protein (0.8 g/lb), fat (0.3 g/lb) and carbs (what's left) as Nutrition Goals recommends
 * them. As widgets, all on one screen: Lose / Maintain / Gain, the day's calories in a hero widget
 * with the calories that maintain them and a bar of how they split, and a widget for each macro
 * with its share. Every figure is typed straight into its widget; nothing's saved unless they use
 * them, and they can set them later instead. Without a sex the formula knows, calories are
 * theirs to type.
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
  const caloriesRef = useRef<TextInputInstance>(null);
  const macroRefs = {
    protein: useRef<TextInputInstance>(null),
    carbs: useRef<TextInputInstance>(null),
    fat: useRef<TextInputInstance>(null),
  };

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

  const macroText: Record<MacroKey, string> = { protein, carbs, fat };
  const macroKey: Record<MacroKey, 'proteinG' | 'carbsG' | 'fatG'> = {
    protein: 'proteinG',
    carbs: 'carbsG',
    fat: 'fatG',
  };
  function changeMacro(key: MacroKey, next: string) {
    if (key === 'protein') {
      setProtein(next);
      refreshCarbs({ protein: next });
    } else if (key === 'fat') {
      setFat(next);
      refreshCarbs({ fat: next });
    } else {
      setCarbsTyped(true);
      setCarbs(next);
    }
  }

  // Each macro's share of the day's calories, for its widget and the bar.
  const dayCalories = number(calories, 'calories');
  const share = (key: MacroKey): number | null => {
    const grams = number(macroText[key], macroKey[key]);
    if (grams === null || !dayCalories) return null;
    return (grams * KCAL_PER_GRAM[key]) / dayCalories;
  };
  const shares = MACROS.map((macro) => share(macro.key));
  const barTotal = shares.reduce<number>((sum, s) => sum + (s ?? 0), 0);

  return (
    <View testID={testID} style={styles.root}>
      {estimate ? (
        <RiseIn>
          <SegmentedControl
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
        </RiseIn>
      ) : null}

      <RiseIn>
        <Pressable
          onPress={() => caloriesRef.current?.focus()}
          accessible={false}
          testID={`${testID}-calories-widget`}
        >
          <AppCard hero>
            <View style={styles.calorieHead}>
              <Feather name="zap" size={14} color={accent.accent} />
              <Text style={styles.kicker}>DAILY CALORIES</Text>
              <Feather name="edit-2" size={12} color={colors.textMuted} style={styles.editMark} />
            </View>
            <View style={styles.calorieRow}>
              <FigureInput
                testID={`${testID}-calories`}
                inputRef={caloriesRef}
                value={calories}
                onChangeText={(next) => {
                  setCalories(next);
                  refreshCarbs({ calories: next });
                }}
                placeholder="2200"
                keyboardType="number-pad"
                large
                accessibilityLabel="Daily calories"
              />
              <Text style={styles.calorieUnit}>cal / day</Text>
            </View>
            {estimate ? (
              <Text style={styles.calorieNote}>
                About {estimate.maintenance.toLocaleString('en-US')} keeps you where you are --
                losing is 300 under, gaining 300 over.
              </Text>
            ) : (
              <Text testID={`${testID}-no-estimate`} style={styles.calorieNote}>
                Type a daily calorie target -- or skip, and set one later in Nutrition Goals.
              </Text>
            )}
            {/* How the day's calories split between the macros. */}
            <View
              style={styles.bar}
              accessibilityElementsHidden
              importantForAccessibility="no-hide-descendants"
            >
              {barTotal > 0
                ? MACROS.map((macro, i) => (
                    <View
                      key={macro.key}
                      style={{
                        flex: Math.max(0, shares[i] ?? 0),
                        backgroundColor: withAlpha(accent.accent, macro.strength),
                      }}
                    />
                  ))
                : null}
            </View>
          </AppCard>
        </Pressable>
      </RiseIn>

      <RiseIn>
        <View style={styles.macros}>
          {MACROS.map((macro, i) => {
            const part = shares[i];
            return (
              <Pressable
                key={macro.key}
                style={styles.macroCell}
                onPress={() => macroRefs[macro.key].current?.focus()}
                accessible={false}
              >
                <AppCard style={styles.macro}>
                  <View style={styles.macroHead}>
                    <MaterialCommunityIcons name={macro.glyph} size={16} color={accent.accent} />
                    <View
                      style={[
                        styles.macroDot,
                        { backgroundColor: withAlpha(accent.accent, macro.strength) },
                      ]}
                    />
                  </View>
                  <View style={styles.macroFigure}>
                    <FigureInput
                      testID={`${testID}-${macro.key}`}
                      inputRef={macroRefs[macro.key]}
                      value={macroText[macro.key]}
                      onChangeText={(next) => changeMacro(macro.key, next)}
                      placeholder="0"
                      keyboardType="decimal-pad"
                      accessibilityLabel={`${macro.label}, grams`}
                    />
                    <Text style={styles.gram}>g</Text>
                  </View>
                  <Text style={styles.macroLabel}>{macro.label}</Text>
                  <Text style={styles.macroShare}>
                    {part === null ? ' ' : `${Math.round(part * 100)}% of calories`}
                  </Text>
                </AppCard>
              </Pressable>
            );
          })}
        </View>
      </RiseIn>

      {guidance ? (
        <Text style={styles.note}>
          Protein is 0.8 g and fat 0.3 g per pound you weigh ({guidance.weightLb} lb); carbs are the
          calories left. Tap any number to change it.
        </Text>
      ) : null}

      {error ? (
        <Text testID={`${testID}-error`} style={styles.error}>
          {error}
        </Text>
      ) : null}

      <View style={styles.actions}>
        <PrimaryButton
          testID={`${testID}-use`}
          label="Use These Targets"
          onPress={use}
          accentColor={accent.accent}
          onAccentColor={accent.onAccent}
        />
        <TextButton testID={`${testID}-skip`} label="Skip for now" onPress={onSkip} />
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  root: {
    gap: spacing.sm,
  },
  calorieHead: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.xs,
  },
  kicker: {
    ...typeScale.caption,
    letterSpacing: 1.5,
    color: colors.textSecondary,
  },
  editMark: {
    marginLeft: 'auto',
  },
  calorieRow: {
    flexDirection: 'row',
    alignItems: 'baseline',
    gap: spacing.sm,
    marginTop: spacing.xs,
  },
  calorieUnit: {
    ...typeScale.label,
    color: colors.textSecondary,
  },
  calorieNote: {
    ...typeScale.secondary,
    color: colors.textSecondaryBright,
    marginTop: spacing.xs,
  },
  bar: {
    flexDirection: 'row',
    height: 8,
    borderRadius: radii.pill,
    overflow: 'hidden',
    backgroundColor: colors.divider,
    marginTop: spacing.md,
    gap: 2,
  },
  macros: {
    flexDirection: 'row',
    gap: spacing.sm,
  },
  macroCell: {
    flex: 1,
  },
  macro: {
    padding: spacing.md,
  },
  macroHead: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  macroDot: {
    width: 8,
    height: 8,
    borderRadius: radii.pill,
  },
  macroFigure: {
    flexDirection: 'row',
    alignItems: 'baseline',
    gap: 2,
    marginTop: spacing.sm,
  },
  gram: {
    ...typeScale.label,
    color: colors.textSecondary,
  },
  macroLabel: {
    ...typeScale.label,
    fontFamily: fonts.display,
    color: colors.textPrimary,
  },
  macroShare: {
    ...typeScale.caption,
    color: colors.textMuted,
  },
  figureInput: {
    color: colors.textPrimary,
    padding: 0,
    borderBottomWidth: 1,
    borderBottomColor: colors.glassBorderStrong,
    minWidth: 40,
  },
  figureLarge: {
    fontFamily: fonts.monoBold,
    fontSize: 40,
    minWidth: 96,
  },
  figureSmall: {
    fontFamily: fonts.monoBold,
    fontSize: 20,
    flexShrink: 1,
  },
  note: {
    ...typeScale.caption,
    color: colors.textSecondary,
  },
  error: {
    ...typeScale.callout,
    color: colors.destructive,
  },
  actions: {
    gap: spacing.xs,
    marginTop: spacing.xs,
  },
});
