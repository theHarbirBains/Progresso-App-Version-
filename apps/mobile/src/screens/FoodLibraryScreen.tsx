import { useCallback, useEffect, useRef, useState } from 'react';
import { ActivityIndicator, SectionList, View } from 'react-native';
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
import { FoodImage } from '../nutrition/FoodImage';
import { ALPHABET_INDEX_LETTERS, groupFoodsByLetter } from '../nutrition/foodLibraryGrouping';
import { LogFoodStep } from '../nutrition/LogFoodStep';
import { fetchAllFoods, type FoodRow } from '../nutrition/foodQueries';
import { useProgressTheme } from '../progress/useProgressTheme';
import { foodLibraryStyles as styles } from './foodLibraryStyles';
import { FoodFormScreen } from './FoodFormScreen';

const SEARCH_DEBOUNCE_MS = 300;

type Props = RootStackScreenProps<'FoodLibrary'>;

type Mode =
  | { type: 'list' }
  | { type: 'create'; initialBarcode?: string }
  | { type: 'edit'; food: FoodRow }
  | { type: 'log'; food: FoodRow; fromScan?: boolean };

// The "Food" bottom-tab destination in Nutrition mode -- the user's own
// saved/custom foods, sorted and sectioned alphabetically (A-Z, like iOS
// Contacts) rather than the small paginated list this screen used to be,
// since a jump-to-letter index needs the whole set up front. Creating,
// editing, and logging a food are unchanged from before, just restyled.
//
// Layout: the shared header (menu left, "+" right), then two widgets
// `widgetGap` apart: search with a count and a quiet sort action, and the
// foods -- each with its picture (or category glyph), name, serving and
// calories as a mono value -- under letter headings, with the A-Z rail on
// the right. Tapping a row logs it; the pencil edits it.
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
  const sectionListRef = useRef<SectionList<FoodRow>>(null);

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

  function handleDone(saved?: FoodRow) {
    // A food entered by hand for a scanned barcode goes straight on to logging.
    if (saved && mode.type === 'create' && mode.initialBarcode) {
      setMode({ type: 'log', food: saved, fromScan: true });
    } else {
      setMode({ type: 'list' });
    }
    void load();
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
        accentColor={theme.accent}
        onAccentColor={theme.onAccent}
        onDone={() => (mode.fromScan ? navigation.navigate('Nutrition') : navigation.goBack())}
        onCancel={() => setMode({ type: 'list' })}
      />
    );
  }

  const sections = groupFoodsByLetter(rows);
  const availableLetters = new Set(sections.map((section) => section.letter));

  function jumpToLetter(letter: string) {
    const sectionIndex = sections.findIndex((section) => section.letter === letter);
    if (sectionIndex === -1) return;
    setActiveLetter(letter);
    sectionListRef.current?.scrollToLocation({
      sectionIndex,
      itemIndex: 0,
      viewPosition: 0,
      animated: true,
    });
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
          ) : loading ? (
            <View style={styles.loading}>
              <ActivityIndicator
                testID="food-library-loading"
                size="large"
                color={colors.textPrimary}
              />
            </View>
          ) : rows.length === 0 ? (
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
                sections={sections.map((section) => ({
                  title: section.letter,
                  data: section.data,
                }))}
                keyExtractor={(item) => item.id}
                contentContainerStyle={styles.listContent}
                keyboardShouldPersistTaps="handled"
                showsVerticalScrollIndicator={false}
                renderSectionHeader={({ section }) => (
                  <View testID={`food-library-section-${section.title}`}>
                    <SectionHeader label={section.title} />
                  </View>
                )}
                renderItem={({ item, index }) => (
                  <View style={[styles.row, index > 0 && styles.rowDivider]}>
                    <View style={styles.flex}>
                      <ListRow
                        testID={`food-item-${item.id}`}
                        leading={<FoodImage uri={item.imageUrl} name={item.name} size={44} />}
                        title={item.name}
                        subtitle={`${item.servingSize}${item.servingUnit}`}
                        value={`${item.calories} cal`}
                        chevron={false}
                        onPress={() => setMode({ type: 'log', food: item })}
                      />
                    </View>
                    <IconButton
                      testID={`food-edit-${item.id}`}
                      icon="edit-2"
                      onPress={() => setMode({ type: 'edit', food: item })}
                      accessibilityLabel={`Edit ${item.name}`}
                      color={colors.textSecondary}
                    />
                  </View>
                )}
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
