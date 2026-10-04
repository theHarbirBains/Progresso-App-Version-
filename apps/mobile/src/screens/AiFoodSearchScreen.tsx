import { useState } from 'react';
import { View } from 'react-native';
import { Text } from '../design/Text';
import { useAuth } from '../auth/AuthProvider';
import { AppCard } from '../design/AppCard';
import { AppHeader } from '../design/AppHeader';
import { PrimaryButton } from '../design/Button';
import { Screen } from '../design/Screen';
import { TextInput } from '../design/TextInput';
import {
  interpretFoodDescription,
  resolveFoodComponent,
  type ComponentPick,
  type ComponentRequest,
  type FoodInterpretation,
} from '../lib/api';
import { createFood, findOwnFoodByName } from '../nutrition/foodQueries';
import { InterpretedFoodReview } from '../nutrition/InterpretedFoodReview';
import {
  libraryFoodInput,
  libraryFoodName,
  withComponentStatus,
} from '../nutrition/interpretedFood';
import type { RootStackScreenProps } from '../navigation/types';
import { useProgressTheme } from '../progress/useProgressTheme';
import { aiFoodSearchStyles as styles } from './aiFoodSearchStyles';

type Props = RootStackScreenProps<'AiFoodSearch'>;

// AI Food Search: the user describes what they ate in their own words. Claude only works out
// what the words mean. Progresso's own food data and other sources supply every figure, each
// scaled to the amount given. Parts that need an amount or a choice are resolved on the review,
// and only the Add to Food Library tap saves anything.
export function AiFoodSearchScreen({ navigation }: Props) {
  const { session, user } = useAuth();
  const accessToken = session?.access_token;
  const userId = user?.id;
  const { nutritionTheme: theme } = useProgressTheme();

  const [description, setDescription] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [clarification, setClarification] = useState<string | null>(null);
  const [interpretation, setInterpretation] = useState<FoodInterpretation | null>(null);
  const [duplicateName, setDuplicateName] = useState<string | null>(null);
  const [adding, setAdding] = useState(false);
  const [resolvingIndex, setResolvingIndex] = useState<number | null>(null);

  const trimmed = description.trim();

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
    if (!accessToken || trimmed.length === 0 || loading) return;
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
      navigation.navigate('FoodLibrary');
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to add to your Food Library');
    } finally {
      setAdding(false);
    }
  }

  return (
    <Screen
      keyboardAvoiding
      scrollTestID="ai-food-search-scroll"
      header={
        <AppHeader
          testID="ai-food-search-header"
          title="AI Food Search"
          onBack={() => navigation.goBack()}
        />
      }
    >
      <AppCard testID="ai-food-search-card">
        <View style={styles.group}>
          <Text style={styles.description}>
            Describe what you ate. Progresso works out the amount and ingredients, and takes the
            calories and macros from its food data. Review the result before anything is saved.
          </Text>
          <Text testID="ai-food-search-accuracy" style={styles.guidance}>
            For the most accurate estimate, include the amount, serving unit, preparation method,
            and any oils, sauces, or other ingredients used.
          </Text>
          <Text testID="ai-food-search-example" style={styles.example}>
            {'Example: "150 g chicken breast, air fried with 1 tsp olive oil."'}
          </Text>
          <TextInput
            testID="ai-food-search-input"
            label="What did you eat?"
            placeholder="e.g. 100 grams of air fried potatoes with no oil"
            value={description}
            onChangeText={setDescription}
            autoCapitalize="none"
            returnKeyType="done"
            onSubmitEditing={handleInterpret}
          />
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
              disabled={trimmed.length === 0}
              onPress={handleInterpret}
              accentColor={theme.accent}
              onAccentColor={theme.onAccent}
            />
          )}
        </View>
      </AppCard>

      {interpretation ? (
        <InterpretedFoodReview
          interpretation={interpretation}
          duplicateName={duplicateName}
          adding={adding}
          resolvingIndex={resolvingIndex}
          onResolve={handleResolve}
          onAdd={handleAdd}
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
