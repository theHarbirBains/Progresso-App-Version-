import { useState } from 'react';
import { StyleSheet, View } from 'react-native';
import { Text } from '../design/Text';
import { AppCard } from '../design/AppCard';
import { AppHeader } from '../design/AppHeader';
import { PrimaryButton } from '../design/Button';
import { Screen } from '../design/Screen';
import { SegmentedControl } from '../design/SegmentedControl';
import { StatValue } from '../design/StatValue';
import { TextInput } from '../design/TextInput';
import { colors, spacing, typeScale, widgetGap } from '../design/theme';
import { FoodImage } from './FoodImage';
import { FoodMacros } from './FoodFacts';
import { useFoodLog } from './FoodLogProvider';
import {
  fromServings,
  gramsPerServing,
  servingPieces,
  toServings,
  type QuantityUnit,
} from './logQuantity';
import { defaultMealTypeForTime } from './mealTypes';
import { calculateLogTotals } from './nutritionCalculations';
import type { FoodRow } from './foodQueries';

export type LoggableFood = Pick<
  FoodRow,
  'id' | 'name' | 'servingSize' | 'servingUnit' | 'calories' | 'proteinG' | 'carbsG' | 'fatG'
> & {
  /** The food's photo, when it has one -- shown on the step; never sent to the log. */
  imageUrl?: string | null;
  /** The serving as its provider words it ("3 cookies (34 g)") -- what pieces can be counted in. */
  servingLabel?: string | null;
};

interface LogFoodStepProps {
  food: LoggableFood;
  /** The quantity the field starts at, in servings -- last time's, when re-logging from Recent. */
  initialQuantity?: number;
  /** Under the food's name in the header -- a scanned product's brand. */
  subtitle?: string;
  /** Open Food Facts' ODbL license asks integrations to credit the source. */
  showAttribution?: boolean;
  accentColor: string;
  onAccentColor: string;
  onDone: () => void;
  onCancel: () => void;
}

function capitalize(text: string): string {
  return text.charAt(0).toUpperCase() + text.slice(1);
}

function servingsText(servings: number): string {
  return `${servings} ${servings === 1 ? 'serving' : 'servings'}`;
}

/**
 * The one quantity-entry-and-log step for every "found a food, now log it"
 * flow in the app -- Food Library's own foods, a Search Food result, and a
 * scanned barcode's product all end here (see DESIGN.md's single normalized
 * food model / one logging pipeline requirement). Not a navigation route
 * itself; each caller renders it inline in place of its own content once a
 * food is selected.
 *
 * Layout: three widgets `widgetGap` apart, then the one filled Log Food
 * button. The hero holds the food's picture, the amount being logged and its
 * calories; the amount widget holds the unit switch and the field (and the
 * serving it is measured against); the last holds protein / carbs / fat.
 * Every figure follows the amount as it's typed, so what's on screen is what
 * gets logged. The amount can be typed in servings; in the pieces the
 * serving's own wording names ("3 cookies (34 g)" -> Cookies, which it
 * starts on); and, when the serving is a weight, in g or oz. Whatever it's
 * typed in, it's turned into servings, which is what the log stores.
 */
