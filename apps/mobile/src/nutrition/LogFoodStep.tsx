import { useState } from 'react';
import { Text, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { AppHeader } from '../design/AppHeader';
import { PrimaryButton } from '../design/Button';
import { TextInput } from '../design/TextInput';
import { logFood } from './foodLogQueries';
import { defaultMealTypeForTime } from './mealTypes';
import { calculateLogTotals } from './nutritionCalculations';
import type { FoodRow } from './foodQueries';
import { foodLibraryStyles as styles } from '../screens/foodLibraryStyles';

export type LoggableFood = Pick<
  FoodRow,
  'id' | 'name' | 'servingSize' | 'servingUnit' | 'calories' | 'proteinG' | 'carbsG' | 'fatG'
>;

interface LogFoodStepProps {
  food: LoggableFood;
  userId: string;
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
 */
export function LogFoodStep({
  food,
  userId,
  accentColor,
  onAccentColor,
  onDone,
  onCancel,
}: LogFoodStepProps) {
  const insets = useSafeAreaInsets();
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
      await logFood(userId, food, quantityNum, defaultMealTypeForTime());
      onDone();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to log food');
      setSaving(false);
    }
  }

  return (
    <View style={[styles.screen, { paddingTop: insets.top }]}>
      <AppHeader title={food.name} onBack={onCancel} testID="log-food-header" safeArea={false} />
      <View style={styles.logFoodContent}>
        <Text style={styles.rowMeta}>
          Serving: {food.servingSize}
          {food.servingUnit}
        </Text>

        <View style={styles.logFoodField}>
          <TextInput
            testID="log-food-quantity"
            label="Quantity"
            value={quantity}
            onChangeText={setQuantity}
            keyboardType="decimal-pad"
          />
        </View>

        {preview ? (
          <Text testID="log-food-preview" style={styles.rowMeta}>
            {preview.calories} cal · {preview.proteinG}g protein · {preview.carbsG}g carbs ·{' '}
            {preview.fatG}g fat
          </Text>
        ) : null}

        {error ? (
          <Text testID="log-food-error" style={styles.logFoodError}>
            {error}
          </Text>
        ) : null}

        <View style={styles.logFoodField}>
          <PrimaryButton
            testID="log-food-submit"
            label={saving ? 'Logging…' : 'Log Food'}
            onPress={handleLog}
            disabled={!canLog}
            accentColor={accentColor}
            onAccentColor={onAccentColor}
          />
        </View>
      </View>
    </View>
  );
}
