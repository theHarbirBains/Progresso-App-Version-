import { useState } from 'react';
import { ActivityIndicator, Text, TextInput, TouchableOpacity, View } from 'react-native';
import { useAuth } from '../auth/AuthProvider';
import { createFood, updateFood, type FoodRow } from '../nutrition/foodQueries';
import { exerciseStyles as styles } from './exerciseStyles';

type Props =
  | { mode: 'create'; onDone: () => void; onCancel: () => void }
  | { mode: 'edit'; food: FoodRow; onDone: () => void; onCancel: () => void };

// Only reachable from FoodLibraryScreen for the user's own custom foods --
// there are no built-in foods in Phase 6. Direct Supabase writes (foods has
// no unique-name constraint to justify routing this through the backend,
// unlike exercises' ExerciseFormScreen).
export function FoodFormScreen(props: Props) {
  const { user } = useAuth();
  const userId = user?.id ?? '';

  const [name, setName] = useState(props.mode === 'edit' ? props.food.name : '');
  const [servingSize, setServingSize] = useState(
    props.mode === 'edit' ? String(props.food.servingSize) : '',
  );
  const [servingUnit, setServingUnit] = useState(
    props.mode === 'edit' ? props.food.servingUnit : '',
  );
  const [calories, setCalories] = useState(
    props.mode === 'edit' ? String(props.food.calories) : '',
  );
  const [proteinG, setProteinG] = useState(
    props.mode === 'edit' ? String(props.food.proteinG) : '',
  );
  const [carbsG, setCarbsG] = useState(props.mode === 'edit' ? String(props.food.carbsG) : '');
  const [fatG, setFatG] = useState(props.mode === 'edit' ? String(props.food.fatG) : '');
  const [isActive, setIsActive] = useState(props.mode === 'edit' ? props.food.isActive : true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const servingSizeNum = Number(servingSize);
  const caloriesNum = Number(calories);
  const proteinNum = Number(proteinG);
  const carbsNum = Number(carbsG);
  const fatNum = Number(fatG);

  const canSave =
    name.trim().length > 0 &&
    servingUnit.trim().length > 0 &&
    Number.isFinite(servingSizeNum) &&
    servingSizeNum > 0 &&
    Number.isFinite(caloriesNum) &&
    caloriesNum >= 0 &&
    Number.isFinite(proteinNum) &&
    proteinNum >= 0 &&
    Number.isFinite(carbsNum) &&
    carbsNum >= 0 &&
    Number.isFinite(fatNum) &&
    fatNum >= 0 &&
    !saving;

  async function handleSave() {
    if (!canSave) return;
    setError(null);
    setSaving(true);
    try {
      const input = {
        name: name.trim(),
        servingSize: servingSizeNum,
        servingUnit: servingUnit.trim(),
        calories: caloriesNum,
        proteinG: proteinNum,
        carbsG: carbsNum,
        fatG: fatNum,
      };
      if (props.mode === 'create') {
        await createFood(userId, input);
      } else {
        await updateFood(props.food.id, input);
      }
      props.onDone();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to save food');
    } finally {
      setSaving(false);
    }
  }

  async function handleToggleActive() {
    if (props.mode !== 'edit') return;
    setError(null);
    setSaving(true);
    try {
      await updateFood(props.food.id, { isActive: !isActive });
      setIsActive((prev) => !prev);
      props.onDone();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to update food');
    } finally {
      setSaving(false);
    }
  }

  return (
    <View style={styles.container}>
      <View style={styles.header}>
        <Text style={styles.title}>{props.mode === 'create' ? 'New Food' : 'Edit Food'}</Text>
        <TouchableOpacity testID="food-form-cancel" onPress={props.onCancel}>
          <Text style={styles.backLink}>Cancel</Text>
        </TouchableOpacity>
      </View>

      <Text style={styles.label}>Name</Text>
      <TextInput
        testID="food-form-name"
        style={styles.input}
        placeholder="Food name"
        placeholderTextColor="#6B6B75"
        value={name}
        onChangeText={setName}
      />

      <Text style={styles.label}>Serving size</Text>
      <TextInput
        testID="food-form-serving-size"
        style={styles.input}
        placeholder="100"
        placeholderTextColor="#6B6B75"
        keyboardType="decimal-pad"
        value={servingSize}
        onChangeText={setServingSize}
      />

      <Text style={styles.label}>Serving unit</Text>
      <TextInput
        testID="food-form-serving-unit"
        style={styles.input}
        placeholder="g"
        placeholderTextColor="#6B6B75"
        value={servingUnit}
        onChangeText={setServingUnit}
      />

      <Text style={styles.label}>Calories</Text>
      <TextInput
        testID="food-form-calories"
        style={styles.input}
        placeholder="0"
        placeholderTextColor="#6B6B75"
        keyboardType="decimal-pad"
        value={calories}
        onChangeText={setCalories}
      />

      <Text style={styles.label}>Protein (g)</Text>
      <TextInput
        testID="food-form-protein"
        style={styles.input}
        placeholder="0"
        placeholderTextColor="#6B6B75"
        keyboardType="decimal-pad"
        value={proteinG}
        onChangeText={setProteinG}
      />

      <Text style={styles.label}>Carbs (g)</Text>
      <TextInput
        testID="food-form-carbs"
        style={styles.input}
        placeholder="0"
        placeholderTextColor="#6B6B75"
        keyboardType="decimal-pad"
        value={carbsG}
        onChangeText={setCarbsG}
      />

      <Text style={styles.label}>Fat (g)</Text>
      <TextInput
        testID="food-form-fat"
        style={styles.input}
        placeholder="0"
        placeholderTextColor="#6B6B75"
        keyboardType="decimal-pad"
        value={fatG}
        onChangeText={setFatG}
      />

      {error ? (
        <Text testID="food-form-error" style={styles.error}>
          {error}
        </Text>
      ) : null}

      <TouchableOpacity
        testID="food-form-save"
        style={[styles.button, !canSave && styles.buttonDisabled]}
        onPress={handleSave}
        disabled={!canSave}
      >
        {saving ? (
          <ActivityIndicator color="#0B0B0F" />
        ) : (
          <Text style={styles.buttonText}>Save</Text>
        )}
      </TouchableOpacity>

      {props.mode === 'edit' ? (
        <TouchableOpacity
          testID="food-form-toggle-active"
          style={isActive ? styles.deactivateButton : styles.reactivateButton}
          onPress={handleToggleActive}
          disabled={saving}
        >
          <Text style={isActive ? styles.deactivateButtonText : styles.reactivateButtonText}>
            {isActive ? 'Deactivate' : 'Reactivate'}
          </Text>
        </TouchableOpacity>
      ) : null}
    </View>
  );
}
