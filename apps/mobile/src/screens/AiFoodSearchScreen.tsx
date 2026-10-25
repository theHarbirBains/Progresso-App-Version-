import { useState } from 'react';
import { Alert, Pressable, ScrollView, View } from 'react-native';
import { Feather } from '@expo/vector-icons';
import { Text } from '../design/Text';
import { useAuth } from '../auth/AuthProvider';
import { AppCard } from '../design/AppCard';
import { AppHeader } from '../design/AppHeader';
import { BottomSheet } from '../design/BottomSheet';
import { PrimaryButton } from '../design/Button';
import { RiseIn } from '../design/RiseIn';
import { Screen } from '../design/Screen';
import { TextInput } from '../design/TextInput';
import { colors } from '../design/theme';
import {
  interpretFoodDescription,
  resolveFoodComponent,
  type ComponentPick,
  type ComponentRequest,
  type FoodInterpretation,
} from '../lib/api';
import { AiFoodAdjustStep } from '../nutrition/AiFoodAdjustStep';
import {
  AI_FOOD_DESCRIPTION_MAX,
  aiFoodDescription,
  defaultUnitFor,
  parseAmount,
  unitLabel,
  unitsFor,
} from '../nutrition/aiFoodFields';
import {
  createFood,
  findOwnFoodByName,
  updateFood,
  type FoodInput,
  type FoodRow,
} from '../nutrition/foodQueries';
import { InterpretedFoodReview } from '../nutrition/InterpretedFoodReview';
import {
  adjustedProvenance,
  libraryFoodInput,
  libraryFoodName,
  sameFigures,
  withComponentStatus,
} from '../nutrition/interpretedFood';
import { LogFoodStep } from '../nutrition/LogFoodStep';
import { goToSection } from '../navigation/sectionNavigation';
import type { RootStackScreenProps } from '../navigation/types';
import { OnboardingOptionCard } from '../onboarding/OnboardingOptionCard';
import { useProgressTheme } from '../progress/useProgressTheme';
import { aiFoodSearchStyles as styles } from './aiFoodSearchStyles';
import { wholeFigure } from '../nutrition/wholeFigures';

type Props = RootStackScreenProps<'AiFoodSearch'>;

