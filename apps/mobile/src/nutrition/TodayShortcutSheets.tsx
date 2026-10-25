import { useEffect, useState } from 'react';
import { ScrollView, StyleSheet, View } from 'react-native';
import { Feather } from '@expo/vector-icons';
import { useAuth } from '../auth/AuthProvider';
import { BottomSheet } from '../design/BottomSheet';
import { PrimaryButton } from '../design/Button';
import { ListRow } from '../design/ListRow';
import { Text } from '../design/Text';
import { TextInput } from '../design/TextInput';
import { colors, spacing, typeScale } from '../design/theme';
import { FoodImage } from './FoodImage';
import type { FoodGroupItem } from './foodGroups';
import { useFoodLog } from './FoodLogProvider';
import type { FoodLogRow } from './foodLogQueries';
import { fetchFoodsByIds } from './foodQueries';
import { amountText, servingMeasures } from './logQuantity';
import { createSavedMeal } from './savedMealQueries';
import { wholeFigure } from './wholeFigures';

const MAX_NAME_LENGTH = 80;

/** A log's amount as it was typed, or in servings: "2 cookies", "150 g", "1 serving". */
function logAmount(log: FoodLogRow): string {
  return amountText(
    log.enteredAmount ?? log.quantity,
    log.enteredUnit ?? 'servings',
    servingMeasures(log).pieces,
  );
}

/** Logs to tick: each a row with its picture, name, amount and calories, and a tick. */
function LogChecklist({
  logs,
  selected,
  onToggle,
  accentColor,
  testIDPrefix,
}: {
  logs: FoodLogRow[];
  selected: Set<string>;
  onToggle: (logId: string) => void;
  accentColor: string;
  testIDPrefix: string;
}) {
  return (
    <ScrollView style={styles.list} showsVerticalScrollIndicator={false}>
      {logs.map((log, index) => {
        const ticked = selected.has(log.id);
        return (
          <ListRow
            key={log.id}
            testID={`${testIDPrefix}-${log.id}`}
            leading={<FoodImage uri={log.imageUrl} name={log.foodNameSnapshot} size={44} />}
            title={log.foodNameSnapshot}
            subtitle={`${logAmount(log)} · ${wholeFigure(log.calories)} cal`}
            trailing={
              <Feather
                name={ticked ? 'check-circle' : 'circle'}
                size={22}
                color={ticked ? accentColor : colors.textMuted}
              />
            }
            accessibilityLabel={`${log.foodNameSnapshot}, ${logAmount(log)}, ${ticked ? 'selected' : 'not selected'}`}
            divider={index > 0}
            onPress={() => onToggle(log.id)}
          />
        );
      })}
    </ScrollView>
  );
}

// What's unticked is kept, not what's ticked, so every food starts ticked -- each time the
// sheet opens, and one logged while it's open too.
function useTicks(logs: FoodLogRow[], visible: boolean) {
  const [unticked, setUnticked] = useState<Set<string>>(new Set());
  useEffect(() => {
    if (visible) setUnticked(new Set());
  }, [visible]);
  const selected = new Set(logs.filter((log) => !unticked.has(log.id)).map((log) => log.id));
  const toggle = (logId: string) =>
    setUnticked((prev) => {
      const next = new Set(prev);
      if (next.has(logId)) next.delete(logId);
      else next.add(logId);
      return next;
    });
  return { selected, toggle };
}

interface SheetProps {
  visible: boolean;
  onClose: () => void;
  logs: FoodLogRow[];
  accentColor: string;
  onAccentColor: string;
}

/**
 * Copy Yesterday: yesterday's foods, all ticked; untick any not eaten again. Each one ticked
 * is logged now, exactly as it was logged yesterday -- the same figures, the same amount.
 */
export function CopyYesterdaySheet({
  visible,
  onClose,
  logs,
  accentColor,
  onAccentColor,
}: SheetProps) {
  const { copyLogs } = useFoodLog();
  const { selected, toggle } = useTicks(logs, visible);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (visible) setError(null);
  }, [visible]);

  const count = selected.size;

  async function handleCopy() {
    if (count === 0) return;
    setError(null);
    setSaving(true);
    try {
      // In yesterday's order.
      await copyLogs(logs.filter((log) => selected.has(log.id)).map((log) => log.id));
      onClose();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to copy foods');
    } finally {
      setSaving(false);
    }
  }

  return (
    <BottomSheet visible={visible} onClose={onClose} testID="copy-yesterday-sheet">
      <View style={styles.content}>
        <Text style={styles.title}>Copy Yesterday</Text>
        <Text style={styles.summary}>Untick anything you didn&apos;t have again.</Text>
        <LogChecklist
          logs={logs}
          selected={selected}
          onToggle={toggle}
          accentColor={accentColor}
          testIDPrefix="copy-yesterday-item"
        />
        {error ? (
          <Text testID="copy-yesterday-error" style={styles.error}>
            {error}
          </Text>
        ) : null}
        <PrimaryButton
          testID="copy-yesterday-submit"
          label={count === 1 ? 'Log 1 Food' : `Log ${count} Foods`}
          onPress={() => void handleCopy()}
          loading={saving}
          disabled={count === 0 && !saving}
          accentColor={accentColor}
          onAccentColor={onAccentColor}
        />
      </View>
    </BottomSheet>
  );
}

