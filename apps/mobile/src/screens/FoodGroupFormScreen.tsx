import { useEffect, useState } from 'react';
import { Alert, StyleSheet, View } from 'react-native';
import { useAuth } from '../auth/AuthProvider';
import { AppCard } from '../design/AppCard';
import { AppHeader } from '../design/AppHeader';
import { DestructiveButton, PrimaryButton, SecondaryButton } from '../design/Button';
import { IconButton } from '../design/IconButton';
import { ListRow } from '../design/ListRow';
import { Screen } from '../design/Screen';
import { Section } from '../design/Section';
import { StatValue } from '../design/StatValue';
import { Text } from '../design/Text';
import { TextInput } from '../design/TextInput';
import { colors, spacing, typeScale, widgetGap } from '../design/theme';
import { FoodImage } from '../nutrition/FoodImage';
import { FoodMacros } from '../nutrition/FoodFacts';
import { FoodPickerStep } from '../nutrition/FoodPickerStep';
import {
  groupTotals,
  itemAmountText,
  recipePerServing,
  type FoodGroupItem,
} from '../nutrition/foodGroups';
import type { FoodRow } from '../nutrition/foodQueries';
import { LogFoodStep } from '../nutrition/LogFoodStep';
import { calculateLogTotals } from '../nutrition/nutritionCalculations';
import {
  createRecipe,
  deleteRecipe,
  fetchRecipeIngredients,
  updateRecipe,
} from '../nutrition/recipeQueries';
import {
  createSavedMeal,
  deleteSavedMeal,
  updateSavedMeal,
  type SavedMeal,
} from '../nutrition/savedMealQueries';
import { SkeletonRows } from '../design/Skeleton';

const MAX_NAME_LENGTH = 80;
// recipe_servings is numeric(6, 2).
const MAX_RECIPE_SERVINGS = 9999;

type Props = {
  accentColor: string;
  onAccentColor: string;
  /** After a save or a delete. */
  onDone: () => void;
  onCancel: () => void;
} & ({ kind: 'meal'; meal?: SavedMeal } | { kind: 'recipe'; recipe?: FoodRow });

type Step =
  | { type: 'form' }
  | { type: 'pick' }
  // index: the item being changed; a new one when absent.
  | { type: 'amount'; food: FoodRow; index?: number };

/**
 * Builds a saved meal or a recipe -- both a name and a list of foods, each with its amount.
 * A saved meal is logged as each of its foods; a recipe is one food, whose figures per serving
 * are its ingredients' added up and divided by the servings it makes, worked out again each
 * time it's saved. Not a route: the Food Library renders it in place of its list.
 *
 * Layout: Details (the name, and a recipe's servings), the foods as rows (picture, name, the
 * amount as typed, calories; tap to change the amount, x to remove) with Add Food under them,
 * then the total -- a recipe's per serving -- as a calorie readout and the three macros. One
 * filled Save, and when editing, a destructive Delete. Adding a food picks it (FoodPickerStep),
 * then sets its amount on the log step's own amount page.
 */
