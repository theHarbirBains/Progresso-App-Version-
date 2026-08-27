import { useCallback, useEffect, useMemo, useState } from 'react';
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
  deleteFoodLog,
  fetchTodaysFoodLogs,
  updateFoodLogQuantity,
  type FoodLogRow,
} from '../nutrition/foodLogQueries';
import { calculateRemaining, sumDailyTotals } from '../nutrition/nutritionCalculations';
import { fetchNutritionGoals, type NutritionGoals } from '../nutrition/nutritionGoalQueries';
import { workoutStyles as styles } from './workoutStyles';

type Props = RootStackScreenProps<'Nutrition'>;

const EMPTY_GOALS: NutritionGoals = { calories: null, proteinG: null, carbsG: null, fatG: null };

export function NutritionTodayScreen({ navigation }: Props) {
  const { user } = useAuth();
  const userId = user?.id ?? '';

  const [logs, setLogs] = useState<FoodLogRow[]>([]);
  const [goals, setGoals] = useState<NutritionGoals>(EMPTY_GOALS);
  const [quantityInputs, setQuantityInputs] = useState<Record<string, string>>({});
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(async () => {
    if (!userId) return;
    setLoading(true);
    setError(null);
    try {
      const [todaysLogs, nutritionGoals] = await Promise.all([
        fetchTodaysFoodLogs(userId),
        fetchNutritionGoals(userId),
      ]);
      setLogs(todaysLogs);
      setGoals(nutritionGoals);
      setQuantityInputs(
        Object.fromEntries(todaysLogs.map((log) => [log.id, String(log.quantity)])),
      );
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to load nutrition');
    } finally {
      setLoading(false);
    }
  }, [userId]);

  useEffect(() => {
    // Re-load on every focus, not just mount, so logging/editing/deleting a
    // food from FoodLibrary and coming back shows current data.
    const unsubscribe = navigation.addListener('focus', load);
    return unsubscribe;
  }, [navigation, load]);

  const consumed = useMemo(() => sumDailyTotals(logs), [logs]);
  const remaining = useMemo(() => calculateRemaining(consumed, goals), [consumed, goals]);

  async function handleUpdateQuantity(log: FoodLogRow) {
    const raw = quantityInputs[log.id];
    const newQuantity = Number(raw);
    if (!Number.isFinite(newQuantity) || newQuantity <= 0 || newQuantity === log.quantity) return;
    setError(null);
    try {
      const updated = await updateFoodLogQuantity(log, newQuantity);
      setLogs((prev) => prev.map((l) => (l.id === log.id ? updated : l)));
      setQuantityInputs((prev) => ({ ...prev, [log.id]: String(updated.quantity) }));
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to update quantity');
    }
  }

  async function handleDelete(logId: string) {
    setError(null);
    try {
      await deleteFoodLog(logId);
      setLogs((prev) => prev.filter((l) => l.id !== logId));
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to delete food log');
    }
  }

  if (loading) {
    return (
      <View style={styles.container}>
        <ActivityIndicator testID="nutrition-today-loading" size="large" color="#FFFFFF" />
      </View>
    );
  }

  return (
    <ScrollView contentContainerStyle={styles.container}>
      <View style={styles.header}>
        <Text style={styles.title}>Nutrition Today</Text>
        <TouchableOpacity testID="nutrition-today-back" onPress={() => navigation.goBack()}>
          <Text style={styles.backLink}>Back</Text>
        </TouchableOpacity>
      </View>

      {error ? (
        <Text testID="nutrition-today-error" style={styles.error}>
          {error}
        </Text>
      ) : null}

      <View style={styles.banner}>
        <Text testID="calories-consumed" style={styles.cardMetaHighlight}>
          Calories: {consumed.calories}
          {goals.calories !== null ? ` / ${goals.calories}` : ''}
        </Text>
        {remaining.calories !== null ? (
          <Text testID="calories-remaining" style={styles.cardMeta}>
            {remaining.calories} remaining
          </Text>
        ) : null}

        <Text testID="protein-consumed" style={styles.cardMetaHighlight}>
          Protein: {consumed.proteinG}g{goals.proteinG !== null ? ` / ${goals.proteinG}g` : ''}
        </Text>
        {remaining.proteinG !== null ? (
          <Text testID="protein-remaining" style={styles.cardMeta}>
            {remaining.proteinG}g remaining
          </Text>
        ) : null}

        <Text testID="carbs-consumed" style={styles.cardMetaHighlight}>
          Carbs: {consumed.carbsG}g{goals.carbsG !== null ? ` / ${goals.carbsG}g` : ''}
        </Text>
        {remaining.carbsG !== null ? (
          <Text testID="carbs-remaining" style={styles.cardMeta}>
            {remaining.carbsG}g remaining
          </Text>
        ) : null}

        <Text testID="fat-consumed" style={styles.cardMetaHighlight}>
          Fat: {consumed.fatG}g{goals.fatG !== null ? ` / ${goals.fatG}g` : ''}
        </Text>
        {remaining.fatG !== null ? (
          <Text testID="fat-remaining" style={styles.cardMeta}>
            {remaining.fatG}g remaining
          </Text>
        ) : null}
      </View>

      <TouchableOpacity
        testID="log-food-button"
        style={styles.button}
        onPress={() => navigation.navigate('FoodLibrary')}
      >
        <Text style={styles.buttonText}>Log Food</Text>
      </TouchableOpacity>

      <TouchableOpacity
        testID="nutrition-goals-link"
        style={styles.secondaryButton}
        onPress={() => navigation.navigate('NutritionGoals')}
      >
        <Text style={styles.secondaryButtonText}>Nutrition Goals</Text>
      </TouchableOpacity>

      <Text style={styles.bannerTitle}>Today&apos;s Foods</Text>
      {logs.length === 0 ? (
        <Text testID="food-log-empty" style={styles.emptyText}>
          No foods logged today
        </Text>
      ) : (
        logs.map((log) => (
          <View key={log.id} testID={`food-log-row-${log.id}`} style={styles.setRow}>
            <View style={styles.foodLogInfo}>
              <Text style={styles.cardTitle}>{log.foodNameSnapshot}</Text>
              <Text style={styles.cardMeta}>
                {log.calories} cal · {log.proteinG}g protein · {log.carbsG}g carbs · {log.fatG}g fat
              </Text>
            </View>
            <TextInput
              testID={`food-log-quantity-${log.id}`}
              style={styles.numberInput}
              keyboardType="decimal-pad"
              value={quantityInputs[log.id] ?? ''}
              onChangeText={(text) => setQuantityInputs((prev) => ({ ...prev, [log.id]: text }))}
              onEndEditing={() => handleUpdateQuantity(log)}
            />
            <TouchableOpacity
              testID={`food-log-delete-${log.id}`}
              onPress={() => handleDelete(log.id)}
            >
              <Text style={styles.setDeleteText}>Delete</Text>
            </TouchableOpacity>
          </View>
        ))
      )}
    </ScrollView>
  );
}
