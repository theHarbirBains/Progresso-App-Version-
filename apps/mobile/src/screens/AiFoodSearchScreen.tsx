import { useState } from 'react';
import { View } from 'react-native';
import { Text } from '../design/Text';
import { useAuth } from '../auth/AuthProvider';
import { AppCard } from '../design/AppCard';
import { AppHeader } from '../design/AppHeader';
import { PrimaryButton } from '../design/Button';
import { Screen } from '../design/Screen';
import { TextInput } from '../design/TextInput';
import { estimateNutrition, type NutritionEstimate } from '../lib/api';
import type { RootStackScreenProps } from '../navigation/types';
import { useProgressTheme } from '../progress/useProgressTheme';
import { aiFoodSearchStyles as styles } from './aiFoodSearchStyles';
import { FoodFormScreen } from './FoodFormScreen';

type Props = RootStackScreenProps<'AiFoodSearch'>;

// A natural-language alternative to FoodSearchScreen's database lookup: the
// user describes a food or meal in their own words (e.g. "100 grams of air
// fried potatoes with no oil") instead of searching Progresso's own/cached
// catalog, and the backend's Claude-backed /foods/estimate endpoint (see
// apps/api/src/foods/providers/anthropic-nutrition.provider.ts) returns its
// single best-guess calories/macros. That estimate is never saved on its
// own -- it hands straight into FoodFormScreen's existing create form,
// pre-filled (FoodFormInitialValues), so the user reviews/edits it exactly
// like any other custom food before Save calls the same createFood() every
// other custom-food path already uses. Going back from that form (Cancel)
// returns here to try a different description, rather than leaving the
// screen entirely.
export function AiFoodSearchScreen({ navigation }: Props) {
  const { session } = useAuth();
  const accessToken = session?.access_token;
  const { nutritionTheme: theme } = useProgressTheme();

  const [description, setDescription] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [estimate, setEstimate] = useState<NutritionEstimate | null>(null);

  const trimmed = description.trim();

  async function handleEstimate() {
    if (!accessToken || trimmed.length === 0 || loading) return;
    setLoading(true);
    setError(null);
    try {
      setEstimate(await estimateNutrition(accessToken, trimmed));
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to estimate nutrition');
    } finally {
      setLoading(false);
    }
  }

  if (estimate) {
    return (
      <FoodFormScreen
        mode="create"
        initialValues={estimate}
        onDone={() => navigation.navigate('FoodLibrary')}
        onCancel={() => setEstimate(null)}
        accentColor={theme.accent}
        onAccentColor={theme.onAccent}
      />
    );
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
            Describe what you ate, and Claude will estimate its calories and macros -- you can
            review and edit the result before saving it to your food library.
          </Text>
          <TextInput
            testID="ai-food-search-input"
            label="What did you eat?"
            placeholder="e.g. 100 grams of air fried potatoes with no oil"
            value={description}
            onChangeText={setDescription}
            autoCapitalize="none"
            returnKeyType="done"
            onSubmitEditing={handleEstimate}
          />
          {error ? (
            <Text testID="ai-food-search-error" style={styles.errorText}>
              {error}
            </Text>
          ) : null}
          <PrimaryButton
            testID="ai-food-search-submit"
            label={loading ? 'Estimating…' : 'Get Estimate'}
            loading={loading}
            disabled={trimmed.length === 0}
            onPress={handleEstimate}
            accentColor={theme.accent}
            onAccentColor={theme.onAccent}
          />
        </View>
      </AppCard>
    </Screen>
  );
}