export function LogFoodStep({
  food,
  initialQuantity = 1,
  subtitle,
  showAttribution = false,
  accentColor,
  onAccentColor,
  onDone,
  onCancel,
}: LogFoodStepProps) {
  const { logFoodEntry } = useFoodLog();
  const servingGrams = gramsPerServing(food);
  const pieces = servingPieces(food.servingLabel);
  const piecesPerServing = pieces?.perServing ?? null;
  const [unit, setUnit] = useState<QuantityUnit>(pieces ? 'pieces' : 'servings');
  const [quantity, setQuantity] = useState(() =>
    fromServings(initialQuantity, pieces ? 'pieces' : 'servings', servingGrams, piecesPerServing),
  );
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const amount = Number(quantity);
  const servings = toServings(amount, unit, servingGrams, piecesPerServing);
  const validAmount = Number.isFinite(servings) && servings > 0;
  const canLog = validAmount && !saving;
  const totals = validAmount ? calculateLogTotals(food, servings) : null;

  const unitOptions: { label: string; value: QuantityUnit; accessibilityLabel?: string }[] = [
    { label: 'Servings', value: 'servings' },
    ...(pieces ? [{ label: capitalize(pieces.plural), value: 'pieces' as const }] : []),
    ...(servingGrams !== null
      ? [
          { label: 'g', value: 'g' as const, accessibilityLabel: 'Grams' },
          { label: 'oz', value: 'oz' as const, accessibilityLabel: 'Ounces' },
        ]
      : []),
  ];
  const fieldLabel: Record<QuantityUnit, string> = {
    servings: 'Quantity',
    pieces: capitalize(pieces?.plural ?? 'pieces'),
    g: 'Grams',
    oz: 'Ounces',
  };

  // What's being logged, in the unit typed and the one it comes to: "2 cookies · 23 g".
  function amountText(): string {
    if (!validAmount) return '—';
    const grams = servingGrams !== null ? Math.round(servings * servingGrams) : null;
    const withGrams = (text: string) => (grams !== null ? `${text} · ${grams} g` : text);
    switch (unit) {
      case 'pieces':
        return withGrams(`${amount} ${amount === 1 ? pieces!.singular : pieces!.plural}`);
      case 'g':
        return `${amount} g · ${servingsText(servings)}`;
      case 'oz':
        return `${amount} oz · ${servingsText(servings)}`;
      default:
        return withGrams(servingsText(servings));
    }
  }

  function changeUnit(next: QuantityUnit) {
    // The amount carries over: 1 serving of a 100 g food becomes 100 g.
    setQuantity(validAmount ? fromServings(servings, next, servingGrams, piecesPerServing) : '');
    setUnit(next);
  }

  async function handleLog() {
    if (!canLog) return;
    setError(null);
    setSaving(true);
    try {
      // Through the shared cache's own write path -- NutritionTodayScreen and
      // ProfileScreen, wherever they're mounted, see this the instant it
      // resolves, with no re-fetch of their own.
      await logFoodEntry(food, servings, defaultMealTypeForTime());
      onDone();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to log food');
      setSaving(false);
    }
  }

  return (
    <Screen
      keyboardAvoiding
      contentContainerStyle={styles.content}
      header={
        <AppHeader
          title={food.name}
          subtitle={subtitle}
          onBack={onCancel}
          testID="log-food-header"
        />
      }
    >
      <AppCard hero testID="log-food-summary">
        <View style={styles.foodRow}>
          <FoodImage uri={food.imageUrl} name={food.name} size={72} />
          <View style={styles.summaryBody}>
            <Text testID="log-food-amount" style={styles.amount}>
              {amountText()}
            </Text>
            <StatValue
              testID="log-food-calories"
              value={totals ? String(Math.round(totals.calories)) : '—'}
              unit={totals ? ' cal' : undefined}
              color={accentColor}
            />
          </View>
        </View>
      </AppCard>

      <AppCard testID="log-food-quantity-card">
        {unitOptions.length > 1 ? (
          <View style={styles.unitSwitch}>
            <SegmentedControl
              testID="log-food-unit"
              options={unitOptions}
              value={unit}
              onChange={changeUnit}
              accentColor={accentColor}
              onAccentColor={onAccentColor}
            />
          </View>
        ) : null}

        <TextInput
          testID="log-food-quantity"
          label={fieldLabel[unit]}
          value={quantity}
          onChangeText={setQuantity}
          keyboardType="decimal-pad"
        />

        <Text testID="log-food-serving" style={styles.serving}>
          1 serving: {food.servingLabel?.trim() || `${food.servingSize} ${food.servingUnit}`}
        </Text>
      </AppCard>

      <FoodMacros
        testID="log-food-macros"
        proteinG={totals ? Math.round(totals.proteinG * 10) / 10 : null}
        carbsG={totals ? Math.round(totals.carbsG * 10) / 10 : null}
        fatG={totals ? Math.round(totals.fatG * 10) / 10 : null}
        testIDs={{ protein: 'log-food-protein', carbs: 'log-food-carbs', fat: 'log-food-fat' }}
      />

      {showAttribution ? (
        <Text testID="log-food-attribution" style={styles.attribution}>
          Data from Open Food Facts
        </Text>
      ) : null}

      {error ? (
        <Text testID="log-food-error" style={styles.error}>
          {error}
        </Text>
      ) : null}

      <PrimaryButton
        testID="log-food-submit"
        label="Log Food"
        onPress={handleLog}
        loading={saving}
        disabled={!canLog && !saving}
        accentColor={accentColor}
        onAccentColor={onAccentColor}
      />
    </Screen>
  );
}

const styles = StyleSheet.create({
  content: {
    gap: widgetGap,
  },
  foodRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.lg,
  },
  summaryBody: {
    flex: 1,
  },
  amount: {
    ...typeScale.body,
    color: colors.textSecondary,
    marginBottom: spacing.xs,
  },
  unitSwitch: {
    marginBottom: spacing.md,
  },
  serving: {
    ...typeScale.secondary,
    color: colors.textMuted,
    marginTop: spacing.sm,
  },
  attribution: {
    ...typeScale.caption,
    color: colors.textMuted,
  },
  error: {
    ...typeScale.callout,
    color: colors.destructive,
  },
});
