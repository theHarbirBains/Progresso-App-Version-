import { useCallback, useEffect, useRef, useState } from 'react';
import { ActivityIndicator, View } from 'react-native';
import { Feather } from '@expo/vector-icons';
import { useAuth } from '../auth/AuthProvider';
import { AppCard } from '../design/AppCard';
import { AppHeader } from '../design/AppHeader';
import { PrimaryButton, SecondaryButton, TextButton } from '../design/Button';
import { EmptyState } from '../design/EmptyState';
import { ErrorState } from '../design/ErrorState';
import { ListRow } from '../design/ListRow';
import { Screen } from '../design/Screen';
import { SectionHeader } from '../design/SectionHeader';
import { Text } from '../design/Text';
import { TextInput } from '../design/TextInput';
import { colors } from '../design/theme';
import { useDebouncedValue } from '../lib/useDebouncedValue';
import { searchFoods, type FoodSearchResponse, type FoodSearchResult } from '../lib/api';
import type { RootStackScreenProps } from '../navigation/types';
import { goToSection } from '../navigation/sectionNavigation';
import { FoodFacts } from '../nutrition/FoodFacts';
import { FoodImage } from '../nutrition/FoodImage';
import { FoodNutrients } from '../nutrition/FoodNutrients';
import { foodPageActions } from '../nutrition/foodPageActions';
import { foodSourceText } from '../nutrition/foodSource';
import { LogFoodStep } from '../nutrition/LogFoodStep';
import { useProgressTheme } from '../progress/useProgressTheme';
import { foodSearchStyles as styles } from './foodSearchStyles';
import { SkeletonRows } from '../design/Skeleton';
import { wholeFigure } from '../nutrition/wholeFigures';
import {
  narrowResults,
  recallSearch,
  rememberSearch,
  SEARCH_TYPING_PAUSE_MS,
} from '../nutrition/foodSearchMemory';

type Props = RootStackScreenProps<'FoodSearch'>;

