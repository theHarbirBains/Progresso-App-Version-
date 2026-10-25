import { useCallback, useEffect, useMemo, useState } from 'react';
import {
  ActivityIndicator,
  SectionList,
  StyleSheet,
  View,
  type SectionListData,
} from 'react-native';
import { Feather } from '@expo/vector-icons';
import { useAuth } from '../auth/AuthProvider';
import { AppCard } from '../design/AppCard';
import { AppHeader } from '../design/AppHeader';
import { EmptyState } from '../design/EmptyState';
import { ListRow } from '../design/ListRow';
import { Screen } from '../design/Screen';
import { SectionHeader } from '../design/SectionHeader';
import { Text } from '../design/Text';
import { TextInput } from '../design/TextInput';
import { colors, spacing, typeScale, widgetGap } from '../design/theme';
import { searchFoods } from '../lib/foodsApi';
import { FoodImage } from './FoodImage';
import { fetchAllFoods, fetchRecentFoods, type FoodRow } from './foodQueries';
import { SkeletonRows } from '../design/Skeleton';

const SEARCH_DEBOUNCE_MS = 300;
// Recent here is a wider net than the Food Library's: it's where foods from Search live.
const RECENT_LIMIT = 20;
/** Searching every food starts at this many letters. */
const MIN_SEARCH_LENGTH = 2;

interface PickerSection {
  title: string;
  key: string;
}

interface Props {
  /** "Add Food" or "Add Ingredient". */
  title: string;
  /** A recipe being edited: it can't be one of its own ingredients. */
  excludeId?: string;
  onPick: (food: FoodRow) => void;
  onCancel: () => void;
}

function matches(food: FoodRow, query: string): boolean {
  return food.name.toLowerCase().includes(query.toLowerCase());
}

/**
 * Picks a food for a saved meal or a recipe: the user's own foods and recipes, the foods they
 * logged recently (which is where foods from Search or a scan are), and -- once two letters are
 * typed -- every food, through Food Search. Not a route; the builder renders it in its place.
 */
