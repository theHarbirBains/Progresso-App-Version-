import { useEffect, useMemo, useRef, useState, type ReactNode } from 'react';
import {
  Animated,
  InputAccessoryView,
  Keyboard,
  Platform,
  Pressable,
  ScrollView,
  StyleSheet,
  TextInput,
  TouchableOpacity,
  View,
  useWindowDimensions,
} from 'react-native';
import { Feather, MaterialCommunityIcons } from '@expo/vector-icons';
import { useAuth } from '../auth/AuthProvider';
import { Text } from '../design/Text';
import { AppCard } from '../design/AppCard';
import { AppHeader } from '../design/AppHeader';
import { PrimaryButton, TextButton } from '../design/Button';
import { BottomSheet } from '../design/BottomSheet';
import { RiseIn, RiseInStack } from '../design/RiseIn';
import { Screen } from '../design/Screen';
import { SkeletonCards } from '../design/Skeleton';
import { colors, fonts, radii, spacing, typeScale } from '../design/theme';
import { useAppMenu } from '../navigation/AppMenuContext';
import { useReduceMotionPreference } from '../navigation/navigationTransitions';
import type { RootStackScreenProps } from '../navigation/types';
import { useProgressTheme } from '../progress/useProgressTheme';
import { CalorieRing } from '../nutrition/CalorieRing';
import { DayBar } from '../nutrition/DayBar';
import { IconButton } from '../design/IconButton';
import { SwipeToDelete } from '../design/SwipeToDelete';
import { useProfile } from '../profile/ProfileProvider';
import { buildCalorieProfileInput, computeMaintenanceCalories } from '../nutrition/calorieTargets';
import { MacroRows, type MacroFigure } from '../nutrition/MacroRows';
import { FoodImage } from '../nutrition/FoodImage';
import { useFoodLog } from '../nutrition/FoodLogProvider';
import { getCurrentWeekRange } from '../dashboard/weeklyProgress';
import { fetchFoodLogsForRange, type FoodLogRow } from '../nutrition/foodLogQueries';
import { isTodayKey, shiftDay, todayKey, weekOfLabel } from '../nutrition/logDay';
import { dayFromKey, dayKey } from '../lib/dayKey';
import { logMeasures, servingMeasures, servingsFor, unitWord } from '../nutrition/logQuantity';
import {
  calculateRemaining,
  calorieGoalFor,
  daysLeftInWeek,
  sumDailyTotals,
} from '../nutrition/nutritionCalculations';
import { useNutritionGoals } from '../nutrition/NutritionGoalsProvider';
import { useDaySwipe } from '../nutrition/useDaySwipe';
import { type NutritionGoals } from '../nutrition/nutritionGoalQueries';
import { CopyYesterdaySheet, SaveAsMealSheet } from '../nutrition/TodayShortcutSheets';
import { readAheadDayLogs, readDayLogs, useDayLogs } from '../nutrition/useDayLogs';
import { WeeklyCalorieBudget } from '../nutrition/WeeklyCalorieBudget';
import { MicronutrientsWidget } from '../nutrition/MicronutrientsWidget';
import { weekLogging, weekRangeText } from '../nutrition/weekLogging';
import { useShowAllAtOnce } from '../lib/useShowAllAtOnce';
import { wholeFigure } from '../nutrition/wholeFigures';

type Props = RootStackScreenProps<'Nutrition'>;

const EMPTY_GOALS: NutritionGoals = { calories: null, proteinG: null, carbsG: null, fatG: null };
// Another day's foods before they've been read: one array, so what depends on the foods stays put.
const NO_LOGS: FoodLogRow[] = [];
// Links each food row's amount field to the check above the number pad (iPhone).
const AMOUNT_DONE_ID = 'food-log-amount-done';