// AI Food Search: the user says what they ate in three fields -- how much (an amount and a unit),
// what food (generic, a brand, a restaurant item), and, optionally, how it was made -- which make
// one description for the interpret request (nutrition/aiFoodFields.ts). Claude only works out
// what the words mean. Progresso's own food data and other sources supply every figure, each
// scaled to the amount given. Parts that need an amount or a choice are resolved on the review,
// and nothing is saved until the person says so:
// - Review & Log: check (and change) the name and figures, then set the amount on the usual log
//   step and log it to today. The food is kept in the Food Library for next time -- the same
//   food again if one of that name already has these figures, never a second copy; a saved food
//   of that name with other figures is used or updated only on the person's choice.
// - Add to Food Library: save it for later without logging.
type Step = { type: 'search' } | { type: 'adjust' } | { type: 'log'; food: FoodRow };
export function AiFoodSearchScreen({ navigation, route }: Props) {
  const day = route.params?.day;
  const { session, user } = useAuth();
  const accessToken = session?.access_token;
  const userId = user?.id;
  const { nutritionTheme: theme } = useProgressTheme();

  const [amount, setAmount] = useState('');
  // Null until the person picks a unit: it follows the food until then (a drink starts in ml).
  const [chosenUnit, setChosenUnit] = useState<string | null>(null);
  const [foodName, setFoodName] = useState('');
  const [preparation, setPreparation] = useState('');
  const [unitSheetOpen, setUnitSheetOpen] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [clarification, setClarification] = useState<string | null>(null);
  const [interpretation, setInterpretation] = useState<FoodInterpretation | null>(null);
  const [duplicateName, setDuplicateName] = useState<string | null>(null);
  const [adding, setAdding] = useState(false);
  const [resolvingIndex, setResolvingIndex] = useState<number | null>(null);
  const [step, setStep] = useState<Step>({ type: 'search' });
  const [preparing, setPreparing] = useState(false);
  const [adjustError, setAdjustError] = useState<string | null>(null);

  const unit = chosenUnit ?? defaultUnitFor(foodName);
  const amountValue = parseAmount(amount);
  const amountInvalid = amountValue !== null && Number.isNaN(amountValue);
  const trimmed = aiFoodDescription({ amount, unit, food: foodName, preparation });
  const tooLong = trimmed.length > AI_FOOD_DESCRIPTION_MAX;
  const canEstimate = foodName.trim().length > 0 && !amountInvalid && !tooLong;

  // Warns early when a complete food already has a library entry with its name. Adding checks again.
  async function checkDuplicate(next: FoodInterpretation) {
    if (!userId || !next.complete) {
      setDuplicateName(null);
      return;
    }
    const existing = await findOwnFoodByName(userId, libraryFoodName(next)).catch(() => null);
    setDuplicateName(existing?.name ?? null);
  }

  async function handleInterpret() {
    if (!accessToken || !canEstimate || loading) return;
    setLoading(true);
    setError(null);
    setClarification(null);
    setInterpretation(null);
    setDuplicateName(null);
    try {
      const response = await interpretFoodDescription(accessToken, trimmed);
      if (response.status === 'clarification') {
        setClarification(response.question);
        return;
      }
      setInterpretation(response.interpretation);
      await checkDuplicate(response.interpretation);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to read that food description');
    } finally {
      setLoading(false);
    }
  }

  // Resolves one pending part: a candidate the user picked, or an amount they gave.
  async function handleResolve(
    request: ComponentRequest,
    pick: ComponentPick | null,
    quantity: { amount: number; unit: string } | null,
  ) {
    if (!accessToken || !interpretation || resolvingIndex !== null) return;
    setResolvingIndex(request.index);
    setError(null);
    try {
      const status = await resolveFoodComponent(
        accessToken,
        { ...request, quantity: quantity ?? request.quantity },
        pick,
      );
      const next = withComponentStatus(interpretation, status);
      setInterpretation(next);
      await checkDuplicate(next);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to look that up');
    } finally {
      setResolvingIndex(null);
    }
  }

  async function handleAdd() {
    if (!interpretation || !interpretation.complete || !userId || adding) return;
    setAdding(true);
    setError(null);
    try {
      // Checked again at the moment of adding, so a food added elsewhere can't be duplicated.
      const input = libraryFoodInput(interpretation);
      const existing = await findOwnFoodByName(userId, input.name);
      if (existing) {
        setDuplicateName(existing.name);
        return;
      }
      await createFood(userId, input);
      navigation.navigate('FoodLibrary', { day });
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to add to your Food Library');
    } finally {
      setAdding(false);
    }
  }

  // The food to log, kept in the library: a saved food of the same name with the same figures is
  // used again; one with other figures is used or updated only if the person says so.
  async function handleContinue(input: FoodInput, adjusted: boolean) {
    if (!userId || preparing) return;
    const food: FoodInput = adjusted
      ? { ...input, provenance: adjustedProvenance(input.provenance) }
      : input;
    setAdjustError(null);
    setPreparing(true);
    try {
      const existing = await findOwnFoodByName(userId, food.name);
      if (!existing) {
        setStep({ type: 'log', food: await createFood(userId, food) });
        return;
      }
      if (sameFigures(existing, food)) {
        setStep({ type: 'log', food: existing });
        return;
      }
      Alert.alert(
        `"${existing.name}" is already in your Food Library`,
        `Saved: ${wholeFigure(existing.calories)} cal for ${existing.servingSize} ${existing.servingUnit}. This search: ${wholeFigure(food.calories)} cal for ${food.servingSize} ${food.servingUnit}.`,
        [
          { text: 'Cancel', style: 'cancel' },
          { text: 'Use Saved', onPress: () => setStep({ type: 'log', food: existing }) },
          {
            text: 'Update Saved',
            onPress: () => {
              void updateFood(existing.id, {
                servingSize: food.servingSize,
                servingUnit: food.servingUnit,
                calories: food.calories,
                proteinG: food.proteinG,
                carbsG: food.carbsG,
                fatG: food.fatG,
                provenance: food.provenance,
              })
                .then((updated) => setStep({ type: 'log', food: updated }))
                .catch((err: unknown) =>
                  setAdjustError(err instanceof Error ? err.message : 'Failed to update the food'),
                );
            },
          },
        ],
      );
    } catch (err) {
      setAdjustError(err instanceof Error ? err.message : 'Failed to prepare the food');
    } finally {
      setPreparing(false);
    }
  }

  if (step.type === 'log') {
    return (
      <LogFoodStep
        food={step.food}
        accentColor={theme.accent}
        onAccentColor={theme.onAccent}
        day={day}
        onDone={() => goToSection(navigation, 'Nutrition')}
        onCancel={() => setStep({ type: 'adjust' })}
      />
    );
  }

  if (step.type === 'adjust' && interpretation?.complete) {
    return (
      <AiFoodAdjustStep
        input={libraryFoodInput(interpretation)}
        busy={preparing}
        error={adjustError}
        accentColor={theme.accent}
        onAccentColor={theme.onAccent}
        onContinue={(input, adjusted) => void handleContinue(input, adjusted)}
        onBack={() => setStep({ type: 'search' })}
      />
    );
  }

  return (
    <Screen
      keyboardAvoiding
      // The search card rises here, and the review rolls its own widgets out as they arrive.
      rollout={false}
      scrollTestID="ai-food-search-scroll"
      header={
        <AppHeader
          testID="ai-food-search-header"
          title="AI Food Search"
          onBack={() => navigation.goBack()}
        />
      }
    >
      <RiseIn>
        <AppCard testID="ai-food-search-card">
          <View style={styles.group}>
            <Text style={styles.description}>
              Say how much you had, what it was and how it was made. Progresso works out the
              ingredients and takes the calories and macros from its food data. Review the result
              before anything is saved.
            </Text>
            <View style={styles.servingRow}>
              <View style={styles.amountCell}>
                <TextInput
                  testID="ai-food-search-amount"
                  label="Serving size"
                  placeholder="e.g. 150"
                  keyboardType="decimal-pad"
                  value={amount}
                  onChangeText={setAmount}
                  error={amountInvalid ? 'A number above 0' : undefined}
                />
              </View>
              <View style={styles.unitCell}>
                <Text style={styles.fieldLabel}>Unit</Text>
                <Pressable
                  testID="ai-food-search-unit"
                  style={styles.unitButton}
                  onPress={() => setUnitSheetOpen(true)}
                  accessibilityRole="button"
                  accessibilityLabel={`Unit, ${unitLabel(unit)}`}
                >
                  <Text style={styles.unitValue} numberOfLines={1}>
                    {unitLabel(unit)}
                  </Text>
                  <Feather name="chevron-down" size={16} color={colors.textMuted} />
                </Pressable>
              </View>
            </View>
            <TextInput
              testID="ai-food-search-input"
              label="What food did you eat?"
              placeholder="e.g. Gala apple, Fairlife 2% milk, McDonald's Big Mac"
              value={foodName}
              onChangeText={setFoodName}
              returnKeyType="done"
              onSubmitEditing={handleInterpret}
            />
            <TextInput
              testID="ai-food-search-preparation"
              label="How was it prepared? (optional)"
              placeholder="e.g. Air-fried with garlic powder and no oil"
              value={preparation}
              onChangeText={setPreparation}
              autoCapitalize="none"
              returnKeyType="done"
              onSubmitEditing={handleInterpret}
              error={
                tooLong ? `Keep it under ${AI_FOOD_DESCRIPTION_MAX} characters in all` : undefined
              }
            />
            <Text testID="ai-food-search-accuracy" style={styles.guidance}>
              Leave the preparation blank when it makes no difference. Oils, sauces and anything
              cooked with it change the figures most, so include them when they&apos;re there.
            </Text>
            {clarification ? (
              <Text testID="ai-food-search-clarification" style={styles.clarificationText}>
                {clarification}
              </Text>
            ) : null}
            {error ? (
              <Text testID="ai-food-search-error" style={styles.errorText}>
                {error}
              </Text>
            ) : null}
            {interpretation ? null : (
              <PrimaryButton
                testID="ai-food-search-submit"
                label={loading ? 'Reading…' : 'Get Estimate'}
                loading={loading}
                disabled={!canEstimate}
                onPress={handleInterpret}
                accentColor={theme.accent}
                onAccentColor={theme.onAccent}
              />
            )}
          </View>
        </AppCard>
      </RiseIn>

      <BottomSheet
        visible={unitSheetOpen}
        onClose={() => setUnitSheetOpen(false)}
        testID="ai-food-search-unit-sheet"
      >
        <View style={styles.sheetContent}>
          <Text style={styles.sheetTitle}>Unit</Text>
          <ScrollView style={styles.sheetList} showsVerticalScrollIndicator={false}>
            {unitsFor(foodName).map((option) => (
              <OnboardingOptionCard
                key={option.value}
                testID={`ai-food-search-unit-${option.value}`}
                label={option.label}
                selected={unit === option.value}
                onPress={() => {
                  setChosenUnit(option.value);
                  setUnitSheetOpen(false);
                }}
                accentColor={theme.accent}
              />
            ))}
          </ScrollView>
        </View>
      </BottomSheet>

      {interpretation ? (
        <InterpretedFoodReview
          interpretation={interpretation}
          duplicateName={duplicateName}
          adding={adding}
          resolvingIndex={resolvingIndex}
          onResolve={handleResolve}
          onAdd={handleAdd}
          onLog={() => {
            setAdjustError(null);
            setStep({ type: 'adjust' });
          }}
          onDescribeAgain={() => {
            setInterpretation(null);
            setDuplicateName(null);
            setError(null);
          }}
          accentColor={theme.accent}
          onAccentColor={theme.onAccent}
        />
      ) : null}
    </Screen>
  );
}
