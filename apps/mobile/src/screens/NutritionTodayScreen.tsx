import { useEffect, useMemo, useState } from 'react';
import { StyleSheet, TextInput, View } from 'react-native';
import { Feather, MaterialCommunityIcons } from '@expo/vector-icons';
import { useAuth } from '../auth/AuthProvider';
import { Text } from '../design/Text';
import { AppCard } from '../design/AppCard';
import { AppHeader } from '../design/AppHeader';
import { PrimaryButton, SecondaryButton, TextButton } from '../design/Button';
import { EmptyState } from '../design/EmptyState';
import { Screen } from '../design/Screen';
import { Section } from '../design/Section';
import { SkeletonCards } from '../design/Skeleton';
import { StatBlock } from '../design/StatBlock';
import { colors, minTouchTarget, radii, spacing, typeScale, widgetGap } from '../design/theme';
import { useAppMenu } from '../navigation/AppMenuContext';
import type { RootStackScreenProps } from '../navigation/types';
import { useProgressTheme } from '../progress/useProgressTheme';
import { CalorieRing } from '../nutrition/CalorieRing';
import { FoodImage } from '../nutrition/FoodImage';
import { useFoodLog } from '../nutrition/FoodLogProvider';
import { getCurrentWeekRange } from '../dashboard/weeklyProgress';
import {
  fetchFoodLogsForDay,
  fetchFoodLogsForRange,
  type FoodLogRow,
} from '../nutrition/foodLogQueries';
import { servingMeasures, servingsFor, unitWord } from '../nutrition/logQuantity';
import {
  calculateRemaining,
  daysLeftInWeek,
  sumDailyTotals,
} from '../nutrition/nutritionCalculations';
import { useNutritionGoals } from '../nutrition/NutritionGoalsProvider';
import { type NutritionGoals } from '../nutrition/nutritionGoalQueries';
import { CopyYesterdaySheet, SaveAsMealSheet } from '../nutrition/TodayShortcutSheets';
import { WeeklyCalorieBudget } from '../nutrition/WeeklyCalorieBudget';

type Props = RootStackScreenProps<'Nutrition'>;

const EMPTY_GOALS: NutritionGoals = { calories: null, proteinG: null, carbsG: null, fatG: null };

type MacroKey = 'protein' | 'carbs' | 'fat';

// Each macro's glyph -- the same food-category glyph set as a food's picture
// (nutrition/foodGlyph.ts), in its quiet raised tile.
const MACRO_GLYPHS: Record<MacroKey, keyof typeof MaterialCommunityIcons.glyphMap> = {
  protein: 'food-drumstick-outline',
  carbs: 'barley',
  fat: 'water-outline',
};

function grams(value: number): string {
  return `${Math.round(value)}g`;
}

