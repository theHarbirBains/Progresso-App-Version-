import { useCallback, useEffect, useRef, useState } from 'react';
import { Image, SectionList, Text, TouchableOpacity, View } from 'react-native';
import { Feather } from '@expo/vector-icons';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useAuth } from '../auth/AuthProvider';
import { AlphabetIndexRail } from '../design/AlphabetIndexRail';
import { EmptyState } from '../design/EmptyState';
import { ErrorState } from '../design/ErrorState';
import { GlassBackground } from '../design/GlassBackground';
import { IconButton } from '../design/IconButton';
import { LoadingState } from '../design/LoadingState';
import { ModeToggle } from '../design/ModeToggle';
import { TextInput } from '../design/TextInput';
import { colors } from '../design/theme';
import { getMyProfile } from '../lib/api';
import { useAppMenu } from '../navigation/AppMenuContext';
import type { RootStackScreenProps } from '../navigation/types';
import { ALPHABET_INDEX_LETTERS, groupFoodsByLetter } from '../nutrition/foodLibraryGrouping';
import { LogFoodStep } from '../nutrition/LogFoodStep';
import { fetchAllFoods, type FoodRow } from '../nutrition/foodQueries';
import {
  buildAccentTheme,
  DEFAULT_NUTRITION_THEME,
  DEFAULT_WORKOUT_THEME,
  type AccentTheme,
} from '../theme/accentColor';
import { foodLibraryStyles as styles } from './foodLibraryStyles';
import { FoodFormScreen } from './FoodFormScreen';

const logo = require('../../assets/progresso-mark.png');
const SEARCH_DEBOUNCE_MS = 300;

type Props = RootStackScreenProps<'FoodLibrary'>;

type Mode =
  | { type: 'list' }
  | { type: 'create'; initialBarcode?: string }
  | { type: 'edit'; food: FoodRow }
  | { type: 'log'; food: FoodRow };

