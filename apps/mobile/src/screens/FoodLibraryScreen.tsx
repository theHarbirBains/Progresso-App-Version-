import { useCallback, useEffect, useState } from 'react';
import { ActivityIndicator, FlatList, Text, TextInput, TouchableOpacity, View } from 'react-native';
import { useAuth } from '../auth/AuthProvider';
import type { RootStackScreenProps } from '../navigation/types';
import { logFood } from '../nutrition/foodLogQueries';
import { calculateLogTotals } from '../nutrition/nutritionCalculations';
import { fetchFoods, type FoodRow } from '../nutrition/foodQueries';
import { exerciseStyles as styles } from './exerciseStyles';
import { FoodFormScreen } from './FoodFormScreen';

const PAGE_SIZE = 20;
const SEARCH_DEBOUNCE_MS = 300;

type Props = RootStackScreenProps<'FoodLibrary'>;

type Mode =
  | { type: 'list' }
  | { type: 'create' }
  | { type: 'edit'; food: FoodRow }
  | { type: 'log'; food: FoodRow };

export function FoodLibraryScreen({ navigation }: Props) {
  const { user } = useAuth();
  const userId = user?.id ?? '';

  const [mode, setMode] = useState<Mode>({ type: 'list' });
  const [searchInput, setSearchInput] = useState('');
  const [search, setSearch] = useState('');
  const [rows, setRows] = useState<FoodRow[]>([]);
  const [page, setPage] = useState(0);
  const [hasMore, setHasMore] = useState(false);
  const [loading, setLoading] = useState(true);
  const [loadingMore, setLoadingMore] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Debounce free-text input before it drives a query, so every keystroke
  // doesn't fire its own request -- same pattern as ExerciseLibraryScreen.
  useEffect(() => {
    const timer = setTimeout(() => setSearch(searchInput), SEARCH_DEBOUNCE_MS);
    return () => clearTimeout(timer);
  }, [searchInput]);

  const loadPage = useCallback(
    async (targetPage: number, replace: boolean) => {
      if (!userId) return;
      if (replace) {
        setLoading(true);
      } else {
        setLoadingMore(true);
      }
      setError(null);
      try {
        const result = await fetchFoods({ userId, search, page: targetPage, pageSize: PAGE_SIZE });
        setRows((prev) => (replace ? result.rows : [...prev, ...result.rows]));
        setHasMore(result.hasMore);
        setPage(targetPage);
      } catch (err) {
        setError(err instanceof Error ? err.message : 'Failed to load foods');
      } finally {
        setLoading(false);
        setLoadingMore(false);
      }
    },
    [userId, search],
  );

  useEffect(() => {
    void loadPage(0, true);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [userId, search]);

  function handleDone() {
    setMode({ type: 'list' });
    void loadPage(0, true);
  }

  if (mode.type === 'create') {
    return (
      <FoodFormScreen
        mode="create"
        onDone={handleDone}
        onCancel={() => setMode({ type: 'list' })}
      />
    );
  }

  if (mode.type === 'edit') {
    return (
      <FoodFormScreen
        mode="edit"
        food={mode.food}
        onDone={handleDone}
        onCancel={() => setMode({ type: 'list' })}
      />
    );
  }

  if (mode.type === 'log') {
    return (
      <LogFoodStep
        food={mode.food}
        userId={userId}
        onDone={() => navigation.goBack()}
        onCancel={() => setMode({ type: 'list' })}
      />
    );
  }

  return (
    <View style={styles.container}>
      <FlatList
        data={rows}
        keyExtractor={(item) => item.id}
        ListHeaderComponent={
          <View>
            <View style={styles.header}>
              <Text style={styles.title}>Food Library</Text>
              <TouchableOpacity testID="food-library-back" onPress={() => navigation.goBack()}>
                <Text style={styles.backLink}>Back</Text>
              </TouchableOpacity>
            </View>

            <TextInput
              testID="food-search"
              style={styles.input}
              placeholder="Search your foods"
              placeholderTextColor="#6B6B75"
              value={searchInput}
              onChangeText={setSearchInput}
            />

            <TouchableOpacity
              testID="food-create-button"
              style={styles.createButton}
              onPress={() => setMode({ type: 'create' })}
            >
              <Text style={styles.createButtonText}>New Food</Text>
            </TouchableOpacity>

            {error ? (
              <Text testID="food-library-error" style={styles.error}>
                {error}
              </Text>
            ) : null}

            {loading ? (
              <ActivityIndicator testID="food-library-loading" size="large" color="#FFFFFF" />
            ) : null}
          </View>
        }
        renderItem={({ item }) => (
          <View style={styles.listItem}>
            <TouchableOpacity
              testID={`food-item-${item.id}`}
              style={styles.foodItemTouchable}
              onPress={() => setMode({ type: 'log', food: item })}
            >
              <Text style={styles.listItemName}>{item.name}</Text>
              <Text style={styles.listItemMeta}>
                {item.servingSize}
                {item.servingUnit} · {item.calories} cal
              </Text>
            </TouchableOpacity>
            <TouchableOpacity
              testID={`food-edit-${item.id}`}
              onPress={() => setMode({ type: 'edit', food: item })}
            >
              <Text style={styles.listItemBadge}>Edit</Text>
            </TouchableOpacity>
          </View>
        )}
        ListEmptyComponent={
          !loading ? (
            <View>
              <Text testID="food-library-empty" style={styles.emptyText}>
                No foods yet
              </Text>
              <TouchableOpacity
                testID="food-empty-create"
                style={styles.createButton}
                onPress={() => setMode({ type: 'create' })}
              >
                <Text style={styles.createButtonText}>Create Food</Text>
              </TouchableOpacity>
            </View>
          ) : null
        }
        ListFooterComponent={
          hasMore ? (
            <TouchableOpacity
              testID="food-load-more"
              style={styles.createButton}
              onPress={() => void loadPage(page + 1, false)}
              disabled={loadingMore}
            >
              {loadingMore ? (
                <ActivityIndicator color="#0B0B0F" />
              ) : (
                <Text style={styles.createButtonText}>Load More</Text>
              )}
            </TouchableOpacity>
          ) : null
        }
      />
    </View>
  );
}

interface LogFoodStepProps {
  food: FoodRow;
  userId: string;
  onDone: () => void;
  onCancel: () => void;
}

// Inline quantity-entry step -- not a navigation route. Reachable only by
// tapping a food in the list above.
function LogFoodStep({ food, userId, onDone, onCancel }: LogFoodStepProps) {
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
      await logFood(userId, food, quantityNum);
      onDone();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to log food');
      setSaving(false);
    }
  }

  return (
    <View style={styles.container}>
      <View style={styles.header}>
        <Text style={styles.title}>{food.name}</Text>
        <TouchableOpacity testID="log-food-cancel" onPress={onCancel}>
          <Text style={styles.backLink}>Cancel</Text>
        </TouchableOpacity>
      </View>

      <Text style={styles.label}>
        Serving: {food.servingSize}
        {food.servingUnit}
      </Text>

      <Text style={styles.label}>Quantity</Text>
      <TextInput
        testID="log-food-quantity"
        style={styles.input}
        keyboardType="decimal-pad"
        value={quantity}
        onChangeText={setQuantity}
      />

      {preview ? (
        <Text testID="log-food-preview" style={styles.label}>
          {preview.calories} cal · {preview.proteinG}g protein · {preview.carbsG}g carbs ·{' '}
          {preview.fatG}g fat
        </Text>
      ) : null}

      {error ? (
        <Text testID="log-food-error" style={styles.error}>
          {error}
        </Text>
      ) : null}

      <TouchableOpacity
        testID="log-food-submit"
        style={[styles.button, !canLog && styles.buttonDisabled]}
        onPress={handleLog}
        disabled={!canLog}
      >
        {saving ? (
          <ActivityIndicator color="#0B0B0F" />
        ) : (
          <Text style={styles.buttonText}>Log Food</Text>
        )}
      </TouchableOpacity>
    </View>
  );
}