// The Nutrition tab's own root screen (see App.tsx's bottom nav) -- a day's
// intake against the user's targets, with the day's logged foods. Today by
// default; any other day -- before today, or ahead of it to plan -- by
// swiping (right for the day before, left for the day after), or from
// Nutrition History's calendar (route.params.day). Today is the shared, live
// food log (FoodLogProvider); any other day is read for itself (useDayLogs).
// Logging from another day logs to it -- the day goes with each way to log as a route param
// -- and every day shows its week's calorie budget; only today shows Copy Yesterday.
//
// Layout (Harbir's one-page design): all of it fits one iPhone 15-sized screen with nothing to
// scroll -- a smaller phone still scrolls the page. The shared Screen with a hamburger menu, the
// day on one line (DayBar compact: an arrow either side, the date between, tapped for the
// calendar), then five widgets `widgetGap` apart, rising in like every other page's:
// - **Today** (the hero): the calorie ring and what's left on the left; on the right, protein /
//   carbs / fat (MacroRows compact), then one quiet row to the vitamins and minerals for the day
//   shown (MicronutrientsWidget) -- no figures of its own here.
// - **Log Food**: four outlined tiles -- Scan Barcode, Search Food, Describe Food (AI) and Quick
//   Entry -- with the Food Library as the card's link: every way into the same logging flow.
// - **Today's Foods**, with View All (Nutrition History), taking the room that's left: each food
//   as a row -- its picture, its name, the values snapshotted when it was logged, an editable
//   quantity and a quiet Delete -- scrolling inside the card, or, with none yet, an empty state
//   with the page's one filled button, Log Your First Meal. Under them, two quiet actions: Copy
//   Yesterday (when yesterday has foods -- a sheet of them, all ticked, logged again now) and
//   Save as Meal (when today has some -- a sheet to name them and keep them as a saved meal).
// - **This Week**: the week's calorie budget -- 7 times the daily target, Sunday to Saturday --
//   as a slim card: a bar, what's been eaten against it and what's left (WeeklyCalorieBudget
//   summary); a tap opens the rest in a sheet.
// - **Daily Targets**, with Edit Targets (Nutrition Goals): the four targets as tiles, "—" for
//   one not set.
/** A day key worth showing: a real day, not ahead of today; today otherwise. */
function shownDayFrom(key: string | undefined): string {
  if (!key || !/^\d{4}-\d{2}-\d{2}$/.test(key)) return todayKey();
  return key;
}