// The "Food" bottom-tab destination in Nutrition mode -- the user's own
// saved/custom foods, sorted and sectioned alphabetically (A-Z, like iOS
// Contacts) rather than the small paginated list this screen used to be,
// since a jump-to-letter index needs the whole set up front. Creating,
// editing, and logging a food are unchanged from before, just restyled.
export function FoodLibraryScreen({ navigation, route }: Props) {
  const { user, session } = useAuth();
  const userId = user?.id ?? '';
  const accessToken = session?.access_token;
  const insets = useSafeAreaInsets();
  const { openMenu, reportMode, currentMode } = useAppMenu();

  const [theme, setTheme] = useState<AccentTheme>(DEFAULT_NUTRITION_THEME);
  const [workoutTheme, setWorkoutTheme] = useState<AccentTheme>(DEFAULT_WORKOUT_THEME);
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
        setWorkoutTheme(
          profile.workoutAccentColor
            ? buildAccentTheme(profile.workoutAccentColor)
            : DEFAULT_WORKOUT_THEME,
        );
      } catch {
        // Keep the default themes -- non-fatal.
      }
    }
    void loadTheme();
    return () => {
      mounted = false;
    };
  }, [accessToken]);

  // Switching mode from a non-Dashboard root screen always goes to that
  // mode's Home (Dashboard), never to this screen's own "mirror" in the
  // other mode (e.g. not straight to Workouts) -- Dashboard is each mode's
  // one true landing page. A no-op if the tapped segment is already selected.
  function handleModeChange(next: 'workout' | 'nutrition') {
    if (next === currentMode) return;
    reportMode?.(next);
    navigation.navigate('Dashboard');
  }

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

  function handleDone() {
    setMode({ type: 'list' });
    void load();
  }

  if (mode.type === 'create') {
    return (
      <FoodFormScreen
        mode="create"
        initialBarcode={mode.initialBarcode}
        onDone={handleDone}
        onCancel={() => setMode({ type: 'list' })}
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
      />
    );
  }

  if (mode.type === 'log') {
    return (
      <LogFoodStep
        food={mode.food}
        userId={userId}
        accentColor={theme.accent}
        onAccentColor={theme.onAccent}
        onDone={() => navigation.goBack()}
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
    <View style={[styles.screen, { paddingTop: insets.top }]} testID="food-library-screen">
      <View style={styles.topBar}>
        <View style={styles.topBarLeft}>
          <IconButton
            testID="food-library-open-menu"
            icon="menu"
            onPress={() => openMenu('nutrition')}
            accessibilityLabel="Open menu"
            color={colors.textSecondary}
          />
          <View style={styles.brandRow}>
            <Image source={logo} style={styles.logo} resizeMode="contain" />
            <Text style={styles.wordmark}>PROGRESSO</Text>
          </View>
        </View>
      </View>

      <View style={styles.modeToggleWrap}>
        <ModeToggle
          mode={currentMode}
          onChange={handleModeChange}
          workoutTheme={workoutTheme}
          nutritionTheme={theme}
          testIDPrefix="food-library"
        />
      </View>

      <View style={styles.titleBlock}>
        <Text style={styles.title}>Food Library</Text>
        <Text style={styles.subtitle}>Your saved foods, always at hand.</Text>
      </View>

      <View style={styles.searchWrap}>
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
        <View style={styles.countRowActions}>
          <TouchableOpacity
            testID="food-library-sort"
            style={styles.sortButton}
            onPress={() => setAscending((prev) => !prev)}
            accessibilityRole="button"
            accessibilityLabel="Toggle sort order"
          >
            <Feather name="list" size={12} color={colors.textSecondary} />
            <Text style={styles.sortButtonText}>Sort {ascending ? 'A → Z' : 'Z → A'}</Text>
          </TouchableOpacity>
          <TouchableOpacity
            testID="food-create-button"
            style={styles.addButton}
            onPress={() => setMode({ type: 'create' })}
            accessibilityRole="button"
            accessibilityLabel="Add a new food"
          >
            <GlassBackground />
            <Feather name="plus" size={16} color={theme.accent} />
          </TouchableOpacity>
        </View>
      </View>

      {error ? (
        <ErrorState
          testID="food-library-error"
          message={error}
          onRetry={() => {
            void load();
          }}
        />
      ) : loading ? (
        <LoadingState testID="food-library-loading" />
      ) : rows.length === 0 ? (
        <View style={styles.emptyWrap}>
          <EmptyState
            testID="food-library-empty"
            icon={<Feather name="inbox" size={24} color={colors.textMuted} />}
            title={search ? `No foods found for "${search}"` : 'No foods yet'}
          />
          {!search ? (
            <TouchableOpacity
              testID="food-empty-create"
              style={styles.addButton}
              onPress={() => setMode({ type: 'create' })}
              accessibilityRole="button"
              accessibilityLabel="Create a food"
            >
              <GlassBackground />
              <Feather name="plus" size={16} color={theme.accent} />
            </TouchableOpacity>
          ) : null}
        </View>
      ) : (
        <View style={{ flex: 1 }}>
          <SectionList
            ref={sectionListRef}
            testID="food-library-list"
            sections={sections.map((section) => ({ title: section.letter, data: section.data }))}
            keyExtractor={(item) => item.id}
            contentContainerStyle={styles.listContent}
            stickySectionHeadersEnabled
            showsVerticalScrollIndicator={false}
            renderSectionHeader={({ section }) => (
              <View style={styles.sectionHeader} testID={`food-library-section-${section.title}`}>
                <Text style={styles.sectionHeaderText}>{section.title}</Text>
              </View>
            )}
            renderItem={({ item }) => (
              <View style={styles.row}>
                <TouchableOpacity
                  testID={`food-item-${item.id}`}
                  style={styles.rowTouchable}
                  onPress={() => setMode({ type: 'log', food: item })}
                >
                  <View style={styles.rowIconWrap}>
                    <Feather name="coffee" size={18} color={colors.textMuted} />
                  </View>
                  <View style={styles.rowBody}>
                    <Text style={styles.rowName}>{item.name}</Text>
                    <Text style={styles.rowMeta}>
                      {item.servingSize}
                      {item.servingUnit}
                    </Text>
                  </View>
                  <Text style={styles.rowCalories}>{item.calories} cal</Text>
                </TouchableOpacity>
                <TouchableOpacity
                  testID={`food-edit-${item.id}`}
                  style={styles.rowEditButton}
                  onPress={() => setMode({ type: 'edit', food: item })}
                  accessibilityRole="button"
                  accessibilityLabel={`Edit ${item.name}`}
                >
                  <Feather name="edit-2" size={16} color={colors.textMuted} />
                </TouchableOpacity>
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
    </View>
  );
}
