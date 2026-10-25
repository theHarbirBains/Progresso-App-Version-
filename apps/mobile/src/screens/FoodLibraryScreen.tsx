import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { Alert, ScrollView, SectionList, View, type SectionListData } from 'react-native';
import { Text } from '../design/Text';
import { Feather } from '@expo/vector-icons';
import { useAuth } from '../auth/AuthProvider';
import { AppCard } from '../design/AppCard';
import { AppHeader } from '../design/AppHeader';
import { BottomSheet } from '../design/BottomSheet';
import { BubbleMenu, BubbleMenuRow } from '../design/BubbleMenu';
import { PrimaryButton, SecondaryButton, TextButton } from '../design/Button';
import { EmptyState } from '../design/EmptyState';
import { ErrorState } from '../design/ErrorState';
import { IconButton } from '../design/IconButton';
import { ListRow } from '../design/ListRow';
import { Screen } from '../design/Screen';
import { SectionHeader } from '../design/SectionHeader';
import { SwipeToDelete } from '../design/SwipeToDelete';
import { TextInput } from '../design/TextInput';
import { colors } from '../design/theme';
import { useAppMenu } from '../navigation/AppMenuContext';
import type { RootStackScreenProps } from '../navigation/types';
import { goToSection } from '../navigation/sectionNavigation';
import { FoodImage } from '../nutrition/FoodImage';
import { groupTotals, itemAmountText } from '../nutrition/foodGroups';
import { groupFoodsByLetter } from '../nutrition/foodLibraryGrouping';
import type { EnteredAmount } from '../nutrition/foodLogQueries';
import { useFoodLog } from '../nutrition/FoodLogProvider';
import { LogFoodStep } from '../nutrition/LogFoodStep';
import { defaultMealTypeForTime } from '../nutrition/mealTypes';
import {
  fetchAllFoods,
  fetchRecentFoods,
  fetchUsualFoods,
  updateFood,
  type FoodRow,
  type RecentFood,
} from '../nutrition/foodQueries';
import { deleteSavedMeal, fetchSavedMeals, type SavedMeal } from '../nutrition/savedMealQueries';
import { useProgressTheme } from '../progress/useProgressTheme';
import { foodLibraryStyles as styles } from './foodLibraryStyles';
import { FoodFormScreen } from './FoodFormScreen';
import { FoodGroupFormScreen } from './FoodGroupFormScreen';
import { SkeletonRows } from '../design/Skeleton';
import { wholeFigure } from '../nutrition/wholeFigures';

const SEARCH_DEBOUNCE_MS = 300;
const RECENT_LIMIT = 8;
const USUAL_LIMIT = 6;

type Props = RootStackScreenProps<'FoodLibrary'>;

type Mode =
  | { type: 'list' }
  | { type: 'create'; initialBarcode?: string }
  | { type: 'edit'; food: FoodRow }
  | {
      type: 'log';
      food: FoodRow;
      fromScan?: boolean;
      quantity?: number;
      entered?: EnteredAmount | null;
    }
  | { type: 'meal-form'; meal?: SavedMeal }
  | { type: 'recipe-form'; recipe?: FoodRow };

/** A row: a saved meal, or a food -- with last time's amount when it's in Usual or Recent. */
type LibraryItem =
  | { kind: 'meal'; id: string; meal: SavedMeal }
  | { kind: 'food'; id: string; food: FoodRow; last?: RecentFood };

/** A heading's rows: Saved Meals, Usual, Recent, or one letter of the library. */
interface LibrarySection {
  title: string;
  kind: 'meals' | 'usual' | 'recent' | 'letter';
  /** The list's own key for the section -- each one's own, a letter's included ("letter-A"). */
  key: string;
}

/** The shortcuts above the letters: each is only a shortcut, so a failure only leaves it out. */
interface Shortcuts {
  usual: RecentFood[];
  recent: RecentFood[];
}

function foodSubtitle(food: FoodRow): string {
  return food.recipeServings ? 'Recipe · 1 serving' : `${food.servingSize}${food.servingUnit}`;
}