export function NutritionTodayScreen({ navigation, route }: Props) {
  const { user } = useAuth();
  const userId = user?.id;
  const { nutritionTheme } = useProgressTheme();
  const { openMenu } = useAppMenu();
  // Goals rarely change and are shared with ProfileScreen/NutritionGoalsScreen
  // via the same cache; today's logs are shared too (FoodLogProvider), write-
  // through from here, LogFoodStep (Food Library/Search/Barcode Scanner) and
  // Delete/quantity edits below -- none of that needs a re-fetch of its own
  // any more, from this screen or any other.
  const { goals: savedGoals, loading: goalsLoading, error: goalsError } = useNutritionGoals();
  // The daily targets. Every figure on this page is measured against these.
  const goals: NutritionGoals = savedGoals ?? EMPTY_GOALS;
  const [day, setDay] = useState(() => shownDayFrom(route.params?.day));
  // A day chosen in Nutrition History replaces the one shown -- even the same day again, after
  // swiping away from it: each navigation hands over new params.
  const routeParams = route.params;
  useEffect(() => {
    if (routeParams?.day) setDay(shownDayFrom(routeParams.day));
  }, [routeParams]);
  const isToday = isTodayKey(day);
  const todayLog = useFoodLog();
  const pastLog = useDayLogs(userId, isToday ? null : day, navigation);
  // Another day's foods are shown only once they're that day's -- never the last day's in its place.
  const pastReady = pastLog.day === day;
  const logs = isToday ? todayLog.logs : pastReady ? pastLog.logs : NO_LOGS;
  const logsLoading = isToday ? todayLog.loading : !pastReady || pastLog.loading;
  const logsError = isToday ? todayLog.error : pastLog.error;
  const updateQuantity = isToday ? todayLog.updateQuantity : pastLog.updateQuantity;
  const removeLog = isToday ? todayLog.removeLog : pastLog.removeLog;
  // Each way to log logs to the day shown: nothing for today, the day for any other.
  const logParams = isToday ? undefined : { day };

  // Leaving the page and coming back to it shows today again -- there's no button back to today.
  // A way to log is the exception: it logs to the day shown and comes back to it, so the food
  // just logged is there to see.
  const leftToLog = useRef(false);
  function logVia(
    to: 'FoodLibrary' | 'BarcodeScanner' | 'FoodSearch' | 'AiFoodSearch' | 'QuickFoodEntry',
  ) {
    leftToLog.current = true;
    navigation.navigate(to, logParams);
  }
  useEffect(() => {
    let left = false;
    const offBlur = navigation.addListener('blur', () => {
      left = true;
    });
    const offFocus = navigation.addListener('focus', () => {
      if (!left) return;
      left = false;
      if (leftToLog.current) {
        leftToLog.current = false;
        return;
      }
      setDay(todayKey());
    });
    return () => {
      offBlur();
      offFocus();
    };
  }, [navigation]);

  // Moving between days: a swipe turns the day (useDaySwipe) -- no arrows. Swiping right goes
  // back a day, left forward -- tomorrow and on too.
  const reduceMotion = useReduceMotionPreference();
  const { width } = useWindowDimensions();
  // The widgets rise in as the page opens, like every page's; once the day has been moved,
  // they turn with it instead, so a new day's widgets never rise in on top of the turn.
  const [moved, setMoved] = useState(false);

  function showDay(to: string) {
    setMoved(true);
    setDay(to);
  }
  const dayTurn = useDaySwipe({ day, onDay: showDay, width, reduceMotion });

  const [quantityInputs, setQuantityInputs] = useState<Record<string, string>>({});
  // The one food row showing Delete, if any; and whether a row is being swiped, when the page
  // holds its scroll still.
  const [swipeOpenId, setSwipeOpenId] = useState<string | null>(null);
  const [rowSwiping, setRowSwiping] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [yesterdayLogs, setYesterdayLogs] = useState<FoodLogRow[]>([]);
  // The foods of the week the day shown is in (Sunday to Saturday), for its calorie budget.
  const [weekLogs, setWeekLogs] = useState<{ start: number; rows: FoodLogRow[] } | null>(null);
  const [weekFailed, setWeekFailed] = useState(false);
  const [copyOpen, setCopyOpen] = useState(false);
  // The week in full -- its unlogged days, how it sits with the goal, the estimate -- in a sheet.
  const [weekOpen, setWeekOpen] = useState(false);
  const [saveMealOpen, setSaveMealOpen] = useState(false);

  // Yesterday's foods, for Copy Yesterday. Read each time Today opens -- it's opened fresh on
  // every visit -- and only a shortcut, so a failure just leaves it out.
  useEffect(() => {
    if (!userId) return;
    let cancelled = false;
    // The same read a swipe to yesterday shows at once (readDayLogs remembers it).
    readDayLogs(userId, shiftDay(todayKey(), -1))
      .then((rows) => {
        if (!cancelled) setYesterdayLogs(rows);
      })
      .catch(() => undefined);
    return () => {
      cancelled = true;
    };
  }, [userId]);

  // The days either side of the one shown are read ahead -- the next swipe's, either way. Today's
  // own foods are the shared log's, and yesterday's come with Copy Yesterday's read.
  useEffect(() => {
    if (!userId) return;
    for (const neighbour of [shiftDay(day, -1), shiftDay(day, 1)]) {
      if (!isTodayKey(neighbour)) readAheadDayLogs(userId, neighbour);
    }
  }, [userId, day]);

  // The week of the day shown, for the week's calorie budget on any day -- read as the page opens
  // and again each time the day changes; within the same week the last read counts meanwhile,
  // so a swipe never blanks the bar. Only the latest read is kept.
  useEffect(() => {
    if (!userId) return;
    let cancelled = false;
    const { start, end } = getCurrentWeekRange(dayFromKey(day));
    setWeekFailed(false);
    fetchFoodLogsForRange(userId, start, end)
      .then((rows) => {
        if (!cancelled) setWeekLogs({ start: start.getTime(), rows });
      })
      .catch(() => {
        if (!cancelled) setWeekFailed(true);
      });
    return () => {
      cancelled = true;
    };
  }, [userId, day]);

  // Seeds a draft input for any log not already tracked (a fresh load, or a
  // food logged elsewhere while this screen is mounted) without touching an
  // entry the user is already editing.
  useEffect(() => {
    setQuantityInputs((prev) => {
      const next: Record<string, string> = { ...prev };
      let changed = false;
      for (const log of logs) {
        if (!(log.id in next)) {
          next[log.id] = String(log.enteredAmount ?? log.quantity);
          changed = true;
        }
      }
      return changed ? next : prev;
    });
  }, [logs]);

  const consumed = useMemo(() => sumDailyTotals(logs), [logs]);
  // What the daily target is for -- a cut, maintaining or a bulk -- from it against the
  // maintenance estimate Nutrition Goals' calculator works out from the profile; none without
  // the details it needs.
  const { profile } = useProfile();
  const calorieGoal = useMemo(() => {
    const input = profile
      ? buildCalorieProfileInput({
          gender: profile.gender,
          birthday: profile.birthday,
          heightCm: profile.heightValue,
          weightKg: profile.weightValue,
          activityLevel: profile.activityLevel,
        })
      : null;
    return calorieGoalFor(goals.calories, input ? computeMaintenanceCalories(input) : null);
  }, [profile, goals.calories]);
  // The week through the day shown: its days before that day from the week's read, and the day's
  // own from its foods above, so a food logged, edited or deleted here moves the bar at once.
  const week = useMemo(() => {
    const shown = dayFromKey(day);
    const start = getCurrentWeekRange(shown).start;
    const earlier =
      weekLogs?.start === start.getTime()
        ? sumDailyTotals(weekLogs.rows.filter((row) => new Date(row.loggedAt) < shown)).calories
        : null;
    const thisWeek = start.getTime() === getCurrentWeekRange().start.getTime();
    return {
      earlier,
      title: thisWeek ? 'This Week' : weekOfLabel(dayKey(start)),
      daysLeft: daysLeftInWeek(shown),
      rangeText: weekRangeText(start),
      // Which of the week's days before this one have nothing logged -- missing, never 0 eaten.
      logging: weekLogs?.start === start.getTime() ? weekLogging(weekLogs.rows, start, day) : null,
    };
  }, [day, weekLogs]);
  const remaining = useMemo(() => calculateRemaining(consumed, goals), [consumed, goals]);
  // The page shows all at once: the first time, the week's budget comes with the day's foods (or
  // soon after, if its read is slow), never a moment later.
  const showPage = useShowAllAtOnce(weekLogs !== null || weekFailed);
  const displayError = error ?? goalsError ?? logsError;
  const accent = nutritionTheme.accent;

  // A log's amount is edited the way it was typed -- "2" cookies, "150" g -- and turned into
  // servings from the log's own serving snapshot. A log from before amounts were kept is in
  // servings. Zero takes the food off the day, the same as its Delete: a log is only ever of
  // some amount (food_logs keeps quantities above zero), and only this entry goes -- the food
  // stays in the library and every other day's log of it stays as it was. Anything that isn't
  // an amount (blank, negative, not a number) puts back the one there was.
  async function handleUpdateQuantity(log: FoodLogRow) {
    const typed = (quantityInputs[log.id] ?? '').trim().replace(',', '.');
    const amount = Number(typed);
    const unit = log.enteredUnit ?? 'servings';
    const current = log.enteredAmount ?? log.quantity;
    if (typed !== '' && amount === 0) {
      await handleDelete(log.id);
      return;
    }
    if (typed === '' || !Number.isFinite(amount) || amount < 0) {
      setQuantityInputs((prev) => ({ ...prev, [log.id]: String(current) }));
      return;
    }
    if (amount === current) return;
    const servings = servingsFor(amount, unit, logMeasures(log));
    if (!(servings > 0)) return;
    setError(null);
    try {
      const updated = await updateQuantity(
        log,
        servings,
        log.enteredUnit ? { amount, unit: log.enteredUnit } : undefined,
      );
      setQuantityInputs((prev) => ({
        ...prev,
        [log.id]: String(updated.enteredAmount ?? updated.quantity),
      }));
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to update quantity');
    }
  }

  // A food is deleted from its row's swipe (or VoiceOver's Delete action): the swipe and the tap
  // on Delete are the two deliberate steps, so nothing more is asked.
  async function handleDelete(logId: string) {
    setError(null);
    try {
      await removeLog(logId);
      setSwipeOpenId(null);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to delete food log');
    }
  }

  const header = (
    <AppHeader
      testID="nutrition-today-header"
      title="Nutrition"
      leftAction={{
        icon: 'menu',
        onPress: () => openMenu(),
        accessibilityLabel: 'Open menu',
        testID: 'nutrition-today-open-menu',
      }}
    />
  );

  const dayBar = (
    <View {...dayTurn.panHandlers}>
      <DayBar
        day={day}
        slide={dayTurn.slide}
        width={width}
        onChooseDay={() => navigation.navigate('NutritionHistory', { date: day })}
        onAdjust={(direction) => dayTurn.turnTo(direction)}
        accentColor={nutritionTheme.accent}
        compact
      />
    </View>
  );

  if (goalsLoading || (isToday && logsLoading) || !showPage) {
    return (
      <Screen header={header} contentContainerStyle={styles.content}>
        <SkeletonCards testID="nutrition-today-loading" heights={[44, 168, 104, 140, 80, 96]} />
      </Screen>
    );
  }

  const macros: MacroFigure[] = [
    { key: 'protein', label: 'Protein', consumed: consumed.proteinG, goal: goals.proteinG },
    { key: 'carbs', label: 'Carbs', consumed: consumed.carbsG, goal: goals.carbsG },
    { key: 'fat', label: 'Fat', consumed: consumed.fatG, goal: goals.fatG },
  ];

  const targets = [
    { key: 'calories', label: 'Calories', value: goals.calories, unit: '' },
    { key: 'protein', label: 'Protein', value: goals.proteinG, unit: 'g' },
    { key: 'carbs', label: 'Carbs', value: goals.carbsG, unit: 'g' },
    { key: 'fat', label: 'Fat', value: goals.fatG, unit: 'g' },
  ];

  // The day's foods: each a row with its picture, its figures and its amount to change, swiped to
  // delete; then Copy Yesterday and Save as Meal. In the foods card's own scroll.
  const foodRows = (
    <View {...dayTurn.rowSwipeZone}>
      {logs.map((log, index) => (
        <SwipeToDelete
          key={log.id}
          testID={`food-log-swipe-${log.id}`}
          style={index > 0 && styles.divider}
          name={log.foodNameSnapshot}
          open={swipeOpenId === log.id}
          onOpenChange={(open) => setSwipeOpenId(open ? log.id : null)}
          onSwipingChange={setRowSwiping}
          onDelete={() => void handleDelete(log.id)}
        >
          <View testID={`food-log-row-${log.id}`} style={styles.logRow}>
            <FoodImage
              testID={`food-log-image-${log.id}`}
              uri={log.imageUrl}
              name={log.foodNameSnapshot}
              size={40}
              zoomable
            />
            <View
              testID={`food-log-info-${log.id}`}
              style={styles.logInfo}
              accessible
              accessibilityLabel={`${log.foodNameSnapshot}, ${wholeFigure(log.calories)} calories`}
              accessibilityActions={[{ name: 'delete', label: 'Delete' }]}
              onAccessibilityAction={(event) => {
                if (event.nativeEvent.actionName === 'delete') void handleDelete(log.id);
              }}
            >
              <Text style={styles.logName} numberOfLines={1}>
                {log.foodNameSnapshot}
              </Text>
              <Text style={styles.logMeta} numberOfLines={1}>
                {wholeFigure(log.calories)} cal · {wholeFigure(log.proteinG)}g protein ·{' '}
                {wholeFigure(log.carbsG)}g carbs · {wholeFigure(log.fatG)}g fat
              </Text>
            </View>
            <View style={styles.quantityColumn}>
              <TextInput
                testID={`food-log-quantity-${log.id}`}
                style={styles.quantityInput}
                accessibilityLabel={`Amount of ${log.foodNameSnapshot}, in ${unitWord(
                  2,
                  log.enteredUnit ?? 'servings',
                  servingMeasures(log).pieces,
                )}`}
                accessibilityHint="Enter 0 to take it off the day."
                keyboardType="decimal-pad"
                returnKeyType="done"
                inputAccessoryViewID={AMOUNT_DONE_ID}
                value={quantityInputs[log.id] ?? ''}
                onChangeText={(text) => setQuantityInputs((prev) => ({ ...prev, [log.id]: text }))}
                onEndEditing={() => handleUpdateQuantity(log)}
              />
              <Text testID={`food-log-unit-${log.id}`} style={styles.quantityUnit}>
                {unitWord(
                  log.enteredAmount ?? log.quantity,
                  log.enteredUnit ?? 'servings',
                  servingMeasures(log).pieces,
                )}
              </Text>
            </View>
          </View>
        </SwipeToDelete>
      ))}
    </View>
  );
  const foodShortcuts =
    (isToday && yesterdayLogs.length > 0) || logs.some((log) => log.foodId !== null) ? (
      <View style={styles.foodShortcuts}>
        {isToday && yesterdayLogs.length > 0 ? (
          <TextButton
            testID="nutrition-today-copy-yesterday"
            label="Copy Yesterday"
            onPress={() => setCopyOpen(true)}
          />
        ) : null}
        {logs.some((log) => log.foodId !== null) ? (
          <TextButton
            testID="nutrition-today-save-meal"
            label="Save as Meal"
            onPress={() => setSaveMealOpen(true)}
          />
        ) : null}
      </View>
    ) : null;

  // The ways to log, as four tiles: what each is, at a glance.
  const logWays: {
    key: 'BarcodeScanner' | 'FoodSearch' | 'AiFoodSearch' | 'QuickFoodEntry';
    testID: string;
    label: string;
    spoken?: string;
    icon: ReactNode;
  }[] = [
    {
      key: 'BarcodeScanner',
      testID: 'scan-barcode-button',
      label: 'Scan\nBarcode',
      spoken: 'Scan Barcode',
      icon: <MaterialCommunityIcons name="barcode-scan" size={22} color={accent} />,
    },
    {
      key: 'FoodSearch',
      testID: 'search-food-button',
      label: 'Search\nFood',
      spoken: 'Search Food',
      icon: <Feather name="search" size={21} color={accent} />,
    },
    {
      key: 'AiFoodSearch',
      testID: 'ai-food-search-button',
      label: 'Describe\nFood (AI)',
      spoken: 'AI Food Search',
      icon: <Feather name="zap" size={21} color={accent} />,
    },
    {
      key: 'QuickFoodEntry',
      testID: 'quick-food-entry-button',
      label: 'Quick\nEntry',
      spoken: 'Quick Macro Entry',
      icon: <Feather name="edit-2" size={20} color={accent} />,
    },
  ];

  /** A card's heading: its glyph in the accent, its title, and a link on its right. */
  const cardHead = (
    icon: ReactNode,
    title: string,
    link?: { label: string; onPress: () => void; testID: string; spoken?: string },
  ) => (
    <View style={styles.cardHead}>
      {icon}
      <Text style={styles.cardTitle} numberOfLines={1}>
        {title}
      </Text>
      {link ? (
        <TouchableOpacity
          testID={link.testID}
          onPress={link.onPress}
          hitSlop={12}
          style={styles.cardLink}
          accessibilityRole="button"
          accessibilityLabel={link.spoken ?? link.label}
        >
          <Text style={[styles.cardLinkText, { color: accent }]}>{link.label}</Text>
          <Feather name="chevron-right" size={15} color={accent} />
        </TouchableOpacity>
      ) : null}
    </View>
  );

  const targetGlyphs: Record<string, keyof typeof MaterialCommunityIcons.glyphMap> = {
    calories: 'fire',
    protein: 'food-drumstick-outline',
    carbs: 'barley',
    fat: 'water-outline',
  };

  // One page, top to bottom, with nothing to scroll on a phone of today's size (Harbir's design,
  // November 2026): the day's figures, the ways to log, the day's foods (which take whatever room
  // is left, scrolling inside their card), the week in one line, and the daily targets.
  const dayWidgets = (
    <>
      {displayError ? (
        <Text testID="nutrition-today-error" style={styles.errorText}>
          {displayError}
        </Text>
      ) : null}

      {logsLoading ? (
        <Animated.View style={[dayTurn.widgetStyle(0), styles.fill]}>
          <SkeletonCards testID="nutrition-day-loading" heights={[168, 104, 140]} />
        </Animated.View>
      ) : (
        <>
          <Animated.View style={dayTurn.widgetStyle(0)}>
            <AppCard hero testID="nutrition-today-macros" style={styles.heroCard}>
              <View style={styles.summary}>
                <View style={styles.ringColumn}>
                  <CalorieRing
                    testID="nutrition-today-calorie-ring"
                    consumed={consumed.calories}
                    goal={goals.calories}
                    accentColor={accent}
                    size={RING_SIZE}
                    strokeWidth={10}
                    goalJoin="/"
                    glyph={<MaterialCommunityIcons name="fire" size={18} color={accent} />}
                  />
                  {remaining.calories !== null ? (
                    <View style={styles.remainingPill}>
                      <Text
                        testID="calories-remaining"
                        style={[styles.ringRemaining, { color: accent }]}
                        numberOfLines={1}
                      >
                        {remaining.calories >= 0
                          ? `${wholeFigure(remaining.calories)} cal remaining`
                          : `${wholeFigure(-remaining.calories)} cal over`}
                      </Text>
                    </View>
                  ) : null}
                </View>
                <View style={styles.heroRule} />
                <View style={styles.macroColumn}>
                  <MacroRows macros={macros} accentColor={accent} compact />
                  <MicronutrientsWidget
                    accentColor={accent}
                    onPress={() => navigation.navigate('Micronutrients', { day })}
                  />
                </View>
              </View>
            </AppCard>
          </Animated.View>

          <Animated.View style={dayTurn.widgetStyle(1)}>
            <AppCard testID="nutrition-today-actions" style={styles.compactCard}>
              {cardHead(
                <MaterialCommunityIcons name="silverware-fork-knife" size={18} color={accent} />,
                'Log Food',
                {
                  label: 'Food Library',
                  onPress: () => logVia('FoodLibrary'),
                  testID: 'log-food-button',
                  spoken: 'Log Food from your Food Library',
                },
              )}
              <View style={styles.tiles}>
                {logWays.map((way) => (
                  <Pressable
                    key={way.key}
                    testID={way.testID}
                    onPress={() => logVia(way.key)}
                    style={({ pressed }) => [styles.tile, pressed && styles.tilePressed]}
                    accessibilityRole="button"
                    accessibilityLabel={way.spoken ?? way.label}
                  >
                    {way.icon}
                    <Text style={styles.tileLabel} numberOfLines={2}>
                      {way.label}
                    </Text>
                  </Pressable>
                ))}
              </View>
            </AppCard>
          </Animated.View>

          <Animated.View style={[dayTurn.widgetStyle(2), styles.foodsWrap]}>
            <AppCard testID="nutrition-today-foods" style={styles.foodsCard}>
              {cardHead(
                <MaterialCommunityIcons name="bowl-mix-outline" size={19} color={accent} />,
                isToday ? "Today's Foods" : 'Foods',
                {
                  label: 'View All',
                  onPress: () => navigation.navigate('NutritionHistory'),
                  testID: 'nutrition-today-view-all',
                },
              )}
              <ScrollView
                keyboardDismissMode="on-drag"
                testID="nutrition-today-foods-scroll"
                style={styles.foodsList}
                contentContainerStyle={logs.length === 0 ? styles.foodsEmptyContent : undefined}
                nestedScrollEnabled
                scrollEnabled={!rowSwiping}
                keyboardShouldPersistTaps="handled"
                showsVerticalScrollIndicator={false}
              >
                {logs.length === 0 ? (
                  <View style={styles.foodsEmpty}>
                    <View style={styles.emptyLine}>
                      <MaterialCommunityIcons
                        name="bowl-outline"
                        size={20}
                        color={colors.textSecondary}
                      />
                      <Text testID="food-log-empty" style={styles.emptyTitle}>
                        {isToday ? 'No foods logged today' : 'No foods logged this day'}
                      </Text>
                    </View>
                    <PrimaryButton
                      testID="food-log-empty-log"
                      label={isToday ? 'Log Your First Meal' : 'Log a Food'}
                      icon="plus"
                      size="md"
                      onPress={() => logVia('FoodLibrary')}
                      accentColor={accent}
                      onAccentColor={nutritionTheme.onAccent}
                    />
                  </View>
                ) : (
                  foodRows
                )}
                {foodShortcuts}
              </ScrollView>
            </AppCard>
          </Animated.View>

          <Animated.View style={dayTurn.widgetStyle(3)}>
            <WeeklyCalorieBudget
              layout="summary"
              onOpenDetails={() => setWeekOpen(true)}
              title={week.title}
              today={isToday}
              consumed={week.earlier === null ? null : week.earlier + consumed.calories}
              dailyTarget={goals.calories}
              daysLeft={week.daysLeft}
              goal={calorieGoal}
              failed={weekFailed}
              rangeText={week.rangeText}
              logging={week.logging}
              accentColor={accent}
              onSetTarget={() => navigation.navigate('NutritionGoals')}
            />
          </Animated.View>

          <BottomSheet
            visible={weekOpen}
            onClose={() => setWeekOpen(false)}
            swipeToDismiss
            testID="nutrition-week-sheet"
          >
            <WeeklyCalorieBudget
              layout="details"
              title={week.title}
              today={isToday}
              consumed={week.earlier === null ? null : week.earlier + consumed.calories}
              dailyTarget={goals.calories}
              daysLeft={week.daysLeft}
              goal={calorieGoal}
              failed={weekFailed}
              rangeText={week.rangeText}
              logging={week.logging}
              accentColor={accent}
              onSetTarget={() => navigation.navigate('NutritionGoals')}
            />
          </BottomSheet>

          <CopyYesterdaySheet
            visible={copyOpen}
            onClose={() => setCopyOpen(false)}
            logs={yesterdayLogs}
            accentColor={accent}
            onAccentColor={nutritionTheme.onAccent}
          />
          <SaveAsMealSheet
            visible={saveMealOpen}
            onClose={() => setSaveMealOpen(false)}
            logs={logs}
            accentColor={accent}
            onAccentColor={nutritionTheme.onAccent}
          />
        </>
      )}

      <Animated.View style={dayTurn.widgetStyle(4)}>
        <AppCard testID="nutrition-today-targets" style={styles.compactCard}>
          {cardHead(<Feather name="target" size={18} color={accent} />, 'Daily Targets', {
            label: 'Edit Targets',
            onPress: () => navigation.navigate('NutritionGoals'),
            testID: 'nutrition-today-edit-targets',
          })}
          <View style={styles.targets}>
            {targets.map((target) => (
              <View
                key={target.key}
                testID={`target-${target.key}`}
                style={styles.targetTile}
                accessible
                accessibilityLabel={`${target.label}, ${
                  target.value !== null ? `${wholeFigure(target.value)}${target.unit}` : 'not set'
                }`}
              >
                <View style={styles.targetLine}>
                  <MaterialCommunityIcons
                    name={targetGlyphs[target.key]!}
                    size={14}
                    color={accent}
                  />
                  <Text
                    style={styles.targetValue}
                    numberOfLines={1}
                    adjustsFontSizeToFit
                    minimumFontScale={0.8}
                  >
                    {target.value !== null ? `${wholeFigure(target.value)}${target.unit}` : '—'}
                  </Text>
                </View>
                <Text style={styles.targetLabel}>{target.label}</Text>
              </View>
            ))}
          </View>
        </AppCard>
      </Animated.View>
    </>
  );

  return (
    <Screen
      contentContainerStyle={styles.content}
      header={header}
      rollout={false}
      scrollEnabled={!dayTurn.swiping && !rowSwiping}
    >
      {/* iPhone's number pad has no key to finish with: a check on the bar above it saves the
          amount typed (it ends the editing, which saves). Android's has its own. */}
      {Platform.OS === 'ios' ? (
        <InputAccessoryView nativeID={AMOUNT_DONE_ID}>
          <View style={styles.amountBar}>
            <IconButton
              testID="food-log-amount-save"
              icon="check"
              accessibilityLabel="Save amount"
              color={accent}
              onPress={() => Keyboard.dismiss()}
            />
          </View>
        </InputAccessoryView>
      ) : null}
      <RiseIn>{dayBar}</RiseIn>
      <Animated.View
        testID="nutrition-day-content"
        style={[styles.dayContent, dayTurn.contentStyle]}
        {...dayTurn.panHandlers}
      >
        {moved ? dayWidgets : <RiseInStack>{dayWidgets}</RiseInStack>}
      </Animated.View>
    </Screen>
  );
}