/**
 * Save as Meal: today's foods, all ticked, and a name. The ones ticked become a saved meal in
 * the Food Library, each at the amount logged today.
 */
export function SaveAsMealSheet({
  visible,
  onClose,
  logs,
  accentColor,
  onAccentColor,
}: SheetProps) {
  const { user } = useAuth();
  const userId = user?.id ?? '';
  // A log whose food is gone can't be logged again, so it can't be part of a meal.
  const usable = logs.filter((log) => log.foodId !== null);
  const { selected, toggle } = useTicks(usable, visible);
  const [name, setName] = useState('');
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [saved, setSaved] = useState<string | null>(null);

  useEffect(() => {
    if (!visible) return;
    setName('');
    setError(null);
    setSaved(null);
  }, [visible]);

  const trimmed = name.trim();
  const nameError =
    trimmed.length > MAX_NAME_LENGTH ? `Keep it to ${MAX_NAME_LENGTH} characters` : undefined;
  const canSave = trimmed.length > 0 && !nameError && selected.size > 0 && !saving;

  async function handleSave() {
    if (!canSave) return;
    setError(null);
    setSaving(true);
    try {
      const chosen = usable.filter((log) => selected.has(log.id));
      const foods = new Map(
        (await fetchFoodsByIds([...new Set(chosen.map((log) => log.foodId!))])).map((food) => [
          food.id,
          food,
        ]),
      );
      const items: FoodGroupItem[] = chosen.flatMap((log) => {
        const food = foods.get(log.foodId!);
        if (!food || !food.isActive) return [];
        return [
          {
            food,
            quantity: log.quantity,
            entered:
              log.enteredAmount && log.enteredUnit
                ? { amount: log.enteredAmount, unit: log.enteredUnit }
                : null,
          },
        ];
      });
      if (items.length === 0) {
        setError('None of these foods are in your Food Library any more.');
        return;
      }
      await createSavedMeal(userId, trimmed, items);
      setSaved(trimmed);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to save meal');
    } finally {
      setSaving(false);
    }
  }

  return (
    <BottomSheet visible={visible} onClose={onClose} testID="save-meal-sheet">
      {saved ? (
        <View style={styles.content}>
          <Text testID="save-meal-done" style={styles.title}>
            {saved} saved
          </Text>
          <Text style={styles.summary}>
            It&apos;s in your Food Library under Saved Meals, to log in one go.
          </Text>
          <PrimaryButton
            testID="save-meal-close"
            label="Done"
            onPress={onClose}
            accentColor={accentColor}
            onAccentColor={onAccentColor}
          />
        </View>
      ) : (
        <View style={styles.content}>
          <Text style={styles.title}>Save as Meal</Text>
          <TextInput
            testID="save-meal-name"
            label="Name"
            placeholder="e.g. Usual Breakfast"
            value={name}
            onChangeText={setName}
            error={nameError}
          />
          <LogChecklist
            logs={usable}
            selected={selected}
            onToggle={toggle}
            accentColor={accentColor}
            testIDPrefix="save-meal-item"
          />
          {error ? (
            <Text testID="save-meal-error" style={styles.error}>
              {error}
            </Text>
          ) : null}
          <PrimaryButton
            testID="save-meal-submit"
            label="Save Meal"
            onPress={() => void handleSave()}
            loading={saving}
            disabled={!canSave && !saving}
            accentColor={accentColor}
            onAccentColor={onAccentColor}
          />
        </View>
      )}
    </BottomSheet>
  );
}

const styles = StyleSheet.create({
  content: {
    gap: spacing.sm,
    padding: spacing.lg,
  },
  title: {
    ...typeScale.cardTitle,
    color: colors.textPrimary,
  },
  summary: {
    ...typeScale.secondary,
    color: colors.textSecondary,
  },
  list: {
    maxHeight: 320,
    marginVertical: spacing.sm,
  },
  error: {
    ...typeScale.callout,
    color: colors.destructive,
  },
});