// Searches Progresso's food database (generic foods, USDA FoodData Central's
// reference whole foods, plus real branded grocery products cached from an
// external provider -- see apps/api/src/foods/) via the backend's
// /foods/search endpoint, never direct-to-Supabase, since the
// external-provider orchestration is real business logic. Selecting a result
// shows its nutrition info and serving size, then reuses the same LogFoodStep
// every other "found a food" flow (Food Library, Scan Barcode) logs through --
// one normalized food model, one logging pipeline. A provider-reported macro
// Open Food Facts genuinely didn't supply (null, shown as "—" on this screen)
// becomes 0 only at the point of logging, since food_logs' own columns are
// NOT NULL -- never displayed as a fabricated 0 beforehand.
//
// Layout: the search field is pinned under the header; the results sit in
// one widget as rows (the food's picture, name, "brand · serving" -- "USDA ·
// 100 g" for a USDA reference food -- calories as a mono value) separated by
// hairlines; the detail is the shared FoodFacts widgets with one filled Log
// Food button.
//
// Each search asks twice at once: a quick answer without Open Food Facts'
// branded products (Progresso's catalog and USDA's whole foods, a fraction of
// a second), shown as soon as it comes, and the full one, which replaces it
// when it arrives -- a line at the foot says products are still being looked
// for meanwhile. An answer to anything but the latest search is dropped, so a
// slow early search never overwrites a later one, and what was found stays on
// screen while the next search runs instead of flashing back to placeholders.
// To feel instant (nutrition/foodSearchMemory.ts): a search already answered
// this session shows its answer at once, with nothing asked again; and typing
// on from a search ("chick" to "chicken") narrows what's on screen to the
// foods that still match while the new answer is on its way.
// Nothing found offers the other ways in: AI Food Search and Quick Macro Entry.
export function FoodSearchScreen({ navigation, route }: Props) {
  const { session } = useAuth();
  const accessToken = session?.access_token;
  const [logging, setLogging] = useState(false);

  // Follows the existing Nutrition accent/theme system (the shared,
  // app-wide-unconditional default -- see useProgressTheme's own comment)
  // rather than introducing a new color.
  const { nutritionTheme: theme } = useProgressTheme();

  const [searchInput, setSearchInput] = useState(route.params?.query ?? '');
  const search = useDebouncedValue(searchInput.trim(), SEARCH_TYPING_PAUSE_MS);
  const [results, setResults] = useState<FoodSearchResult[]>([]);
  // The search the results on screen answer, and what it was put right to, if anything.
  const [shownFor, setShownFor] = useState<string | null>(null);
  const [correctedQuery, setCorrectedQuery] = useState<string | null>(null);
  const [selected, setSelected] = useState<FoodSearchResult | null>(null);
  const [loading, setLoading] = useState(false);
  // The quick answer is showing; the full one, with branded products, is still coming.
  const [findingMore, setFindingMore] = useState(false);
  // The quick answer came but the full one failed: the branded products are missing.
  const [productsFailed, setProductsFailed] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const latestSearch = useRef(0);
  // The search the rows on screen answer, for narrowing them as the next is typed.
  const shownForRef = useRef<string | null>(null);
  shownForRef.current = shownFor;

  // Another entry for a food, asked for from a food's page.
  const askedQuery = route.params?.query;
  useEffect(() => {
    if (!askedQuery) return;
    setSearchInput(askedQuery);
    setSelected(null);
    setLogging(false);
  }, [askedQuery]);

  const runSearch = useCallback(async () => {
    const searchId = ++latestSearch.current;
    const isLatest = () => searchId === latestSearch.current;
    setError(null);
    setProductsFailed(false);
    if (!search) {
      setResults([]);
      setShownFor(null);
      setCorrectedQuery(null);
      setLoading(false);
      setFindingMore(false);
      return;
    }
    if (!accessToken) return;
    const show = (response: FoodSearchResponse) => {
      setResults(response.foods);
      setCorrectedQuery(response.correctedQuery ?? null);
      setShownFor(search);
      setLoading(false);
    };
    // Answered already this session: shown at once, nothing asked again.
    const remembered = recallSearch(search);
    if (remembered?.full) {
      show(remembered.full);
      setLoading(false);
      setFindingMore(false);
      return;
    }
    setLoading(true);
    setFindingMore(true);
    // Meanwhile: the quick answer from before, or what's on screen narrowed to the new words.
    if (remembered?.quick) {
      show(remembered.quick);
    } else {
      setResults((shown) => narrowResults(shown, shownForRef.current, search));
    }

    let fullShown = false;
    let quickShown = false;
    const quick = searchFoods(accessToken, search, 0, 30, { branded: false })
      .then((response) => {
        rememberSearch(search, { quick: response });
        if (!isLatest() || fullShown) return;
        quickShown = true;
        show(response);
      })
      .catch(() => undefined);
    try {
      const response = await searchFoods(accessToken, search);
      rememberSearch(search, { full: response });
      if (!isLatest()) return;
      fullShown = true;
      show(response);
    } catch (err) {
      await quick;
      if (!isLatest()) return;
      if (quickShown) setProductsFailed(true);
      else setError(err instanceof Error ? err.message : 'Failed to search foods');
    } finally {
      if (isLatest()) {
        setLoading(false);
        setFindingMore(false);
      }
    }
  }, [search, accessToken]);

  useEffect(() => {
    void runSearch();
  }, [runSearch]);

  if (selected && logging) {
    const food = {
      id: selected.id,
      name: selected.name,
      servingSize: selected.servingSize,
      servingUnit: selected.servingUnit,
      servingLabel: selected.servingLabel,
      calories: selected.calories,
      // A macro the provider genuinely didn't report becomes 0 only
      // here, at the point of logging -- food_logs' own columns are
      // NOT NULL, so this is the one honest numeric default; the
      // detail view above still shows "—", never a fabricated 0.
      proteinG: selected.proteinG ?? 0,
      carbsG: selected.carbsG ?? 0,
      fatG: selected.fatG ?? 0,
      imageUrl: selected.imageUrl,
      provider: selected.provider,
    };
    return (
      <LogFoodStep
        food={food}
        showAttribution={selected.provider === 'open_food_facts'}
        accentColor={theme.accent}
        onAccentColor={theme.onAccent}
        day={route.params?.day}
        onDone={() => goToSection(navigation, 'Nutrition')}
        onCancel={() => setLogging(false)}
        onReportProblem={foodPageActions(navigation, food, route.params?.day).onReportProblem}
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
            servingLabel={selected.servingLabel}
            calories={selected.calories}
            proteinG={selected.proteinG}
            carbsG={selected.carbsG}
            fatG={selected.fatG}
            showAttribution={selected.provider === 'open_food_facts'}
            sourceText={foodSourceText({ provider: selected.provider })}
            accentColor={theme.accent}
            testIDs={{
              serving: 'food-search-detail-serving',
              calories: 'food-search-detail-calories',
              protein: 'food-search-detail-protein',
              carbs: 'food-search-detail-carbs',
              fat: 'food-search-detail-fat',
              attribution: 'food-search-detail-attribution',
              source: 'food-search-detail-source',
            }}
          />
          <FoodNutrients
            testID="food-search-detail-nutrients"
            foodId={selected.id}
            servings={1}
            accentColor={theme.accent}
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
            // Food search slides up as a short task (navigationTransitions.ts),
            // so it closes rather than going back.
            leftAction={{
              icon: 'x',
              onPress: () => navigation.goBack(),
              accessibilityLabel: 'Close',
              testID: 'food-search-close',
            }}
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
        ) : search === '' ? (
          <EmptyState
            testID="food-search-empty-initial"
            title="Search for a food to see its nutrition info"
          />
        ) : results.length === 0 && shownFor === search && !loading ? (
          <View testID="food-search-empty-results">
            <EmptyState
              title={`No foods found for "${search}"`}
              description="Try its plainest name, like “onion” or “chicken breast”."
            />
            {/* The other ways in, for a food no database has. */}
            <View style={styles.noResultsActions}>
              <SecondaryButton
                testID="food-search-try-ai"
                label="Describe It With AI"
                onPress={() => navigation.navigate('AiFoodSearch', { day: route.params?.day })}
              />
              <TextButton
                testID="food-search-enter-own"
                label="Enter the Figures Yourself"
                onPress={() => navigation.navigate('QuickFoodEntry', { day: route.params?.day })}
              />
            </View>
          </View>
        ) : results.length === 0 ? (
          <SkeletonRows testID="food-search-loading" count={6} />
        ) : (
          <>
            <SectionHeader label="Results" />
            {correctedQuery ? (
              <Text testID="food-search-corrected" style={styles.correctedText}>
                Showing results for “{correctedQuery}”
              </Text>
            ) : null}
            {results.map((food, index) => (
              <ListRow
                key={food.id}
                testID={`food-search-result-${food.id}`}
                leading={<FoodImage uri={food.imageUrl} name={food.name} size={44} />}
                title={food.name}
                subtitle={resultSubtitle(food)}
                value={`${wholeFigure(food.calories)} cal`}
                divider={index > 0}
                onPress={() => setSelected(food)}
              />
            ))}
            {findingMore ? (
              <View testID="food-search-finding-more" style={styles.footerRow}>
                <ActivityIndicator size="small" color={colors.textMuted} />
                <Text style={styles.footerText}>Looking for branded products…</Text>
              </View>
            ) : productsFailed ? (
              <View testID="food-search-products-failed" style={styles.footerRow}>
                <Text style={styles.footerText}>Branded products couldn&apos;t be loaded.</Text>
                <TextButton
                  testID="food-search-products-retry"
                  label="Try Again"
                  onPress={() => {
                    void runSearch();
                  }}
                />
              </View>
            ) : null}
          </>
        )}
      </AppCard>
    </Screen>
  );
}

/** "Brand · 30 g", or "USDA · 100 g" for a USDA reference food, so its source shows in the list. */
function resultSubtitle(food: FoodSearchResult): string {
  const serving = `${food.servingSize} ${food.servingUnit}`;
  if (food.brand) return `${food.brand} · ${serving}`;
  if (food.provider === 'usda_fdc') return `USDA · ${serving}`;
  return serving;
}
