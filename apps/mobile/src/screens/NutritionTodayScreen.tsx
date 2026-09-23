import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { ActivityIndicator, StyleSheet, TextInput, View } from 'react-native';
import { Text } from '../design/Text';
import { useAuth } from '../auth/AuthProvider';
import { AppCard } from '../design/AppCard';
import { AppHeader } from '../design/AppHeader';
import { PrimaryButton, SecondaryButton, TextButton } from '../design/Button';
import { Screen } from '../design/Screen';
import { Section } from '../design/Section';
import { colors, minTouchTarget, radii, spacing, typeScale, widgetGap } from '../design/theme';
import { useAppMenu } from '../navigation/AppMenuContext';
import type { RootStackScreenProps } from '../navigation/types';
import { useProgressTheme } from '../progress/useProgressTheme';
import { FoodImage } from '../nutrition/FoodImage';
import {
  deleteFoodLog,
  fetchTodaysFoodLogs,
  updateFoodLogQuantity,
  type FoodLogRow,
} from '../nutrition/foodLogQueries';
import { calculateRemaining, sumDailyTotals } from '../nutrition/nutritionCalculations';
import { useNutritionGoals } from '../nutrition/NutritionGoalsProvider';
import { type NutritionGoals } from '../nutrition/nutritionGoalQueries';

type Props = RootStackScreenProps<'Nutrition'>;

const EMPTY_GOALS: NutritionGoals = { calories: null, proteinG: null, carbsG: null, fatG: null };

