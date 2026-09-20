import { useCallback, useEffect, useState } from 'react';
import { ScrollView, Text, View } from 'react-native';
import { Feather } from '@expo/vector-icons';
import { useAuth } from '../auth/AuthProvider';
import { AppCard } from '../design/AppCard';
import { AppHeader } from '../design/AppHeader';
import { PrimaryButton } from '../design/Button';
import { EmptyState } from '../design/EmptyState';
import { ErrorState } from '../design/ErrorState';
import { LoadingState } from '../design/LoadingState';
import { SectionHeader } from '../design/SectionHeader';
import { StatValue } from '../design/StatValue';
import { TextInput } from '../design/TextInput';
import { colors } from '../design/theme';
import { getMyProfile, searchFoods, type FoodSearchResult } from '../lib/api';
import type { RootStackScreenProps } from '../navigation/types';
import { LogFoodStep } from '../nutrition/LogFoodStep';
import { buildAccentTheme, DEFAULT_NUTRITION_THEME, type AccentTheme } from '../theme/accentColor';
import { foodSearchStyles as styles } from './foodSearchStyles';

type Props = RootStackScreenProps<'FoodSearch'>;

const SEARCH_DEBOUNCE_MS = 300;

/** "—" for a macro the provider genuinely didn't report -- never fabricated as 0. */
function formatMacro(value: number | null): string {
  return value === null ? '—' : String(value);
}

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
export function FoodSearchScreen({ navigation }: Props) {
  const { user, session } = useAuth();
  const userId = user?.id ?? '';
  const accessToken = session?.access_token;
  const [logging, setLogging] = useState(false);

  // Follows the existing Nutrition accent/theme system (same
  // nutritionAccentColor-or-default derivation DashboardScreen uses) rather
  // than introducing a new color.
  const [theme, setTheme] = useState<AccentTheme>(DEFAULT_NUTRITION_THEME);

  const [searchInput, setSearchInput] = useState('');
  const [search, setSearch] = useState('');
  const [results, setResults] = useState<FoodSearchResult[]>([]);
  const [selected, setSelected] = useState<FoodSearchResult | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let mounted = true;
    async function loadTheme() {
      if (!accessToken) return;
      try {
        const profile = await getMyProfile(accessToken);
        if (!mounted) return;
        setTheme(
          profile.nutritionAccentColor
            ? buildAccentTheme(profile.nutritionAccentColor)
            : DEFAULT_NUTRITION_THEME,
        );
      } catch {
        // Keep the default nutrition theme -- non-fatal.
      }
    }
    void loadTheme();
    return () => {
      mounted = false;
    };
  }, [accessToken]);

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
        }}
        userId={userId}
        accentColor={theme.accent}
        onAccentColor={theme.onAccent}
        onDone={() => navigation.navigate('Nutrition')}
        onCancel={() => setLogging(false)}
      />
    );
  }

  if (selected) {
    return (
      <View style={styles.screen}>
        <AppHeader
          title={selected.name}
          subtitle={selected.brand ?? undefined}
          onBack={() => setSelected(null)}
          testID="food-search-detail-header"
        />
        <ScrollView
          contentContainerStyle={styles.scrollContent}
          showsVerticalScrollIndicator={false}
        >
          <AppCard testID="food-search-detail-card">
            <Text testID="food-search-detail-serving" style={styles.detailServing}>
              Serving: {selected.servingSize} {selected.servingUnit}
            </Text>

            <View style={styles.detailCalorieRow}>
              <StatValue
                testID="food-search-detail-calories"
                value={String(selected.calories)}
                unit=" cal"
                color={theme.accent}
              />
            </View>

            <View style={styles.detailMacroRow}>
              <View style={styles.detailMacroItem}>
                <Text style={styles.detailMacroLabel}>Protein</Text>
                <StatValue
                  testID="food-search-detail-protein"
                  size="medium"
                  value={formatMacro(selected.proteinG)}
                  unit={selected.proteinG === null ? undefined : 'g'}
                  color={colors.textPrimary}
                />
              </View>
              <View style={styles.detailMacroItem}>
                <Text style={styles.detailMacroLabel}>Carbs</Text>
                <StatValue
                  testID="food-search-detail-carbs"
                  size="medium"
                  value={formatMacro(selected.carbsG)}
                  unit={selected.carbsG === null ? undefined : 'g'}
                  color={colors.textPrimary}
                />
              </View>
              <View style={styles.detailMacroItem}>
                <Text style={styles.detailMacroLabel}>Fat</Text>
                <StatValue
                  testID="food-search-detail-fat"
                  size="medium"
                  value={formatMacro(selected.fatG)}
                  unit={selected.fatG === null ? undefined : 'g'}
                  color={colors.textPrimary}
                />
              </View>
            </View>

            {/* Open Food Facts' ODbL license asks integrations to credit
                the source -- kept to one small muted line on the detail
                view only (never on search result rows), not a badge. */}
            {selected.provider === 'open_food_facts' ? (
              <Text testID="food-search-detail-attribution" style={styles.detailAttribution}>
                Data from Open Food Facts
              </Text>
            ) : null}
          </AppCard>

          <View style={styles.logButtonWrap}>
            <PrimaryButton
              testID="food-search-log-button"
              label="Log Food"
              onPress={() => setLogging(true)}
              accentColor={theme.accent}
              onAccentColor={theme.onAccent}
            />
          </View>
        </ScrollView>
      </View>
    );
  }

  return (
    <View style={styles.screen}>
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

      <ScrollView contentContainerStyle={styles.scrollContent} keyboardShouldPersistTaps="handled">
        {error ? (
          <ErrorState
            testID="food-search-error"
            message={error}
            onRetry={() => {
              void runSearch();
            }}
          />
        ) : loading ? (
          <LoadingState testID="food-search-loading" />
        ) : search === '' ? (
          <EmptyState
            testID="food-search-empty-initial"
            icon={<Feather name="search" size={24} color={colors.textMuted} />}
            title="Search for a food to see its nutrition info"
          />
        ) : results.length === 0 ? (
          <EmptyState
            testID="food-search-empty-results"
            icon={<Feather name="inbox" size={24} color={colors.textMuted} />}
            title={`No foods found for "${search}"`}
          />
        ) : (
          <>
            <SectionHeader label="Results" />
            {results.map((food) => (
              <AppCard
                key={food.id}
                testID={`food-search-result-${food.id}`}
                onPress={() => setSelected(food)}
                style={styles.resultCard}
              >
                <View style={styles.resultRow}>
                  <View style={styles.resultIconWrap}>
                    <Feather name="circle" size={16} color={theme.accent} />
                  </View>
                  <View style={styles.resultBody}>
                    <Text style={styles.resultName}>{food.name}</Text>
                    <Text style={styles.resultMeta}>
                      {food.brand ? `${food.brand} · ` : ''}
                      {food.servingSize} {food.servingUnit}
                    </Text>
                  </View>
                  <Text style={styles.resultCalories}>{food.calories} cal</Text>
                </View>
              </AppCard>
            ))}
          </>
        )}
      </ScrollView>
    </View>
  );
}