// The "Food" bottom-tab destination in Nutrition mode -- the user's own
// saved/custom foods, sorted and sectioned alphabetically, read in one go
// rather than the small paginated list this screen used to be. Creating,
// editing, and logging a food are unchanged from before, just restyled.
//
// Layout: the shared header (menu left, "+" and a lightning bolt right --
// "+" opens a small menu to add a food by hand, a recipe or a saved meal; the
// bolt describes a food and lets AI Food Search estimate it -- see
// AiFoodSearchScreen), then two widgets `widgetGap` apart: search with a
// count and a quiet sort action, and the foods -- each with its picture (or
// category glyph), name, serving and calories as a mono value -- under
// a small letter heading for each letter that has any (no A-Z rail -- a
// letter with no foods has no heading at all). Tapping a row logs it;
// the pencil edits it (a recipe opens its recipe form); swiping it left shows
// Delete, which asks first -- a food or recipe is deactivated, never removed,
// so everything logged from it keeps its figures. Above the letters:
// Saved Meals (tap one to see its foods and log them all, or edit it); then,
// while nothing is searched for, Usual -- the foods logged on the most
// different days lately -- and Recent, the foods logged most recently that
// aren't already in Usual -- both from the user's own logs, so they also have
// foods logged from Search or a scan -- and tapping one opens the log step
// at last time's amount, so re-logging takes two taps.
//
// Reached from the barcode scanner's "Enter Manually", it opens straight into
// the create form (barcode prefilled) and, once saved, on into logging that
// food -- so a scanned item nobody has a record of goes from unknown to
// logged in one pass.
export function FoodLibraryScreen({ navigation, route }: Props) {
  const { user } = useAuth();
  const userId = user?.id ?? '';
  const { openMenu } = useAppMenu();
  const { logFoodEntries } = useFoodLog();

  const { nutritionTheme: theme } = useProgressTheme();
  // Opens straight into "create a custom food" when reached from the Scan
  // Barcode flow's "Product not found" fallback (see BarcodeScannerScreen),
  // prefilled with the barcode that had no match -- the user never has to
  // re-type or re-scan it.
  const [mode, setMode] = useState<Mode>(
    route.params?.openCreate
      ? { type: 'create', initialBarcode: route.params.barcode }
      : { type: 'list' },
  );
  const [searchInput, setSearchInput] = useState('');
  const [search, setSearch] = useState('');
  const [ascending, setAscending] = useState(true);
  const [rows, setRows] = useState<FoodRow[]>([]);
  const [meals, setMeals] = useState<SavedMeal[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  // Null until the first read finishes, so the list doesn't shift when Usual and Recent arrive.
  const [shortcuts, setShortcuts] = useState<Shortcuts | null>(null);
  const [addMenuOpen, setAddMenuOpen] = useState(false);
  const [openMeal, setOpenMeal] = useState<SavedMeal | null>(null);
  const [loggingMeal, setLoggingMeal] = useState(false);
  const [mealError, setMealError] = useState<string | null>(null);

  // Debounce free-text input before it drives a query, so every keystroke
  // doesn't fire its own request -- same pattern as FoodSearchScreen.
  useEffect(() => {
    const timer = setTimeout(() => setSearch(searchInput), SEARCH_DEBOUNCE_MS);
    return () => clearTimeout(timer);
  }, [searchInput]);

  const load = useCallback(async () => {
    if (!userId) return;
    setLoading(true);
    setError(null);
    try {
      // Saved meals are the user's own, like their foods -- not a shortcut that can quietly go.
      const [foods, savedMeals] = await Promise.all([
        fetchAllFoods({ userId, search, ascending }),
        fetchSavedMeals(userId),
      ]);
      setRows(foods);
      setMeals(savedMeals);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to load foods');
    } finally {
      setLoading(false);
    }
  }, [userId, search, ascending]);

  useEffect(() => {
    void load();
  }, [load]);

  const loadShortcuts = useCallback(async () => {
    if (!userId) return;
    const [usual, recent] = await Promise.all([
      fetchUsualFoods(userId, USUAL_LIMIT).catch(() => []),
      // Enough that Recent still has its eight once Usual's foods are taken out.
      fetchRecentFoods(userId, RECENT_LIMIT + USUAL_LIMIT).catch(() => []),
    ]);
    const inUsual = new Set(usual.map((entry) => entry.food.id));
    setShortcuts({
      usual,
      recent: recent.filter((entry) => !inUsual.has(entry.food.id)).slice(0, RECENT_LIMIT),
    });
  }, [userId]);

  useEffect(() => {
    void loadShortcuts();
  }, [loadShortcuts]);

  function handleDone(saved?: FoodRow) {
    // A food entered by hand for a scanned barcode goes straight on to logging.
    if (saved && mode.type === 'create' && mode.initialBarcode) {
      setMode({ type: 'log', food: saved, fromScan: true });
    } else {
      setMode({ type: 'list' });
    }
    void load();
    // An edited or deactivated food must not be logged from Usual's or Recent's older copy.
    void loadShortcuts();
  }

  // Each of the meal's foods as its own entry, at the food's figures now. A food that has
  // left the library since is skipped.
  async function handleLogMeal(meal: SavedMeal) {
    const items = meal.items.filter((item) => item.food.isActive);
    if (items.length === 0) return;
    setMealError(null);
    setLoggingMeal(true);
    try {
      await logFoodEntries(
        items.map((item) => ({ food: item.food, quantity: item.quantity, entered: item.entered })),
        defaultMealTypeForTime(),
        route.params?.day,
      );
      setOpenMeal(null);
      goToSection(navigation, 'Nutrition');
    } catch (err) {
      setMealError(err instanceof Error ? err.message : 'Failed to log meal');
    } finally {
      setLoggingMeal(false);
    }
  }

  // The one row showing Delete, if any; and whether a row is being swiped, when the list holds
  // its scroll still.
  const [swipeOpenId, setSwipeOpenId] = useState<string | null>(null);
  const [rowSwiping, setRowSwiping] = useState(false);
  const loadShortcutsRef = useRef(loadShortcuts);
  loadShortcutsRef.current = loadShortcuts;

  // Deleting from the list asks first. A food or recipe is deactivated (as the form's
  // Deactivate does), so it leaves the library but every log keeps its figures; a saved meal is
  // removed, and its foods stay.
  const requestDelete = useCallback((item: LibraryItem) => {
    const isMeal = item.kind === 'meal';
    const name = isMeal ? item.meal.name : item.food.name;
    async function remove() {
      try {
        if (item.kind === 'meal') {
          await deleteSavedMeal(item.meal.id);
          setMeals((prev) => prev.filter((meal) => meal.id !== item.meal.id));
        } else {
          await updateFood(item.food.id, { isActive: false });
          setRows((prev) => prev.filter((food) => food.id !== item.food.id));
          // A deleted food mustn't stay in Usual or Recent.
          void loadShortcutsRef.current();
        }
        setSwipeOpenId(null);
      } catch (err) {
        Alert.alert(
          `Couldn't delete ${name}`,
          err instanceof Error ? err.message : 'Please try again.',
        );
      }
    }
    Alert.alert(
      `Delete ${name}?`,
      isMeal
        ? "It leaves your Food Library. Its foods stay, and anything you've logged keeps its figures."
        : "It leaves your Food Library. Anything you've logged keeps its figures.",
      [
        { text: 'Cancel', style: 'cancel', onPress: () => setSwipeOpenId(null) },
        { text: 'Delete', style: 'destructive', onPress: () => void remove() },
      ],
    );
  }, []);

  // Only letters that have foods -- groupFoodsByLetter makes no empty sections.
  const sections = useMemo(() => groupFoodsByLetter(rows), [rows]);
  // The user's own foods: the library itself (Usual and Recent show only when it's unsearched,
  // so it's all of them then).
  const ownFoodIds = useMemo(() => new Set(rows.map((food) => food.id)), [rows]);
  const listSections = useMemo(() => {
    const letters = sections.map((section) => ({
      title: section.letter,
      kind: 'letter' as const,
      key: `letter-${section.letter}`,
      data: section.data.map((food): LibraryItem => ({ kind: 'food', id: food.id, food })),
    }));
    const query = search.trim().toLowerCase();
    const shownMeals = query
      ? meals.filter((meal) => meal.name.toLowerCase().includes(query))
      : meals;
    const mealSection =
      shownMeals.length > 0
        ? [
            {
              title: 'Saved Meals',
              kind: 'meals' as const,
              key: 'meals',
              data: shownMeals.map((meal): LibraryItem => ({ kind: 'meal', id: meal.id, meal })),
            },
          ]
        : [];
    if (search || !shortcuts) return [...mealSection, ...letters];
    const shortcut = (title: string, key: 'usual' | 'recent', entries: RecentFood[]) =>
      entries.length > 0
        ? [
            {
              title,
              kind: key,
              key,
              data: entries.map((entry): LibraryItem => ({
                kind: 'food',
                id: entry.food.id,
                food: entry.food,
                last: entry,
              })),
            },
          ]
        : [];
    return [
      ...mealSection,
      ...shortcut('Usual', 'usual', shortcuts.usual),
      ...shortcut('Recent', 'recent', shortcuts.recent),
      ...letters,
    ];
  }, [sections, search, shortcuts, meals]);

  // A small heading over each group; every one after the first has room above it, so
  // the groups read apart.
  const firstTitle = listSections[0]?.title;
  const renderSectionHeader = useCallback(
    ({ section }: { section: SectionListData<LibraryItem, LibrarySection> }) => (
      <View
        testID={`food-library-section-${section.title}`}
        style={section.title === firstTitle ? undefined : styles.laterSection}
      >
        <SectionHeader label={section.title} />
      </View>
    ),
    [firstTitle],
  );

  const renderItem = useCallback(
    ({
      item,
      index,
      section,
    }: {
      item: LibraryItem;
      index: number;
      section: SectionListData<LibraryItem, LibrarySection>;
    }) => {
      if (item.kind === 'meal') {
        const { meal } = item;
        const count = meal.items.length;
        const calories = wholeFigure(
          groupTotals(meal.items.filter((entry) => entry.food.isActive)).calories,
        );
        return (
          <SwipeToDelete
            testID={`food-meal-swipe-${meal.id}`}
            style={index > 0 && styles.rowDivider}
            name={meal.name}
            open={swipeOpenId === `meal-${meal.id}`}
            onOpenChange={(open) => setSwipeOpenId(open ? `meal-${meal.id}` : null)}
            onSwipingChange={setRowSwiping}
            onDelete={() => requestDelete(item)}
          >
            <View style={styles.row}>
              <View style={styles.flex}>
                <ListRow
                  testID={`food-meal-${meal.id}`}
                  leading={<FoodImage uri={null} name={meal.name} size={44} />}
                  title={meal.name}
                  subtitle={`${count} ${count === 1 ? 'food' : 'foods'}`}
                  value={`${calories} cal`}
                  chevron={false}
                  onPress={() => {
                    setMealError(null);
                    setOpenMeal(meal);
                  }}
                  accessibilityActions={[{ name: 'delete', label: 'Delete' }]}
                  onAccessibilityAction={(event) => {
                    if (event.nativeEvent.actionName === 'delete') requestDelete(item);
                  }}
                />
              </View>
            </View>
          </SwipeToDelete>
        );
      }
      const { food, last } = item;
      const shortcut = section.kind === 'usual' || section.kind === 'recent';
      // A usual or recent food can come from Search, which isn't the user's to delete: only one
      // of their own -- in the library below -- swipes to Delete there.
      const deletable = !shortcut || ownFoodIds.has(food.id);
      const swipeId = `${section.kind}-food-${food.id}`;
      const row = (
        <View style={[styles.row, !deletable && index > 0 && styles.rowDivider]}>
          <View style={styles.flex}>
            <ListRow
              testID={shortcut ? `food-${section.kind}-${food.id}` : `food-item-${food.id}`}
              leading={<FoodImage uri={food.imageUrl} name={food.name} size={44} />}
              title={food.name}
              subtitle={foodSubtitle(food)}
              value={`${wholeFigure(food.calories)} cal`}
              chevron={false}
              onPress={() =>
                setMode({
                  type: 'log',
                  food,
                  quantity: last?.quantity,
                  entered: last?.entered ?? null,
                })
              }
              accessibilityActions={deletable ? [{ name: 'delete', label: 'Delete' }] : undefined}
              onAccessibilityAction={(event) => {
                if (deletable && event.nativeEvent.actionName === 'delete') requestDelete(item);
              }}
            />
          </View>
          {/* A usual or recent food can come from Search, which isn't the user's to edit. */}
          {shortcut ? null : (
            <IconButton
              testID={`food-edit-${food.id}`}
              icon="edit-2"
              onPress={() =>
                setMode(
                  food.recipeServings
                    ? { type: 'recipe-form', recipe: food }
                    : { type: 'edit', food },
                )
              }
              accessibilityLabel={`Edit ${food.name}`}
              color={colors.textSecondary}
            />
          )}
        </View>
      );
      if (!deletable) return row;
      return (
        <SwipeToDelete
          testID={shortcut ? `food-${section.kind}-swipe-${food.id}` : `food-swipe-${food.id}`}
          style={index > 0 && styles.rowDivider}
          name={food.name}
          open={swipeOpenId === swipeId}
          onOpenChange={(open) => setSwipeOpenId(open ? swipeId : null)}
          onSwipingChange={setRowSwiping}
          onDelete={() => requestDelete(item)}
        >
          {row}
        </SwipeToDelete>
      );
    },
    [swipeOpenId, requestDelete, ownFoodIds],
  );

  if (mode.type === 'meal-form' || mode.type === 'recipe-form') {
    const shared = {
      accentColor: theme.accent,
      onAccentColor: theme.onAccent,
      onDone: () => handleDone(),
      onCancel: () => setMode({ type: 'list' }),
    };
    return mode.type === 'meal-form' ? (
      <FoodGroupFormScreen kind="meal" meal={mode.meal} {...shared} />
    ) : (
      <FoodGroupFormScreen kind="recipe" recipe={mode.recipe} {...shared} />
    );
  }

  if (mode.type === 'create') {
    return (
      <FoodFormScreen
        mode="create"
        initialBarcode={mode.initialBarcode}
        onDone={handleDone}
        onCancel={() => setMode({ type: 'list' })}
        accentColor={theme.accent}
        onAccentColor={theme.onAccent}
      />
    );
  }

  if (mode.type === 'edit') {
    return (
      <FoodFormScreen
        mode="edit"
        food={mode.food}
        onDone={handleDone}
        onCancel={() => setMode({ type: 'list' })}
        accentColor={theme.accent}
        onAccentColor={theme.onAccent}
      />
    );
  }

  if (mode.type === 'log') {
    return (
      <LogFoodStep
        food={mode.food}
        initialQuantity={mode.quantity}
        initialEntry={mode.entered}
        accentColor={theme.accent}
        onAccentColor={theme.onAccent}
        day={route.params?.day}
        onDone={() => (mode.fromScan ? goToSection(navigation, 'Nutrition') : navigation.goBack())}
        onCancel={() => setMode({ type: 'list' })}
      />
    );
  }

  return (
    <Screen
      scroll={false}
      padded={false}
      testID="food-library-screen"
      header={
        <AppHeader
          testID="food-library-header"
          title="Food Library"
          leftAction={{
            icon: 'menu',
            onPress: () => openMenu(),
            accessibilityLabel: 'Open menu',
            testID: 'food-library-open-menu',
          }}
          rightAction={{
            icon: 'plus',
            onPress: () => setAddMenuOpen(true),
            accessibilityLabel: 'Add a food, recipe or meal',
            testID: 'food-create-button',
          }}
          rightAction2={{
            icon: 'zap',
            onPress: () => navigation.navigate('AiFoodSearch', { day: route.params?.day }),
            accessibilityLabel: 'AI Food Search',
            testID: 'food-library-ai-search',
          }}
        />
      }
    >
      <BubbleMenu
        testID="food-library-add-menu"
        visible={addMenuOpen}
        onClose={() => setAddMenuOpen(false)}
      >
        <BubbleMenuRow
          testID="food-library-add-food"
          icon="plus-circle"
          label="New Food"
          onPress={() => {
            setAddMenuOpen(false);
            setMode({ type: 'create' });
          }}
        />
        <BubbleMenuRow
          testID="food-library-add-recipe"
          icon="book-open"
          label="New Recipe"
          onPress={() => {
            setAddMenuOpen(false);
            setMode({ type: 'recipe-form' });
          }}
        />
        <BubbleMenuRow
          testID="food-library-add-meal"
          icon="layers"
          label="New Meal"
          onPress={() => {
            setAddMenuOpen(false);
            setMode({ type: 'meal-form' });
          }}
        />
      </BubbleMenu>

      <BottomSheet
        testID="food-meal-sheet"
        visible={openMeal !== null}
        onClose={() => setOpenMeal(null)}
      >
        {openMeal ? (
          <View style={styles.sheetContent}>
            <Text testID="food-meal-sheet-title" style={styles.sheetTitle}>
              {openMeal.name}
            </Text>
            <Text testID="food-meal-sheet-summary" style={styles.sheetSummary}>
              {(() => {
                const active = openMeal.items.filter((entry) => entry.food.isActive);
                const calories = wholeFigure(groupTotals(active).calories);
                return `${active.length} ${active.length === 1 ? 'food' : 'foods'} · ${calories} cal`;
              })()}
            </Text>
            <ScrollView style={styles.sheetList} showsVerticalScrollIndicator={false}>
              {openMeal.items.map((entry, i) => (
                <ListRow
                  key={`${entry.food.id}-${i}`}
                  testID={`food-meal-sheet-item-${i}`}
                  leading={<FoodImage uri={entry.food.imageUrl} name={entry.food.name} size={44} />}
                  title={entry.food.name}
                  subtitle={
                    entry.food.isActive
                      ? itemAmountText(entry)
                      : "No longer in your library, so it isn't logged"
                  }
                  divider={i > 0}
                />
              ))}
            </ScrollView>
            {mealError ? (
              <Text testID="food-meal-sheet-error" style={styles.sheetError}>
                {mealError}
              </Text>
            ) : null}
            <PrimaryButton
              testID="food-meal-log"
              label="Log Meal"
              onPress={() => void handleLogMeal(openMeal)}
              loading={loggingMeal}
              disabled={!openMeal.items.some((entry) => entry.food.isActive) && !loggingMeal}
              accentColor={theme.accent}
              onAccentColor={theme.onAccent}
            />
            <SecondaryButton
              testID="food-meal-edit"
              label="Edit Meal"
              disabled={loggingMeal}
              onPress={() => {
                const meal = openMeal;
                setOpenMeal(null);
                setMode({ type: 'meal-form', meal });
              }}
            />
          </View>
        ) : null}
      </BottomSheet>

      <View style={styles.page}>
        <AppCard testID="food-library-controls">
          <View style={styles.block}>
            <TextInput
              testID="food-search"
              placeholder="Search your food library..."
              value={searchInput}
              onChangeText={setSearchInput}
              autoCapitalize="none"
              leftAccessory={<Feather name="search" size={16} color={colors.textMuted} />}
            />
          </View>

          <View style={styles.countRow}>
            <Text testID="food-library-count" style={styles.countText}>
              {rows.length} {rows.length === 1 ? 'food' : 'foods'} saved
            </Text>
            <TextButton
              testID="food-library-sort"
              label={`Sort ${ascending ? 'A → Z' : 'Z → A'}`}
              accessibilityLabel="Toggle sort order"
              onPress={() => setAscending((prev) => !prev)}
            />
          </View>
        </AppCard>

        <AppCard testID="food-library-list-card" style={styles.listCard}>
          {error ? (
            <View>
              <ErrorState
                testID="food-library-error"
                message={error}
                onRetry={() => {
                  void load();
                }}
              />
            </View>
          ) : loading || shortcuts === null ? (
            <SkeletonRows testID="food-library-loading" count={8} />
          ) : listSections.length === 0 ? (
            <View>
              <EmptyState
                testID="food-library-empty"
                title={search ? `No foods found for "${search}"` : 'No foods yet'}
                action={
                  search
                    ? undefined
                    : {
                        label: 'Create a food',
                        onPress: () => setMode({ type: 'create' }),
                        testID: 'food-empty-create',
                      }
                }
              />
            </View>
          ) : (
            <View style={styles.flex}>
              <SectionList
                testID="food-library-list"
                sections={listSections}
                keyExtractor={(item) => `${item.kind}-${item.id}`}
                keyboardShouldPersistTaps="handled"
                scrollEnabled={!rowSwiping}
                showsVerticalScrollIndicator={false}
                renderSectionHeader={renderSectionHeader}
                renderItem={renderItem}
                // The headings scroll with their foods: pinned, a see-through
                // heading would sit on top of the rows passing under it.
                stickySectionHeadersEnabled={false}
              />
            </View>
          )}
        </AppCard>
      </View>
    </Screen>
  );
}
