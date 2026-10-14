import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { ActivityIndicator, SectionList, View, type SectionListData } from 'react-native';
import { Text } from '../design/Text';
import { Feather } from '@expo/vector-icons';
import { useAuth } from '../auth/AuthProvider';
import { AlphabetIndexRail } from '../design/AlphabetIndexRail';
import { AppCard } from '../design/AppCard';
import { AppHeader } from '../design/AppHeader';
import { TextButton } from '../design/Button';
import { EmptyState } from '../design/EmptyState';
import { ErrorState } from '../design/ErrorState';
import { IconButton } from '../design/IconButton';
import { ListRow } from '../design/ListRow';
import { Screen } from '../design/Screen';
import { SectionHeader } from '../design/SectionHeader';
import { TextInput } from '../design/TextInput';
import { colors } from '../design/theme';
import { useAppMenu } from '../navigation/AppMenuContext';
import type { RootStackScreenProps } from '../navigation/types';
import { goToSection } from '../navigation/sectionNavigation';
import { FoodImage } from '../nutrition/FoodImage';
import { ALPHABET_INDEX_LETTERS, groupFoodsByLetter } from '../nutrition/foodLibraryGrouping';
import { LogFoodStep } from '../nutrition/LogFoodStep';
import {
  fetchAllFoods,
  fetchRecentFoods,
  type FoodRow,
  type RecentFood,
} from '../nutrition/foodQueries';
import { useProgressTheme } from '../progress/useProgressTheme';
import { foodLibraryStyles as styles } from './foodLibraryStyles';
import { FoodFormScreen } from './FoodFormScreen';

const SEARCH_DEBOUNCE_MS = 300;

type Props = RootStackScreenProps<'FoodLibrary'>;

type Mode =
  | { type: 'list' }
  | { type: 'create'; initialBarcode?: string }
  | { type: 'edit'; food: FoodRow }
  | { type: 'log'; food: FoodRow; fromScan?: boolean; quantity?: number };

/** A heading's foods: Recent, or one letter of the library. */
interface LibrarySection {
  title: string;
  recent: boolean;
}

