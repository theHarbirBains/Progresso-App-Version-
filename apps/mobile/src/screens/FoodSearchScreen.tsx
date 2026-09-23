import { useCallback, useEffect, useState } from 'react';
import { ActivityIndicator, View } from 'react-native';
import { Feather } from '@expo/vector-icons';
import { useAuth } from '../auth/AuthProvider';
import { AppCard } from '../design/AppCard';
import { AppHeader } from '../design/AppHeader';
import { PrimaryButton } from '../design/Button';
import { EmptyState } from '../design/EmptyState';
import { ErrorState } from '../design/ErrorState';
import { ListRow } from '../design/ListRow';
import { Screen } from '../design/Screen';
import { SectionHeader } from '../design/SectionHeader';
import { TextInput } from '../design/TextInput';
import { colors } from '../design/theme';
import { searchFoods, type FoodSearchResult } from '../lib/api';
import type { RootStackScreenProps } from '../navigation/types';
import { FoodFacts } from '../nutrition/FoodFacts';
import { FoodImage } from '../nutrition/FoodImage';
import { LogFoodStep } from '../nutrition/LogFoodStep';
import { useProgressTheme } from '../progress/useProgressTheme';
import { foodSearchStyles as styles } from './foodSearchStyles';

type Props = RootStackScreenProps<'FoodSearch'>;

const SEARCH_DEBOUNCE_MS = 300;

// Searches Progresso's food database (generic foods plus real branded
// grocery products cached from an external provider -- see
// apps/api/src/foods/) via the backend's /foods/search endpoint, never
// direct-to-Supabase, since the external-provider orchestration is real
// business logic. Selecting a result shows its nutrition info and serving
// size, then reuses the same LogFoodStep every other "found a food" flow
// (Food Library, Scan Barcode) logs through -- one normalized food model,
// one logging pipeline. A provider-reported macro Open Food Facts genuinely
// didn't supply (null, shown as "—" on this screen) becomes 0 only at the
// point of logging, since food_logs' own columns are NOT NULL -- never
// displayed as a fabricated 0 beforehand.
//
// Layout: the search field is pinned under the header; the results sit in
// one widget as rows (the food's picture, name, "brand · serving", calories as
// a mono value) separated by hairlines; the detail is the shared FoodFacts
// widgets with one filled Log Food button.
export function FoodSearchScreen({ navigation }: Props) {
  const { session } = useAuth();
  const accessToken = session?.access_token;
  const [logging, setLogging] = useState(false);

  // Follows the existing Nutrition accent/theme system (the shared,
  // app-wide-unconditional default -- see useProgressTheme's own comment)
  // rather than introducing a new color.
  const { nutritionTheme: theme } = useProgressTheme();

  const [searchInput, setSearchInput] = useState('');
  const [search, setSearch] = useState('');
  const [results, setResults] = useState<FoodSearchResult[]>([]);
  const [selected, setSelected] = useState<FoodSearchResult | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Debounce free-text input before it drives a query, so every keystroke
  // doesn't fire its own request -- same pattern as FoodLibraryScreen.
  useEffect(() => {
    const timer = setTimeout(() => setSearch(searchInput.trim()), SEARCH_DEBOUNCE_MS);
    return () => clearTimeout(timer);
  }, [searchInput]);

  const runSearch = useCallback(async () => {
    if (!search) {
      setResults([]);
      setError(null);
      return;
    }
    if (!accessToken) return;
    setLoading(true);
    setError(null);
    try {
      const response = await searchFoods(accessToken, search);
      setResults(response.foods);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to search foods');
    } finally {
      setLoading(false);
    }
  }, [search, accessToken]);

  useEffect(() => {
    void runSearch();
  }, [runSearch]);

  if (selected && logging) {
    return (
      <LogFoodStep
        food={{
          id: selected.id,
          name: selected.name,
          servingSize: selected.servingSize,
          servingUnit: selected.servingUnit,
          calories: selected.calories,
          // A macro the provider genuinely didn't report becomes 0 only
          // here, at the point of logging -- food_logs' own columns are
          // NOT NULL, so this is the one honest numeric default; the
          // detail view above still shows "—", never a fabricated 0.
          proteinG: selected.proteinG ?? 0,
          carbsG: selected.carbsG ?? 0,
          fatG: selected.fatG ?? 0,
          imageUrl: selected.imageUrl,
        }}
        accentColor={theme.accent}
        onAccentColor={theme.onAccent}
        onDone={() => navigation.navigate('Nutrition')}
        onCancel={() => setLogging(false)}
      />
    );
  }

  if (selected) {
    return (
      <Screen
        scrollTestID="food-search-detail-scroll"
        header={
          <AppHeader
            title={selected.name}
            subtitle={selected.brand ?? undefined}
            onBack={() => setSelected(null)}
            testID="food-search-detail-header"
          />
        }
      >
        <View testID="food-search-detail-card">
          <FoodFacts
            name={selected.name}
            imageUrl={selected.imageUrl}
            servingSize={selected.servingSize}
            servingUnit={selected.servingUnit}
            calories={selected.calories}
            proteinG={selected.proteinG}
            carbsG={selected.carbsG}
            fatG={selected.fatG}
            showAttribution={selected.provider === 'open_food_facts'}
            accentColor={theme.accent}
            testIDs={{
              serving: 'food-search-detail-serving',
              calories: 'food-search-detail-calories',
              protein: 'food-search-detail-protein',
              carbs: 'food-search-detail-carbs',
              fat: 'food-search-detail-fat',
              attribution: 'food-search-detail-attribution',
            }}
          />
        </View>

        <View style={styles.logButtonWrap}>
          <PrimaryButton
            testID="food-search-log-button"
            label="Log Food"
            onPress={() => setLogging(true)}
            accentColor={theme.accent}
            onAccentColor={theme.onAccent}
          />
        </View>
      </Screen>
    );
  }

  return (
    <Screen
      scrollTestID="food-search-scroll"
      header={
        <View>
          <AppHeader
            title="Search Food"
            onBack={() => navigation.goBack()}
            testID="food-search-header"
          />
          <View style={styles.searchRow}>
            <TextInput
              testID="food-search-input"
              placeholder="Search foods (e.g. chicken breast)"
              value={searchInput}
              onChangeText={setSearchInput}
              autoCapitalize="none"
              leftAccessory={<Feather name="search" size={16} color={colors.textMuted} />}
            />
          </View>
        </View>
      }
    >
      <AppCard testID="food-search-results-card">
        {error ? (
          <ErrorState
            testID="food-search-error"
            message={error}
            onRetry={() => {
              void runSearch();
            }}
          />
        ) : loading ? (
          <View style={styles.loading}>
            <ActivityIndicator
              testID="food-search-loading"
              size="large"
              color={colors.textPrimary}
            />
          </View>
        ) : search === '' ? (
          <EmptyState
            testID="food-search-empty-initial"
            title="Search for a food to see its nutrition info"
          />
        ) : results.length === 0 ? (
          <EmptyState testID="food-search-empty-results" title={`No foods found for "${search}"`} />
        ) : (
          <>
            <SectionHeader label="Results" />
            {results.map((food, index) => (
              <ListRow
                key={food.id}
                testID={`food-search-result-${food.id}`}
                leading={<FoodImage uri={food.imageUrl} name={food.name} size={44} />}
                title={food.name}
                subtitle={`${food.brand ? `${food.brand} · ` : ''}${food.servingSize} ${food.servingUnit}`}
                value={`${food.calories} cal`}
                divider={index > 0}
                onPress={() => setSelected(food)}
              />
            ))}
          </>
        )}
      </AppCard>
    </Screen>
  );
}