// The Nutrition tab's own root screen (see App.tsx's bottom nav) -- today's
// intake against the user's targets, with the day's logged foods.
//
// Layout: the shared Screen with a hamburger menu, then three widgets `widgetGap` apart:
// the four macros (what was consumed, against the target when one is set, and
// what remains); the one filled action -- Log Food -- with Nutrition Goals as
// the outlined secondary; and Today's Foods as rows (the food's picture, its
// name, the values snapshotted when it was logged, an editable quantity and a
// quiet Delete).
export function NutritionTodayScreen({ navigation }: Props) {
  const { user } = useAuth();
  const userId = user?.id ?? '';
  const { nutritionTheme } = useProgressTheme();
  const { openMenu } = useAppMenu();
  // Goals rarely change and are shared with ProfileScreen/NutritionGoalsScreen
  // via the same cache -- only today's logs, which genuinely change within a
  // session (logging/editing/deleting), still refetch on every focus here.
  const { goals: cachedGoals, loading: goalsLoading, error: goalsError } = useNutritionGoals();
  const goals = cachedGoals ?? EMPTY_GOALS;

  const [logs, setLogs] = useState<FoodLogRow[]>([]);
  const [quantityInputs, setQuantityInputs] = useState<Record<string, string>>({});
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  // Only the very first load should replace the whole screen with a
  // spinner -- every later call (the focus listener below) is a background
  // refresh, same pattern as DashboardScreen/ProfileScreen.
  const hasLoadedOnce = useRef(false);

  const load = useCallback(async () => {
    if (!userId) return;
    if (!hasLoadedOnce.current) setLoading(true);
    setError(null);
    try {
      const todaysLogs = await fetchTodaysFoodLogs(userId);
      setLogs(todaysLogs);
      setQuantityInputs(
        Object.fromEntries(todaysLogs.map((log) => [log.id, String(log.quantity)])),
      );
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to load nutrition');
    } finally {
      setLoading(false);
      hasLoadedOnce.current = true;
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
  const displayError = error ?? goalsError;

  async function handleUpdateQuantity(log: FoodLogRow) {
    const raw = quantityInputs[log.id];
    const newQuantity = Number(raw);
    if (!Number.isFinite(newQuantity) || newQuantity <= 0 || newQuantity === log.quantity) return;
    setError(null);
    try {
      const updated = await updateFoodLogQuantity(log, newQuantity);
      // The update returns the log without its picture; keep the one already shown.
      setLogs((prev) =>
        prev.map((l) => (l.id === log.id ? { ...updated, imageUrl: l.imageUrl } : l)),
      );
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

  const header = (
    <AppHeader
      testID="nutrition-today-header"
      title="Nutrition Today"
      leftAction={{
        icon: 'menu',
        onPress: () => openMenu(),
        accessibilityLabel: 'Open menu',
        testID: 'nutrition-today-open-menu',
      }}
    />
  );

  if (loading || goalsLoading) {
    return (
      <Screen scroll={false} header={header}>
        <View style={styles.loading}>
          <ActivityIndicator
            testID="nutrition-today-loading"
            size="large"
            color={colors.textPrimary}
          />
        </View>
      </Screen>
    );
  }

  const macros = [
    {
      key: 'calories',
      label: 'Calories',
      unit: '',
      consumed: consumed.calories,
      goal: goals.calories,
      remaining: remaining.calories,
    },
    {
      key: 'protein',
      label: 'Protein',
      unit: 'g',
      consumed: consumed.proteinG,
      goal: goals.proteinG,
      remaining: remaining.proteinG,
    },
    {
      key: 'carbs',
      label: 'Carbs',
      unit: 'g',
      consumed: consumed.carbsG,
      goal: goals.carbsG,
      remaining: remaining.carbsG,
    },
    {
      key: 'fat',
      label: 'Fat',
      unit: 'g',
      consumed: consumed.fatG,
      goal: goals.fatG,
      remaining: remaining.fatG,
    },
  ];

  return (
    <Screen contentContainerStyle={styles.content} header={header}>
      {displayError ? (
        <Text testID="nutrition-today-error" style={styles.errorText}>
          {displayError}
        </Text>
      ) : null}

      <AppCard hero topAccent={nutritionTheme.accent} testID="nutrition-today-macros">
        {macros.map((macro, index) => (
          <View key={macro.key} style={[styles.macro, index > 0 && styles.macroDivider]}>
            <Text testID={`${macro.key}-consumed`} style={styles.macroLine}>
              {macro.label}: {macro.consumed}
              {macro.unit}
              {macro.goal !== null ? ` / ${macro.goal}${macro.unit}` : ''}
            </Text>
            {macro.remaining !== null ? (
              <Text testID={`${macro.key}-remaining`} style={styles.macroRemaining}>
                {macro.remaining}
                {macro.unit} remaining
              </Text>
            ) : null}
          </View>
        ))}
      </AppCard>

      <AppCard testID="nutrition-today-actions" style={styles.actions}>
        <PrimaryButton
          testID="log-food-button"
          label="Log Food"
          onPress={() => navigation.navigate('FoodLibrary')}
          accentColor={nutritionTheme.accent}
          onAccentColor={nutritionTheme.onAccent}
        />
        <SecondaryButton
          testID="nutrition-goals-link"
          label="Nutrition Goals"
          onPress={() => navigation.navigate('NutritionGoals')}
        />
      </AppCard>

      <AppCard testID="nutrition-today-foods">
        <Section title="Today's Foods">
          {logs.length === 0 ? (
            <Text testID="food-log-empty" style={styles.emptyText}>
              No foods logged today
            </Text>
          ) : (
            logs.map((log, index) => (
              <View
                key={log.id}
                testID={`food-log-row-${log.id}`}
                style={[styles.logRow, index > 0 && styles.macroDivider]}
              >
                <FoodImage uri={log.imageUrl} name={log.foodNameSnapshot} size={44} />
                <View style={styles.logInfo}>
                  <Text style={styles.logName}>{log.foodNameSnapshot}</Text>
                  <Text style={styles.logMeta}>
                    {log.calories} cal · {log.proteinG}g protein · {log.carbsG}g carbs · {log.fatG}g
                    fat
                  </Text>
                </View>
                <TextInput
                  testID={`food-log-quantity-${log.id}`}
                  style={styles.quantityInput}
                  accessibilityLabel={`Quantity of ${log.foodNameSnapshot}`}
                  keyboardType="decimal-pad"
                  value={quantityInputs[log.id] ?? ''}
                  onChangeText={(text) =>
                    setQuantityInputs((prev) => ({ ...prev, [log.id]: text }))
                  }
                  onEndEditing={() => handleUpdateQuantity(log)}
                />
                <TextButton
                  testID={`food-log-delete-${log.id}`}
                  label="Delete"
                  accessibilityLabel={`Delete ${log.foodNameSnapshot}`}
                  destructive
                  onPress={() => handleDelete(log.id)}
                />
              </View>
            ))
          )}
        </Section>
      </AppCard>
    </Screen>
  );
}

const styles = StyleSheet.create({
  content: {
    gap: widgetGap,
    paddingBottom: spacing.xxl,
  },
  loading: {
    paddingVertical: spacing.xxl,
  },
  errorText: {
    ...typeScale.callout,
    color: colors.destructive,
  },

  macro: {
    paddingVertical: spacing.md,
  },
  macroDivider: {
    borderTopWidth: StyleSheet.hairlineWidth,
    borderTopColor: colors.divider,
  },
  macroLine: {
    ...typeScale.cardTitle,
    color: colors.textPrimary,
  },
  macroRemaining: {
    ...typeScale.secondary,
    color: colors.textSecondary,
    marginTop: 2,
  },

  actions: {
    gap: spacing.sm,
  },

  emptyText: {
    ...typeScale.callout,
    color: colors.textMuted,
  },
  logRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
    paddingVertical: spacing.md,
  },
  logInfo: {
    flex: 1,
  },
  logName: {
    ...typeScale.cardTitle,
    color: colors.textPrimary,
  },
  logMeta: {
    ...typeScale.secondary,
    color: colors.textSecondary,
    marginTop: 2,
  },
  quantityInput: {
    width: 64,
    height: minTouchTarget,
    borderRadius: radii.md,
    borderWidth: 1,
    borderColor: colors.border,
    backgroundColor: colors.surfaceRaised,
    color: colors.textPrimary,
    ...typeScale.statSmall,
    textAlign: 'center',
  },
});