// The "Food" bottom-tab destination in Nutrition mode -- the user's own
// saved/custom foods, sorted and sectioned alphabetically (A-Z, like iOS
// Contacts) rather than the small paginated list this screen used to be,
// since a jump-to-letter index needs the whole set up front. Creating,
// editing, and logging a food are unchanged from before, just restyled.
//
// Layout: the shared header (menu left, "+" and a lightning bolt right --
// add a food by hand, or describe it and let AI Food Search estimate it --
// see AiFoodSearchScreen), then two widgets `widgetGap` apart: search with a
// count and a quiet sort action, and the foods -- each with its picture (or
// category glyph), name, serving and calories as a mono value -- under
// letter headings, with the A-Z rail on the right. Tapping a row logs it;
// the pencil edits it. Above the letters, while nothing is searched for, Recent
// lists the foods logged most recently -- from the user's own logs, so it also
// has foods logged from Search or a scan -- and tapping one opens the log step
// at last time's quantity, so re-logging takes two taps.
//
// Reached from the barcode scanner's "Enter Manually", it opens straight into
// the create form (barcode prefilled) and, once saved, on into logging that
// food -- so a scanned item nobody has a record of goes from unknown to
// logged in one pass.
export function FoodLibraryScreen({ navigation, route }: Props) {
  const { user } = useAuth();
  const userId = user?.id ?? '';
  const { openMenu } = useAppMenu();

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
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [activeLetter, setActiveLetter] = useState<string | undefined>(undefined);
  // Null until the first read finishes, so the list doesn't shift when Recent arrives.
  const [recentFoods, setRecentFoods] = useState<RecentFood[] | null>(null);
  const sectionListRef = useRef<SectionList<FoodRow, LibrarySection>>(null);

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
      const result = await fetchAllFoods({ userId, search, ascending });
      setRows(result);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to load foods');
    } finally {
      setLoading(false);
    }
  }, [userId, search, ascending]);

  useEffect(() => {
    void load();
  }, [load]);

  // Recent is a shortcut, so a failure only leaves it out.
  const loadRecent = useCallback(async () => {
    if (!userId) return;
    setRecentFoods(await fetchRecentFoods(userId).catch(() => []));
  }, [userId]);

  useEffect(() => {
    void loadRecent();
  }, [loadRecent]);

  function handleDone(saved?: FoodRow) {
    // A food entered by hand for a scanned barcode goes straight on to logging.
    if (saved && mode.type === 'create' && mode.initialBarcode) {
      setMode({ type: 'log', food: saved, fromScan: true });
    } else {
      setMode({ type: 'list' });
    }
    void load();
    // An edited or deactivated food must not be logged from Recent's older copy.
    void loadRecent();
  }

  const sections = useMemo(() => groupFoodsByLetter(rows), [rows]);
  const availableLetters = useMemo(
    () => new Set(sections.map((section) => section.letter)),
    [sections],
  );
  const listSections = useMemo(() => {
    const letters = sections.map((section) => ({
      title: section.letter,
      recent: false,
      data: section.data,
    }));
    if (search || !recentFoods || recentFoods.length === 0) return letters;
    return [
      { title: 'Recent', recent: true, data: recentFoods.map((entry) => entry.food) },
      ...letters,
    ];
  }, [sections, search, recentFoods]);

  const recentQuantities = useMemo(
    () => new Map((recentFoods ?? []).map((entry) => [entry.food.id, entry.quantity])),
    [recentFoods],
  );

  const jumpToLetter = useCallback(
    (letter: string) => {
      const sectionIndex = listSections.findIndex((section) => section.title === letter);
      if (sectionIndex === -1) return;
      setActiveLetter(letter);
      sectionListRef.current?.scrollToLocation({
        sectionIndex,
        itemIndex: 0,
        viewPosition: 0,
        animated: true,
      });
    },
    [listSections],
  );

  const renderSectionHeader = useCallback(
    ({ section }: { section: SectionListData<FoodRow, LibrarySection> }) => (
      <View testID={`food-library-section-${section.title}`}>
        <SectionHeader label={section.title} />
      </View>
    ),
    [],
  );

  const renderItem = useCallback(
    ({
      item,
      index,
      section,
    }: {
      item: FoodRow;
      index: number;
      section: SectionListData<FoodRow, LibrarySection>;
    }) => (
      <View style={[styles.row, index > 0 && styles.rowDivider]}>
        <View style={styles.flex}>
          <ListRow
            testID={section.recent ? `food-recent-${item.id}` : `food-item-${item.id}`}
            leading={<FoodImage uri={item.imageUrl} name={item.name} size={44} />}
            title={item.name}
            subtitle={`${item.servingSize}${item.servingUnit}`}
            value={`${item.calories} cal`}
            chevron={false}
            onPress={() =>
              setMode({
                type: 'log',
                food: item,
                quantity: section.recent ? recentQuantities.get(item.id) : undefined,
              })
            }
          />
        </View>
        {/* A recent food can come from Search, which isn't the user's to edit. */}
        {section.recent ? null : (
          <IconButton
            testID={`food-edit-${item.id}`}
            icon="edit-2"
            onPress={() => setMode({ type: 'edit', food: item })}
            accessibilityLabel={`Edit ${item.name}`}
            color={colors.textSecondary}
          />
        )}
      </View>
    ),
    [recentQuantities],
  );

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
        accentColor={theme.accent}
        onAccentColor={theme.onAccent}
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
            onPress: () => setMode({ type: 'create' }),
            accessibilityLabel: 'Add a new food',
            testID: 'food-create-button',
          }}
          rightAction2={{
            icon: 'zap',
            onPress: () => navigation.navigate('AiFoodSearch'),
            accessibilityLabel: 'AI Food Search',
            testID: 'food-library-ai-search',
          }}
        />
      }
    >
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
          ) : loading || recentFoods === null ? (
            <View style={styles.loading}>
              <ActivityIndicator
                testID="food-library-loading"
                size="large"
                color={colors.textPrimary}
              />
            </View>
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
                ref={sectionListRef}
                testID="food-library-list"
                sections={listSections}
                keyExtractor={(item) => item.id}
                contentContainerStyle={styles.listContent}
                keyboardShouldPersistTaps="handled"
                showsVerticalScrollIndicator={false}
                renderSectionHeader={renderSectionHeader}
                renderItem={renderItem}
                onScrollToIndexFailed={() => {
                  // A section can be shorter than the viewport at the very end
                  // of the list; retry is unnecessary since scrollToLocation
                  // already handles this internally on modern RN -- this is
                  // just a safety net against the dev-only warning.
                }}
              />
              <View style={styles.indexRailWrap} pointerEvents="box-none">
                <AlphabetIndexRail
                  testID="food-library-index"
                  letters={ALPHABET_INDEX_LETTERS}
                  availableLetters={availableLetters}
                  activeLetter={activeLetter}
                  onSelect={jumpToLetter}
                  accentColor={theme.accent}
                />
              </View>
            </View>
          )}
        </AppCard>
      </View>
    </Screen>
  );
}
