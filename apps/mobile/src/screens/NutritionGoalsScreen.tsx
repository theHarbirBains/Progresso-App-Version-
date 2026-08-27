import { useEffect, useState } from 'react';
import {
  ActivityIndicator,
  ScrollView,
  Text,
  TextInput,
  TouchableOpacity,
  View,
} from 'react-native';
import { useAuth } from '../auth/AuthProvider';
import type { RootStackScreenProps } from '../navigation/types';
import {
  fetchNutritionGoals,
  saveNutritionGoals,
  type NutritionGoals,
} from '../nutrition/nutritionGoalQueries';
import { workoutStyles as styles } from './workoutStyles';

type Props = RootStackScreenProps<'NutritionGoals'>;

function toInput(value: number | null): string {
  return value === null ? '' : String(value);
}

/** Blank or unparseable clears the target; the DB's own check(> 0) constraints reject the rest. */
function parseGoalInput(text: string): number | null {
  const trimmed = text.trim();
  if (trimmed === '') return null;
  const num = Number(trimmed);
  return Number.isFinite(num) && num > 0 ? num : null;
}

export function NutritionGoalsScreen({ navigation }: Props) {
  const { user } = useAuth();
  const userId = user?.id ?? '';

  const [caloriesInput, setCaloriesInput] = useState('');
  const [proteinInput, setProteinInput] = useState('');
  const [carbsInput, setCarbsInput] = useState('');
  const [fatInput, setFatInput] = useState('');
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [saved, setSaved] = useState(false);

  useEffect(() => {
    let cancelled = false;
    async function load() {
      if (!userId) return;
      setLoading(true);
      setError(null);
      try {
        const goals = await fetchNutritionGoals(userId);
        if (cancelled) return;
        setCaloriesInput(toInput(goals.calories));
        setProteinInput(toInput(goals.proteinG));
        setCarbsInput(toInput(goals.carbsG));
        setFatInput(toInput(goals.fatG));
      } catch (err) {
        if (!cancelled) setError(err instanceof Error ? err.message : 'Failed to load goals');
      } finally {
        if (!cancelled) setLoading(false);
      }
    }
    load();
    return () => {
      cancelled = true;
    };
  }, [userId]);

  async function handleSave() {
    if (!userId) return;
    setError(null);
    setSaved(false);
    setSaving(true);
    try {
      const goals: NutritionGoals = {
        calories: parseGoalInput(caloriesInput),
        proteinG: parseGoalInput(proteinInput),
        carbsG: parseGoalInput(carbsInput),
        fatG: parseGoalInput(fatInput),
      };
      const result = await saveNutritionGoals(userId, goals);
      setCaloriesInput(toInput(result.calories));
      setProteinInput(toInput(result.proteinG));
      setCarbsInput(toInput(result.carbsG));
      setFatInput(toInput(result.fatG));
      setSaved(true);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to save goals');
    } finally {
      setSaving(false);
    }
  }

  if (loading) {
    return (
      <View style={styles.container}>
        <ActivityIndicator testID="nutrition-goals-loading" size="large" color="#FFFFFF" />
      </View>
    );
  }

  return (
    <ScrollView contentContainerStyle={styles.container}>
      <View style={styles.header}>
        <Text style={styles.title}>Nutrition Goals</Text>
        <TouchableOpacity testID="nutrition-goals-back" onPress={() => navigation.goBack()}>
          <Text style={styles.backLink}>Back</Text>
        </TouchableOpacity>
      </View>

      <Text style={styles.label}>Daily calories</Text>
      <TextInput
        testID="goal-calories"
        style={styles.input}
        placeholder="Optional"
        placeholderTextColor="#6B6B75"
        keyboardType="number-pad"
        value={caloriesInput}
        onChangeText={setCaloriesInput}
      />

      <Text style={styles.label}>Daily protein (g)</Text>
      <TextInput
        testID="goal-protein"
        style={styles.input}
        placeholder="Optional"
        placeholderTextColor="#6B6B75"
        keyboardType="decimal-pad"
        value={proteinInput}
        onChangeText={setProteinInput}
      />

      <Text style={styles.label}>Daily carbs (g)</Text>
      <TextInput
        testID="goal-carbs"
        style={styles.input}
        placeholder="Optional"
        placeholderTextColor="#6B6B75"
        keyboardType="decimal-pad"
        value={carbsInput}
        onChangeText={setCarbsInput}
      />

      <Text style={styles.label}>Daily fat (g)</Text>
      <TextInput
        testID="goal-fat"
        style={styles.input}
        placeholder="Optional"
        placeholderTextColor="#6B6B75"
        keyboardType="decimal-pad"
        value={fatInput}
        onChangeText={setFatInput}
      />

      {error ? (
        <Text testID="nutrition-goals-error" style={styles.error}>
          {error}
        </Text>
      ) : null}
      {saved ? (
        <Text testID="nutrition-goals-saved" style={styles.info}>
          Saved
        </Text>
      ) : null}

      <TouchableOpacity
        testID="nutrition-goals-save"
        style={styles.button}
        onPress={handleSave}
        disabled={saving}
      >
        {saving ? (
          <ActivityIndicator color="#0B0B0F" />
        ) : (
          <Text style={styles.buttonText}>Save</Text>
        )}
      </TouchableOpacity>
    </ScrollView>
  );
}