// The Nutrition tab's own root screen (see App.tsx's bottom nav) -- today's
// intake against the user's targets, with the day's logged foods.
//
// Layout: the shared Screen with a hamburger menu, then five widgets
// `widgetGap` apart, rising in like every other page's:
// - **Today** (the hero): the calorie ring and what's left on the left; on the
//   right, protein / carbs / fat, each with its glyph, what's been eaten against
//   the target and a thin bar of the way there.
// - **This Week**: the week's calorie budget -- 7 times the daily target, Monday to
//   Sunday -- against what's been eaten so far, as a bar, with what's left and the days
//   left to spread it over (WeeklyCalorieBudget).
// - **Actions**: Log Food, the one filled button, with Scan Barcode and Search
//   Food outlined side by side under it (two more ways into the same
//   LogFoodStep-backed logging flow). AI Food Search lives inside Food Library
//   (Log Food's destination) rather than as a fourth button here.
// - **Today's Foods**, with View All (Nutrition History): each food as a row --
//   its picture, its name, the values snapshotted when it was logged, an
//   editable quantity and a quiet Delete -- or, with none yet, a quiet empty
//   state offering to log the first. Under them, two quiet actions: Copy
//   Yesterday (when yesterday has foods -- a sheet of them, all ticked, logged
//   again now) and Save as Meal (when today has some -- a sheet to name them
//   and keep them as a saved meal in the Food Library).
// - **Daily Targets**, with Edit Targets (Nutrition Goals): the four targets as
//   stat blocks, "—" for one not set.
export function NutritionTodayScreen({ navigation }: Props) {
  const { user } = useAuth();
  const userId = user?.id;
  const { nutritionTheme } = useProgressTheme();
  const { openMenu } = useAppMenu();
  // Goals rarely change and are shared with ProfileScreen/NutritionGoalsScreen
  // via the same cache; today's logs are shared too (FoodLogProvider), write-
  // through from here, LogFoodStep (Food Library/Search/Barcode Scanner) and
  // Delete/quantity edits below -- none of that needs a re-fetch of its own
  // any more, from this screen or any other.
  const { goals: cachedGoals, loading: goalsLoading, error: goalsError } = useNutritionGoals();
  const goals = cachedGoals ?? EMPTY_GOALS;
  const { logs, loading: logsLoading, error: logsError, updateQuantity, removeLog } = useFoodLog();

  const [quantityInputs, setQuantityInputs] = useState<Record<string, string>>({});
  const [error, setError] = useState<string | null>(null);
  const [yesterdayLogs, setYesterdayLogs] = useState<FoodLogRow[]>([]);
  // Calories from this week's days before today; today's own come from the shared cache, so
  // logging a food moves the week's bar at once. Null while being read.
  const [earlierThisWeek, setEarlierThisWeek] = useState<number | null>(null);
  const [weekFailed, setWeekFailed] = useState(false);
  const [copyOpen, setCopyOpen] = useState(false);
  const [saveMealOpen, setSaveMealOpen] = useState(false);

  // Yesterday's foods, for Copy Yesterday. Read each time Today opens -- it's opened fresh on
  // every visit -- and only a shortcut, so a failure just leaves it out.
  useEffect(() => {
    if (!userId) return;
    let cancelled = false;
    const yesterday = new Date();
    yesterday.setDate(yesterday.getDate() - 1);
    fetchFoodLogsForDay(userId, yesterday)
      .then((rows) => {
        if (!cancelled) setYesterdayLogs(rows);
      })
      .catch(() => undefined);
    return () => {
      cancelled = true;
    };
  }, [userId]);

  // This week's days before today, for the week's calorie budget -- read each time Today opens,
  // like yesterday's. On a Monday there are none.
  useEffect(() => {
    if (!userId) return;
    let cancelled = false;
    const now = new Date();
    const { start: weekStart } = getCurrentWeekRange(now);
    const todayStart = new Date(now.getFullYear(), now.getMonth(), now.getDate());
    if (weekStart.getTime() >= todayStart.getTime()) {
      setEarlierThisWeek(0);
      return;
    }
    fetchFoodLogsForRange(userId, weekStart, todayStart)
      .then((rows) => {
        if (!cancelled) setEarlierThisWeek(sumDailyTotals(rows).calories);
      })
      .catch(() => {
        if (!cancelled) setWeekFailed(true);
      });
    return () => {
      cancelled = true;
    };
  }, [userId]);

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
  const remaining = useMemo(() => calculateRemaining(consumed, goals), [consumed, goals]);
  const displayError = error ?? goalsError ?? logsError;
  const accent = nutritionTheme.accent;

  // A log's amount is edited the way it was typed -- "2" cookies, "150" g -- and turned into
  // servings from the log's own serving snapshot. A log from before amounts were kept is in
  // servings.
  async function handleUpdateQuantity(log: FoodLogRow) {
    const amount = Number(quantityInputs[log.id]);
    const unit = log.enteredUnit ?? 'servings';
    if (!Number.isFinite(amount) || amount <= 0) return;
    if (amount === (log.enteredAmount ?? log.quantity)) return;
    const servings = servingsFor(amount, unit, servingMeasures(log));
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

  async function handleDelete(logId: string) {
    setError(null);
    try {
      await removeLog(logId);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to delete food log');
    }
  }

  const header = (
    <AppHeader
      testID="nutrition-today-header"
      title="Today"
      leftAction={{
        icon: 'menu',
        onPress: () => openMenu(),
        accessibilityLabel: 'Open menu',
        testID: 'nutrition-today-open-menu',
      }}
    />
  );

  if (goalsLoading || logsLoading) {
    return (
      <Screen header={header} contentContainerStyle={styles.content}>
        <SkeletonCards testID="nutrition-today-loading" heights={[216, 132, 176]} />
      </Screen>
    );
  }

  const macros: { key: MacroKey; label: string; consumed: number; goal: number | null }[] = [
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

  return (
    <Screen contentContainerStyle={styles.content} header={header}>
      {displayError ? (
        <Text testID="nutrition-today-error" style={styles.errorText}>
          {displayError}
        </Text>
      ) : null}

      <AppCard hero testID="nutrition-today-macros">
        <View style={styles.summary}>
          <View style={styles.ringColumn}>
            <CalorieRing
              testID="nutrition-today-calorie-ring"
              consumed={consumed.calories}
              goal={goals.calories}
              accentColor={accent}
              size={RING_SIZE}
              strokeWidth={12}
            />
            {remaining.calories !== null ? (
              <Text testID="calories-remaining" style={styles.ringRemaining}>
                {remaining.calories} cal remaining
              </Text>
            ) : null}
          </View>

          <View style={styles.macroColumn}>
            {macros.map((macro, index) => {
              const fraction =
                macro.goal !== null && macro.goal > 0
                  ? Math.min(macro.consumed / macro.goal, 1)
                  : 0;
              return (
                <View
                  key={macro.key}
                  testID={`${macro.key}-row`}
                  style={[styles.macroRow, index > 0 && styles.divider]}
                  accessible
                  accessibilityLabel={
                    macro.goal !== null
                      ? `${macro.label}, ${Math.round(macro.consumed)} of ${macro.goal} grams`
                      : `${macro.label}, ${Math.round(macro.consumed)} grams`
                  }
                >
                  <View style={styles.macroGlyph}>
                    <MaterialCommunityIcons
                      name={MACRO_GLYPHS[macro.key]}
                      size={18}
                      color={accent}
                    />
                  </View>
                  <View style={styles.macroBody}>
                    <Text style={styles.macroLabel}>{macro.label}</Text>
                    <View style={styles.macroFigures}>
                      <Text testID={`${macro.key}-consumed`} style={styles.macroValue}>
                        {grams(macro.consumed)}
                      </Text>
                      {macro.goal !== null ? (
                        <Text testID={`${macro.key}-goal`} style={styles.macroGoal}>
                          / {grams(macro.goal)}
                        </Text>
                      ) : null}
                    </View>
                    {macro.goal !== null ? (
                      <View style={styles.barTrack}>
                        <View
                          testID={`${macro.key}-bar`}
                          style={[
                            styles.barFill,
                            { width: `${fraction * 100}%`, backgroundColor: accent },
                          ]}
                        />
                      </View>
                    ) : null}
                  </View>
                </View>
              );
            })}
          </View>
        </View>
      </AppCard>

      <WeeklyCalorieBudget
        consumed={earlierThisWeek === null ? null : earlierThisWeek + consumed.calories}
        dailyTarget={goals.calories}
        daysLeft={daysLeftInWeek()}
        failed={weekFailed}
        accentColor={accent}
        onSetTarget={() => navigation.navigate('NutritionGoals')}
      />

      <AppCard testID="nutrition-today-actions" style={styles.actions}>
        <PrimaryButton
          testID="log-food-button"
          label="Log Food"
          icon="plus"
          onPress={() => navigation.navigate('FoodLibrary')}
          accentColor={accent}
          onAccentColor={nutritionTheme.onAccent}
        />
        <View style={styles.secondaryActions}>
          <View style={styles.secondaryAction}>
            <SecondaryButton
              testID="scan-barcode-button"
              label="Scan Barcode"
              icon="maximize"
              size="md"
              onPress={() => navigation.navigate('BarcodeScanner')}
            />
          </View>
          <View style={styles.secondaryAction}>
            <SecondaryButton
              testID="search-food-button"
              label="Search Food"
              icon="search"
              size="md"
              onPress={() => navigation.navigate('FoodSearch')}
            />
          </View>
        </View>
      </AppCard>

      <AppCard testID="nutrition-today-foods">
        <Section
          title="Today's Foods"
          action={{
            label: 'View All',
            onPress: () => navigation.navigate('NutritionHistory'),
            testID: 'nutrition-today-view-all',
          }}
        >
          {logs.length === 0 ? (
            <EmptyState
              testID="food-log-empty"
              icon={
                <View style={styles.emptyGlyph}>
                  <Feather name="coffee" size={22} color={colors.textSecondary} />
                </View>
              }
              title="No foods logged today"
              action={{
                label: 'Log Your First Meal',
                onPress: () => navigation.navigate('FoodLibrary'),
                testID: 'food-log-empty-log',
              }}
            />
          ) : (
            logs.map((log, index) => (
              <View
                key={log.id}
                testID={`food-log-row-${log.id}`}
                style={[styles.logRow, index > 0 && styles.divider]}
              >
                <FoodImage uri={log.imageUrl} name={log.foodNameSnapshot} size={44} />
                <View style={styles.logInfo}>
                  <Text style={styles.logName}>{log.foodNameSnapshot}</Text>
                  <Text style={styles.logMeta}>
                    {log.calories} cal · {log.proteinG}g protein · {log.carbsG}g carbs · {log.fatG}g
                    fat
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
                    keyboardType="decimal-pad"
                    value={quantityInputs[log.id] ?? ''}
                    onChangeText={(text) =>
                      setQuantityInputs((prev) => ({ ...prev, [log.id]: text }))
                    }
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
                <TextButton
                  testID={`food-log-delete-${log.id}`}
                  label="Delete"
                  accessibilityLabel={`Delete ${log.foodNameSnapshot}`}
                  destructive
                  onPress={() => handleDelete(log.id)}
                />
              </View>
            ))
          )}
          {yesterdayLogs.length > 0 || logs.some((log) => log.foodId !== null) ? (
            <View style={styles.foodShortcuts}>
              {yesterdayLogs.length > 0 ? (
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
          ) : null}
        </Section>
      </AppCard>

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

      <AppCard testID="nutrition-today-targets">
        <Section
          title="Daily Targets"
          action={{
            label: 'Edit Targets',
            onPress: () => navigation.navigate('NutritionGoals'),
            testID: 'nutrition-today-edit-targets',
          }}
          actionColor={accent}
        >
          <View style={styles.targets}>
            {targets.map((target) => (
              <StatBlock
                key={target.key}
                testID={`target-${target.key}`}
                value={target.value !== null ? `${target.value}${target.unit}` : '—'}
                label={target.label}
              />
            ))}
          </View>
        </Section>
      </AppCard>
    </Screen>
  );
}

const RING_SIZE = 128;

const styles = StyleSheet.create({
  content: {
    gap: widgetGap,
    paddingBottom: spacing.xxl,
  },
  errorText: {
    ...typeScale.callout,
    color: colors.destructive,
  },
  // Copy Yesterday and Save as Meal, under the day's foods.
  foodShortcuts: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginTop: spacing.sm,
  },

  // The hero: the ring on the left, the three macros on the right.
  summary: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.lg,
  },
  ringColumn: {
    alignItems: 'center',
    gap: spacing.sm,
  },
  ringRemaining: {
    ...typeScale.secondary,
    color: colors.textSecondary,
    textAlign: 'center',
    maxWidth: RING_SIZE,
  },
  macroColumn: {
    flex: 1,
  },
  macroRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.md,
    paddingVertical: spacing.sm,
  },
  divider: {
    borderTopWidth: StyleSheet.hairlineWidth,
    borderTopColor: colors.divider,
  },
  macroGlyph: {
    width: 36,
    height: 36,
    borderRadius: 18,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: colors.surfaceLift,
  },
  macroBody: {
    flex: 1,
  },
  macroLabel: {
    ...typeScale.secondary,
    color: colors.textSecondary,
  },
  macroFigures: {
    flexDirection: 'row',
    alignItems: 'baseline',
    justifyContent: 'space-between',
  },
  macroValue: {
    ...typeScale.statSmall,
    color: colors.textPrimary,
  },
  macroGoal: {
    ...typeScale.secondary,
    color: colors.textMuted,
  },
  barTrack: {
    height: 4,
    borderRadius: 2,
    marginTop: spacing.xs,
    backgroundColor: colors.surfaceRaised,
    overflow: 'hidden',
  },
  barFill: {
    height: '100%',
    borderRadius: 2,
  },

  actions: {
    gap: spacing.sm,
  },
  secondaryActions: {
    flexDirection: 'row',
    gap: spacing.sm,
  },
  secondaryAction: {
    flex: 1,
  },

  emptyGlyph: {
    width: 52,
    height: 52,
    borderRadius: 26,
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 1,
    borderColor: colors.border,
    marginBottom: spacing.xs,
  },
  logRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
    paddingVertical: spacing.md,
  },
  logInfo: {
    flex: 1,
  },
  logName: {
    ...typeScale.cardTitle,
    color: colors.textPrimary,
  },
  logMeta: {
    ...typeScale.secondary,
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
  quantityInput: {
    width: 64,
    height: minTouchTarget,
    borderRadius: radii.md,
    borderWidth: 1,
    borderColor: colors.border,
    backgroundColor: colors.surfaceRaised,
    color: colors.textPrimary,
    ...typeScale.statSmall,
    textAlign: 'center',
  },

  targets: {
    flexDirection: 'row',
    gap: spacing.sm,
  },
});