export function FoodPickerStep({ title, excludeId, onPick, onCancel }: Props) {
  const { user, session } = useAuth();
  const userId = user?.id ?? '';
  const accessToken = session?.access_token;
  const [own, setOwn] = useState<FoodRow[] | null>(null);
  const [recent, setRecent] = useState<FoodRow[]>([]);
  const [searchInput, setSearchInput] = useState('');
  const [search, setSearch] = useState('');
  const [results, setResults] = useState<FoodRow[]>([]);
  const [searching, setSearching] = useState(false);
  const [searchError, setSearchError] = useState<string | null>(null);

  useEffect(() => {
    const timer = setTimeout(() => setSearch(searchInput.trim()), SEARCH_DEBOUNCE_MS);
    return () => clearTimeout(timer);
  }, [searchInput]);

  useEffect(() => {
    if (!userId) return;
    let cancelled = false;
    void Promise.all([
      fetchAllFoods({ userId, search: '', ascending: true }).catch(() => []),
      fetchRecentFoods(userId, RECENT_LIMIT).catch(() => []),
    ]).then(([foods, recentFoods]) => {
      if (cancelled) return;
      setOwn(foods);
      setRecent(recentFoods.map((entry) => entry.food));
    });
    return () => {
      cancelled = true;
    };
  }, [userId]);

  const runSearch = useCallback(async () => {
    if (search.length < MIN_SEARCH_LENGTH || !accessToken) {
      setResults([]);
      setSearchError(null);
      return;
    }
    setSearching(true);
    setSearchError(null);
    try {
      const response = await searchFoods(accessToken, search);
      setResults(
        response.foods.map((food) => ({
          id: food.id,
          name: food.name,
          brand: food.brand,
          barcode: food.barcode,
          imageUrl: food.imageUrl,
          servingSize: food.servingSize,
          servingUnit: food.servingUnit,
          servingLabel: food.servingLabel ?? null,
          calories: food.calories,
          // A macro the provider didn't report counts as 0 once it's added -- the same as
          // logging it from Search does.
          proteinG: food.proteinG ?? 0,
          carbsG: food.carbsG ?? 0,
          fatG: food.fatG ?? 0,
          isActive: true,
          provenance: null,
        })),
      );
    } catch (err) {
      setSearchError(err instanceof Error ? err.message : 'Failed to search foods');
    } finally {
      setSearching(false);
    }
  }, [search, accessToken]);

  useEffect(() => {
    void runSearch();
  }, [runSearch]);

  const sections = useMemo(() => {
    const shown = new Set<string>(excludeId ? [excludeId] : []);
    const take = (foods: FoodRow[]) =>
      foods.filter((food) => {
        if (shown.has(food.id) || (search && !matches(food, search))) return false;
        shown.add(food.id);
        return true;
      });
    const yours = take(own ?? []);
    const recentFoods = take(recent);
    // Search results are matched by the search itself, not by name.
    const all = results.filter((food) => !shown.has(food.id));
    return [
      { title: 'Your Foods', key: 'own', data: yours },
      { title: 'Recent', key: 'recent', data: recentFoods },
      { title: 'All Foods', key: 'all', data: all },
    ].filter((section) => section.data.length > 0);
  }, [own, recent, results, search, excludeId]);

  const renderItem = useCallback(
    ({
      item,
      index,
      section,
    }: {
      item: FoodRow;
      index: number;
      section: SectionListData<FoodRow, PickerSection>;
    }) => (
      <ListRow
        testID={`food-picker-${section.key}-${item.id}`}
        leading={<FoodImage uri={item.imageUrl} name={item.name} size={44} />}
        title={item.name}
        subtitle={
          item.recipeServings
            ? 'Recipe'
            : [item.brand, `${item.servingSize}${item.servingUnit}`].filter(Boolean).join(' · ')
        }
        value={`${Math.round(item.calories)} cal`}
        chevron={false}
        divider={index > 0}
        onPress={() => onPick(item)}
      />
    ),
    [onPick],
  );

  return (
    <Screen
      scroll={false}
      padded={false}
      testID="food-picker"
      header={
        <AppHeader
          title={title}
          leftAction={{
            icon: 'x',
            onPress: onCancel,
            accessibilityLabel: 'Cancel',
            testID: 'food-picker-cancel',
          }}
        />
      }
    >
      <View style={styles.page}>
        <AppCard>
          <TextInput
            testID="food-picker-search"
            placeholder="Search foods..."
            value={searchInput}
            onChangeText={setSearchInput}
            autoCapitalize="none"
            leftAccessory={<Feather name="search" size={16} color={colors.textMuted} />}
          />
        </AppCard>

        <AppCard style={styles.listCard}>
          {own === null ? (
            <SkeletonRows testID="food-picker-loading" count={5} />
          ) : sections.length === 0 && !searching ? (
            <EmptyState
              testID="food-picker-empty"
              title={search ? `No foods found for "${search}"` : 'Search for a food to add'}
            />
          ) : (
            <SectionList
              testID="food-picker-list"
              sections={sections}
              keyExtractor={(item) => item.id}
              keyboardShouldPersistTaps="handled"
              showsVerticalScrollIndicator={false}
              stickySectionHeadersEnabled={false}
              renderSectionHeader={({ section }) => (
                <View style={section.key === sections[0]?.key ? undefined : styles.laterSection}>
                  <SectionHeader label={section.title} />
                </View>
              )}
              renderItem={renderItem}
              ListFooterComponent={
                searching ? (
                  <ActivityIndicator
                    testID="food-picker-searching"
                    style={styles.footer}
                    color={colors.textMuted}
                  />
                ) : searchError ? (
                  <Text testID="food-picker-search-error" style={styles.error}>
                    {searchError}
                  </Text>
                ) : null
              }
            />
          )}
        </AppCard>
      </View>
    </Screen>
  );
}

const styles = StyleSheet.create({
  // Edge-to-edge widgets, like the Food Library this opens from.
  page: {
    flex: 1,
    gap: widgetGap,
    paddingBottom: spacing.lg,
  },
  listCard: {
    flex: 1,
  },
  laterSection: {
    paddingTop: spacing.lg,
  },
  footer: {
    marginTop: spacing.md,
  },
  error: {
    ...typeScale.callout,
    color: colors.destructive,
    marginTop: spacing.md,
  },
});
