import { useState } from 'react';
import { StyleSheet, View } from 'react-native';
import { Text } from '../design/Text';
import { AppCard } from '../design/AppCard';
import { AppHeader } from '../design/AppHeader';
import { PrimaryButton } from '../design/Button';
import { Screen } from '../design/Screen';
import { TextInput } from '../design/TextInput';
import { colors, spacing, typeScale, widgetGap } from '../design/theme';
import { FoodImage } from './FoodImage';
import { useFoodLog } from './FoodLogProvider';
import { defaultMealTypeForTime } from './mealTypes';
import { calculateLogTotals } from './nutritionCalculations';
import type { FoodRow } from './foodQueries';

export type LoggableFood = Pick<
  FoodRow,
  'id' | 'name' | 'servingSize' | 'servingUnit' | 'calories' | 'proteinG' | 'carbsG' | 'fatG'
> & {
  /** The food's photo, when it has one -- shown on the step; never sent to the log. */
  imageUrl?: string | null;
};

interface LogFoodStepProps {
  food: LoggableFood;
  accentColor: string;
  onAccentColor: string;
  onDone: () => void;
  onCancel: () => void;
}

/**
 * The one quantity-entry-and-log step for every "found a food, now log it"
 * flow in the app -- Food Library's own foods, a Search Food result, and a
 * scanned barcode's matched product all end here (see DESIGN.md's single
 * normalized food model / one logging pipeline requirement). Not a
 * navigation route itself; each caller renders it inline in place of its
 * own content once a food is selected. Originally inline in
 * FoodLibraryScreen; extracted so FoodSearchScreen and BarcodeScannerScreen
 * can reuse the exact same step rather than a second logging UI.
 *
 * Layout: two widgets `widgetGap` apart -- the food (its picture and serving)
 * and the Quantity field with a live preview of what that quantity adds up
 * to -- then the one filled Log Food button.
 */
export function LogFoodStep({
  food,
  accentColor,
  onAccentColor,
  onDone,
  onCancel,
}: LogFoodStepProps) {
  const { logFoodEntry } = useFoodLog();
  const [quantity, setQuantity] = useState('1');
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const quantityNum = Number(quantity);
  const canLog = Number.isFinite(quantityNum) && quantityNum > 0 && !saving;
  const preview = canLog ? calculateLogTotals(food, quantityNum) : null;

  async function handleLog() {
    if (!canLog) return;
    setError(null);
    setSaving(true);
    try {
      // Through the shared cache's own write path -- NutritionTodayScreen and
      // ProfileScreen, wherever they're mounted, see this the instant it
      // resolves, with no re-fetch of their own.
      await logFoodEntry(food, quantityNum, defaultMealTypeForTime());
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
      header={<AppHeader title={food.name} onBack={onCancel} testID="log-food-header" />}
    >
      <AppCard hero testID="log-food-summary">
        <View style={styles.foodRow}>
          <FoodImage uri={food.imageUrl} name={food.name} size={64} />
          <Text style={styles.serving}>
            Serving: {food.servingSize}
            {food.servingUnit}
          </Text>
        </View>
      </AppCard>

      <AppCard testID="log-food-quantity-card">
        <TextInput
          testID="log-food-quantity"
          label="Quantity"
          value={quantity}
          onChangeText={setQuantity}
          keyboardType="decimal-pad"
        />

        {preview ? (
          <Text testID="log-food-preview" style={styles.preview}>
            {preview.calories} cal · {preview.proteinG}g protein · {preview.carbsG}g carbs ·{' '}
            {preview.fatG}g fat
          </Text>
        ) : null}
      </AppCard>

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
  serving: {
    ...typeScale.body,
    color: colors.textSecondary,
    flex: 1,
  },
  preview: {
    ...typeScale.callout,
    color: colors.textPrimary,
    marginTop: spacing.md,
  },
  error: {
    ...typeScale.callout,
    color: colors.destructive,
  },
});