export function FoodGroupFormScreen(props: Props) {
  const { user } = useAuth();
  const userId = user?.id ?? '';
  const isRecipe = props.kind === 'recipe';
  const editingMeal = props.kind === 'meal' ? props.meal : undefined;
  const editingRecipe = props.kind === 'recipe' ? props.recipe : undefined;
  const editing = Boolean(editingMeal ?? editingRecipe);

  const [name, setName] = useState(editingMeal?.name ?? editingRecipe?.name ?? '');
  const [servings, setServings] = useState(
    editingRecipe?.recipeServings ? String(editingRecipe.recipeServings) : '1',
  );
  const [items, setItems] = useState<FoodGroupItem[]>(editingMeal?.items ?? []);
  // A recipe's ingredients are read when it's opened.
  const [loading, setLoading] = useState(Boolean(editingRecipe));
  const [step, setStep] = useState<Step>({ type: 'form' });
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!editingRecipe) return;
    let cancelled = false;
    fetchRecipeIngredients(editingRecipe.id)
      .then((ingredients) => {
        if (!cancelled) setItems(ingredients);
      })
      .catch((err: unknown) => {
        if (!cancelled) setError(err instanceof Error ? err.message : 'Failed to load recipe');
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, [editingRecipe]);

  const trimmedName = name.trim();
  const servingsNum = Number(servings);
  const validServings =
    !isRecipe ||
    (Number.isFinite(servingsNum) && servingsNum > 0 && servingsNum <= MAX_RECIPE_SERVINGS);
  const nameError =
    trimmedName.length > MAX_NAME_LENGTH ? `Keep it to ${MAX_NAME_LENGTH} characters` : undefined;
  const canSave =
    trimmedName.length > 0 &&
    !nameError &&
    items.length > 0 &&
    validServings &&
    !saving &&
    !loading;

  // A meal's foods that are no longer in the library aren't logged with it, so they don't count.
  const counted = isRecipe ? items : items.filter((item) => item.food.isActive);
  const totals = isRecipe
    ? validServings && items.length > 0
      ? recipePerServing(items, servingsNum)
      : null
    : counted.length > 0
      ? groupTotals(counted)
      : null;
  const batchCalories = isRecipe && items.length > 0 ? groupTotals(items).calories : null;

  const noun = isRecipe ? 'Recipe' : 'Meal';
  const itemsTitle = isRecipe ? 'Ingredients' : 'Foods';

  async function handleSave() {
    if (!canSave) return;
    setError(null);
    setSaving(true);
    try {
      if (props.kind === 'meal') {
        if (props.meal) await updateSavedMeal(userId, props.meal.id, trimmedName, items);
        else await createSavedMeal(userId, trimmedName, items);
      } else {
        const input = { name: trimmedName, servings: servingsNum, ingredients: items };
        if (props.recipe) await updateRecipe(userId, props.recipe.id, input);
        else await createRecipe(userId, input);
      }
      props.onDone();
    } catch (err) {
      setError(err instanceof Error ? err.message : `Failed to save ${noun.toLowerCase()}`);
      setSaving(false);
    }
  }

  function handleDelete() {
    Alert.alert(
      `Delete ${trimmedName || noun}?`,
      isRecipe
        ? 'It leaves your Food Library. Anything already logged from it stays logged.'
        : 'Foods already logged from it stay logged.',
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: `Delete ${noun}`,
          style: 'destructive',
          onPress: () => {
            void (async () => {
              setError(null);
              setSaving(true);
              try {
                if (editingMeal) await deleteSavedMeal(editingMeal.id);
                if (editingRecipe) await deleteRecipe(editingRecipe.id);
                props.onDone();
              } catch (err) {
                setError(
                  err instanceof Error ? err.message : `Failed to delete ${noun.toLowerCase()}`,
                );
                setSaving(false);
              }
            })();
          },
        },
      ],
    );
  }

  if (step.type === 'pick') {
    return (
      <FoodPickerStep
        title={isRecipe ? 'Add Ingredient' : 'Add Food'}
        excludeId={editingRecipe?.id}
        onPick={(food) => setStep({ type: 'amount', food })}
        onCancel={() => setStep({ type: 'form' })}
      />
    );
  }

  if (step.type === 'amount') {
    const current = step.index === undefined ? undefined : items[step.index];
    return (
      <LogFoodStep
        food={step.food}
        initialQuantity={current?.quantity}
        initialEntry={current?.entered}
        accentColor={props.accentColor}
        onAccentColor={props.onAccentColor}
        chooseLabel={current ? 'Update' : `Add to ${noun}`}
        onChoose={({ quantity, entered }) => {
          const item = { food: step.food, quantity, entered };
          setItems((prev) =>
            step.index === undefined
              ? [...prev, item]
              : prev.map((existing, i) => (i === step.index ? item : existing)),
          );
          setStep({ type: 'form' });
        }}
        onCancel={() => setStep(current ? { type: 'form' } : { type: 'pick' })}
      />
    );
  }

  return (
    <Screen
      keyboardAvoiding
      scrollTestID="food-group-form"
      contentContainerStyle={styles.content}
      header={
        <AppHeader
          title={`${editing ? 'Edit' : 'New'} ${noun}`}
          leftAction={{
            icon: 'x',
            onPress: props.onCancel,
            accessibilityLabel: 'Cancel',
            testID: 'food-group-cancel',
          }}
        />
      }
    >
      <AppCard>
        <Section title="Details">
          <View style={styles.group}>
            <TextInput
              testID="food-group-name"
              label="Name"
              placeholder={isRecipe ? 'e.g. Morning Protein Shake' : 'e.g. Usual Breakfast'}
              value={name}
              onChangeText={setName}
              error={nameError}
            />
            {isRecipe ? (
              <TextInput
                testID="food-group-servings"
                label="Servings it makes"
                placeholder="1"
                keyboardType="decimal-pad"
                value={servings}
                onChangeText={setServings}
                error={servings && !validServings ? 'Enter how many servings it makes' : undefined}
                helperText="Each time you log it, one serving is logged unless you change it."
              />
            ) : null}
          </View>
        </Section>
      </AppCard>

      <AppCard testID="food-group-items">
        <Section title={itemsTitle}>
          {loading ? (
            <SkeletonRows testID="food-group-loading" count={3} />
          ) : (
            <View>
              {items.map((item, index) => {
                const calories = Math.round(calculateLogTotals(item.food, item.quantity).calories);
                const gone = !item.food.isActive;
                return (
                  <View
                    key={`${item.food.id}-${index}`}
                    style={[styles.itemRow, index > 0 && styles.itemDivider]}
                  >
                    <View style={styles.flex}>
                      <ListRow
                        testID={`food-group-item-${index}`}
                        leading={
                          <FoodImage uri={item.food.imageUrl} name={item.food.name} size={44} />
                        }
                        title={item.food.name}
                        subtitle={
                          gone
                            ? `${itemAmountText(item)} · No longer in your library`
                            : itemAmountText(item)
                        }
                        value={`${calories} cal`}
                        chevron={false}
                        accessibilityLabel={`${item.food.name}, ${itemAmountText(item)}, ${calories} calories. Change amount`}
                        onPress={() => setStep({ type: 'amount', food: item.food, index })}
                      />
                    </View>
                    <IconButton
                      testID={`food-group-remove-${index}`}
                      icon="x"
                      onPress={() => setItems((prev) => prev.filter((_, i) => i !== index))}
                      accessibilityLabel={`Remove ${item.food.name}`}
                      color={colors.textSecondary}
                    />
                  </View>
                );
              })}
              <View style={items.length > 0 ? styles.addSpaced : undefined}>
                <SecondaryButton
                  testID="food-group-add"
                  size="md"
                  icon="plus"
                  label={isRecipe ? 'Add Ingredient' : 'Add Food'}
                  onPress={() => setStep({ type: 'pick' })}
                />
              </View>
            </View>
          )}
        </Section>
      </AppCard>

      <AppCard hero testID="food-group-totals">
        <Text style={styles.totalsLabel}>{isRecipe ? 'Per serving' : 'Total'}</Text>
        <StatValue
          testID="food-group-calories"
          value={totals ? String(Math.round(totals.calories)) : '—'}
          unit={totals ? ' cal' : undefined}
          color={props.accentColor}
        />
        {batchCalories !== null ? (
          <Text testID="food-group-batch" style={styles.batch}>
            Whole recipe: {Math.round(batchCalories)} cal
          </Text>
        ) : null}
      </AppCard>

      <FoodMacros
        testID="food-group-macros"
        proteinG={totals ? Math.round(totals.proteinG * 10) / 10 : null}
        carbsG={totals ? Math.round(totals.carbsG * 10) / 10 : null}
        fatG={totals ? Math.round(totals.fatG * 10) / 10 : null}
        testIDs={{
          protein: 'food-group-protein',
          carbs: 'food-group-carbs',
          fat: 'food-group-fat',
        }}
      />

      <View style={styles.actions}>
        {error ? (
          <Text testID="food-group-error" style={styles.error}>
            {error}
          </Text>
        ) : null}

        <PrimaryButton
          testID="food-group-save"
          label={`Save ${noun}`}
          onPress={handleSave}
          loading={saving}
          disabled={!canSave && !saving}
          accentColor={props.accentColor}
          onAccentColor={props.onAccentColor}
        />

        {editing ? (
          <DestructiveButton
            testID="food-group-delete"
            label={`Delete ${noun}`}
            onPress={handleDelete}
            disabled={saving}
          />
        ) : null}
      </View>
    </Screen>
  );
}

const styles = StyleSheet.create({
  content: {
    gap: widgetGap,
  },
  group: {
    gap: spacing.lg,
  },
  flex: {
    flex: 1,
  },
  itemRow: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  itemDivider: {
    borderTopWidth: StyleSheet.hairlineWidth,
    borderTopColor: colors.divider,
  },
  addSpaced: {
    marginTop: spacing.md,
  },
  totalsLabel: {
    ...typeScale.body,
    color: colors.textSecondary,
    marginBottom: spacing.xs,
  },
  batch: {
    ...typeScale.secondary,
    color: colors.textMuted,
    marginTop: spacing.xs,
  },
  actions: {
    gap: spacing.sm,
    marginTop: spacing.sm,
  },
  error: {
    ...typeScale.callout,
    color: colors.destructive,
  },
});