/** The widgets' gap: a little tighter than other pages', so the page fits one screen. */
const GAP = 6;
/** The cards' own top and bottom padding here: a little slimmer than elsewhere, for the same. */
const CARD_PAD = 10;
const RING_SIZE = 108;

const styles = StyleSheet.create({
  // The page fills the screen: the day's widgets take it, the foods card the rest of it.
  content: {
    flexGrow: 1,
    gap: GAP,
    paddingBottom: spacing.sm,
  },
  // Each at its own size first, then filling what's left -- so on a smaller phone the page
  // scrolls rather than squeezing anything.
  dayContent: {
    flexGrow: 1,
    gap: GAP,
  },
  fill: {
    flexGrow: 1,
  },
  errorText: {
    ...typeScale.callout,
    color: colors.destructive,
  },

  // The hero: the ring and what's left on the left, the macros and Micronutrients on the right.
  heroCard: {
    paddingVertical: CARD_PAD,
  },
  summary: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.md,
  },
  ringColumn: {
    alignItems: 'center',
    gap: spacing.sm,
  },
  remainingPill: {
    paddingHorizontal: spacing.sm,
    paddingVertical: 3,
    borderRadius: radii.pill,
    backgroundColor: colors.surfaceRaised,
  },
  ringRemaining: {
    ...typeScale.caption,
    fontFamily: fonts.semibold,
    textAlign: 'center',
  },
  heroRule: {
    width: StyleSheet.hairlineWidth,
    alignSelf: 'stretch',
    backgroundColor: colors.divider,
  },
  macroColumn: {
    flex: 1,
    minWidth: 0,
  },

  // A card's own heading: glyph, title, and a link on the right.
  compactCard: {
    paddingVertical: CARD_PAD,
  },
  cardHead: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
    marginBottom: 6,
  },
  cardTitle: {
    ...typeScale.cardTitle,
    color: colors.textPrimary,
    flex: 1,
  },
  cardLink: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 2,
  },
  cardLinkText: {
    ...typeScale.secondary,
    fontFamily: fonts.semibold,
  },

  // The four ways to log, side by side.
  tiles: {
    flexDirection: 'row',
    gap: spacing.sm,
  },
  tile: {
    flex: 1,
    minHeight: 56,
    alignItems: 'center',
    justifyContent: 'center',
    gap: 4,
    paddingVertical: spacing.sm,
    paddingHorizontal: 2,
    borderRadius: radii.md,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: colors.border,
    backgroundColor: colors.surfaceRaised,
  },
  tilePressed: {
    opacity: 0.7,
  },
  tileLabel: {
    ...typeScale.caption,
    fontFamily: fonts.semibold,
    color: colors.textPrimary,
    textAlign: 'center',
  },

  // The day's foods: whatever room is left, never less than a row or two, scrolling inside.
  foodsWrap: {
    flexGrow: 1,
    minHeight: 112,
  },
  foodsCard: {
    flexGrow: 1,
    paddingVertical: CARD_PAD,
  },
  foodsList: {
    flex: 1,
  },
  foodsEmptyContent: {
    flexGrow: 1,
    justifyContent: 'center',
  },
  foodsEmpty: {
    alignItems: 'center',
    gap: spacing.sm,
  },
  emptyLine: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
  },
  emptyTitle: {
    ...typeScale.callout,
    color: colors.textSecondary,
  },
  // Copy Yesterday and Save as Meal, under the day's foods.
  foodShortcuts: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginTop: spacing.xs,
  },
  divider: {
    borderTopWidth: StyleSheet.hairlineWidth,
    borderTopColor: colors.divider,
  },
  logRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
    paddingVertical: spacing.sm,
  },
  logInfo: {
    flex: 1,
    minWidth: 0,
  },
  logName: {
    ...typeScale.callout,
    fontFamily: fonts.semibold,
    color: colors.textPrimary,
  },
  logMeta: {
    ...typeScale.caption,
    color: colors.textSecondary,
    marginTop: 2,
  },
  quantityColumn: {
    alignItems: 'center',
    gap: 2,
  },
  quantityUnit: {
    ...typeScale.caption,
    color: colors.textMuted,
    maxWidth: 72,
  },
  // The bar above the number pad, with its one check at the right.
  amountBar: {
    flexDirection: 'row',
    justifyContent: 'flex-end',
    paddingHorizontal: spacing.sm,
    backgroundColor: colors.surfaceRaised,
    borderTopWidth: StyleSheet.hairlineWidth,
    borderTopColor: colors.divider,
  },
  quantityInput: {
    width: 60,
    height: 40,
    borderRadius: radii.md,
    borderWidth: 1,
    borderColor: colors.border,
    backgroundColor: colors.surfaceRaised,
    color: colors.textPrimary,
    ...typeScale.statSmall,
    textAlign: 'center',
  },

  // The daily targets, four tiles.
  targets: {
    flexDirection: 'row',
    gap: spacing.sm,
  },
  targetTile: {
    flex: 1,
    alignItems: 'center',
    gap: 1,
    paddingVertical: 6,
    borderRadius: radii.md,
    backgroundColor: colors.surfaceRaised,
  },
  targetLine: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 3,
    maxWidth: '100%',
  },
  targetValue: {
    ...typeScale.statSmall,
    color: colors.textPrimary,
    flexShrink: 1,
  },
  targetLabel: {
    ...typeScale.caption,
    color: colors.textSecondary,
  },
});
