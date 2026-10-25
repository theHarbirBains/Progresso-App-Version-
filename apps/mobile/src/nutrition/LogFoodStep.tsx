import { useState } from 'react';
import { Alert, StyleSheet, View } from 'react-native';
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
import { loggedJustNow } from './duplicateLog';
import { useFoodLog } from './FoodLogProvider';
import {
  amountFor,
  entryServingGrams,
  servingMeasures,
  servingsFor,
  type QuantityUnit,
} from './logQuantity';
import { defaultMealTypeForTime } from './mealTypes';
import type { EnteredAmount } from './foodLogQueries';
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
  /** Set for a recipe: how many servings it makes. */
  recipeServings?: number | null;
};

interface LogFoodStepProps {
  food: LoggableFood;
  /** The quantity the field starts at, in servings -- last time's, when re-logging from Recent. */
  initialQuantity?: number;
  /** The amount as typed last time ("150" g), when re-logging -- used when the food can still be measured that way. */
  initialEntry?: { amount: number; unit: QuantityUnit } | null;
  /** Under the food's name in the header -- a scanned product's brand. */
  subtitle?: string;
  /** Open Food Facts' ODbL license asks integrations to credit the source. */
  showAttribution?: boolean;
  accentColor: string;
  onAccentColor: string;
  /** After logging. */
  onDone?: () => void;
  onCancel: () => void;
  /**
   * Instead of logging, hands back the amount chosen -- adding a food to a saved meal or a
   * recipe. The button then reads `chooseLabel`.
   */
  onChoose?: (choice: { quantity: number; entered: EnteredAmount }) => void;
  chooseLabel?: string;
  /** The day to log to ("YYYY-MM-DD"), when it's a past day the Nutrition screen was showing. */
  day?: string;
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
  initialEntry = null,
  subtitle,
  showAttribution = false,
  accentColor,
  onAccentColor,
  onDone,
  onCancel,
  onChoose,
  chooseLabel = 'Add',
  day,
}: LogFoodStepProps) {
  const { logs, logFoodEntry } = useFoodLog();
  const { servingMl, pieces, ...known } = servingMeasures(food);
  // Grams are always on offer. A serving's weight is its own, or its wording's, or what last
  // time's amount by weight showed; failing those, the person says what one serving weighs --
  // a drink's millilitres to start, since most drinks weigh about the same.
  const knownGrams = known.servingGrams ?? entryServingGrams(initialEntry, initialQuantity);
  const [servingWeight, setServingWeight] = useState(() =>
    knownGrams === null && servingMl !== null ? String(servingMl) : '',
  );
  const typedWeight = Number(servingWeight);
  const servingGrams = knownGrams ?? (servingWeight !== '' && typedWeight > 0 ? typedWeight : null);
  const measures = { servingGrams, servingMl, pieces };
  const available = (candidate: QuantityUnit): boolean =>
    candidate === 'servings' ||
    candidate === 'g' ||
    candidate === 'oz' ||
    (candidate === 'pieces' && pieces !== null) ||
    (candidate === 'ml' && servingMl !== null);
  // Last time's amount as it was typed, when it can still be measured that way; otherwise the
  // serving's pieces when it names them, or servings.
  const startUnit: QuantityUnit =
    initialEntry && available(initialEntry.unit)
      ? initialEntry.unit
      : pieces
        ? 'pieces'
        : 'servings';
  const [unit, setUnit] = useState<QuantityUnit>(startUnit);
  const [quantity, setQuantity] = useState(() =>
    initialEntry && initialEntry.unit === startUnit
      ? String(initialEntry.amount)
      : amountFor(initialQuantity, startUnit, measures),
  );
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const amount = Number(quantity);
  const servings = servingsFor(amount, unit, measures);
  const validAmount = Number.isFinite(servings) && servings > 0;
  const canLog = validAmount && !saving;
  const totals = validAmount ? calculateLogTotals(food, servings) : null;

  const unitOptions: { label: string; value: QuantityUnit; accessibilityLabel?: string }[] = [
    { label: 'Servings', value: 'servings' },
    ...(pieces ? [{ label: capitalize(pieces.plural), value: 'pieces' as const }] : []),
    { label: 'g', value: 'g', accessibilityLabel: 'Grams' },
    { label: 'oz', value: 'oz', accessibilityLabel: 'Ounces' },
    ...(servingMl !== null
      ? [{ label: 'ml', value: 'ml' as const, accessibilityLabel: 'Millilitres' }]
      : []),
  ];
  const fieldLabel: Record<QuantityUnit, string> = {
    servings: 'Quantity',
    pieces: capitalize(pieces?.plural ?? 'pieces'),
    g: 'Grams',
    oz: 'Ounces',
    ml: 'Millilitres',
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
      case 'ml':
        return `${amount} ml · ${servingsText(servings)}`;
      default:
        return withGrams(servingsText(servings));
    }
  }

  function changeUnit(next: QuantityUnit) {
    // The amount carries over: 1 serving of a 100 g food becomes 100 g.
    setQuantity(validAmount ? amountFor(servings, next, measures) : '');
    setUnit(next);
  }

  function handleLog() {
    if (!canLog) return;
    if (onChoose) {
      onChoose({ quantity: servings, entered: { amount, unit } });
      return;
    }
    // A second tap seconds after the first is almost always a mistake: ask first.
    if (!day && loggedJustNow(logs, food.id, Date.now(), food.name)) {
      Alert.alert('Log it again?', `You logged ${food.name} a few seconds ago.`, [
        { text: 'Cancel', style: 'cancel' },
        { text: 'Log Again', onPress: () => void log() },
      ]);
      return;
    }
    void log();
  }

  async function log() {
    setError(null);
    setSaving(true);
    try {
      // Through the shared cache's own write path -- NutritionTodayScreen and
      // ProfileScreen, wherever they're mounted, see this the instant it
      // resolves, with no re-fetch of their own.
      // Kept as typed too, so Today shows "2 cookies" rather than 0.67 servings.
      await logFoodEntry(food, servings, defaultMealTypeForTime(), { amount, unit }, day);
      onDone?.();
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
          <FoodImage
            testID="log-food-step-image"
            uri={food.imageUrl}
            name={food.name}
            size={72}
            zoomable
          />
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

        {/* By weight, for a serving with no weight of its own: what one serving weighs. */}
        {(unit === 'g' || unit === 'oz') && knownGrams === null ? (
          <View style={styles.servingWeight}>
            <TextInput
              testID="log-food-serving-weight"
              label={`One serving (${food.servingSize} ${food.servingUnit}) weighs, in grams`}
              value={servingWeight}
              onChangeText={setServingWeight}
              keyboardType="decimal-pad"
            />
            <Text testID="log-food-serving-weight-note" style={styles.serving}>
              {servingMl !== null
                ? 'Most drinks weigh about the same in grams as in millilitres.'
                : 'From its label, or weigh one.'}
            </Text>
          </View>
        ) : null}

        <Text testID="log-food-serving" style={styles.serving}>
          {food.recipeServings
            ? `Recipe · makes ${food.recipeServings} ${food.recipeServings === 1 ? 'serving' : 'servings'}`
            : `1 serving: ${food.servingLabel?.trim() || `${food.servingSize} ${food.servingUnit}`}`}
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
        label={onChoose ? chooseLabel : 'Log Food'}
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
  servingWeight: {
    marginTop: spacing.md,
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
