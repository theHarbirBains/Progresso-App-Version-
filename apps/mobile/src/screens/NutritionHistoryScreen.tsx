import { useCallback, useEffect, useRef, useState } from 'react';
import { ActivityIndicator, View } from 'react-native';
import { Text } from '../design/Text';
import { useAuth } from '../auth/AuthProvider';
import { AppCard } from '../design/AppCard';
import { AppHeader } from '../design/AppHeader';
import { addMonths, isoToLocalDateKey, toLocalDateKey } from '../design/calendarGrid';
import { EmptyState } from '../design/EmptyState';
import { MonthCalendar } from '../design/MonthCalendar';
import { Screen } from '../design/Screen';
import { SectionHeader } from '../design/SectionHeader';
import { StatBlock } from '../design/StatBlock';
import { colors } from '../design/theme';
import { useAppMenu } from '../navigation/AppMenuContext';
import type { RootStackScreenProps } from '../navigation/types';
import { FoodImage } from '../nutrition/FoodImage';
import { fetchFoodLogsForMonth, type FoodLogRow } from '../nutrition/foodLogQueries';
import { computeNutritionMonthSummary } from '../nutrition/nutritionMonthSummary';
import { useProgressTheme } from '../progress/useProgressTheme';
import { nutritionHistoryStyles as styles } from './nutritionHistoryStyles';

type Props = RootStackScreenProps<'NutritionHistory'>;

// The Nutrition menu's history screen: a month calendar (a dot on every day
// with at least one food log, the same MonthCalendar Workout History's own
// calendar uses -- see design/MonthCalendar.tsx) and, once a day is
// selected, that day's logged foods. Unlike NutritionTodayScreen this is
// read-only browsing of the past, not the live "today" cache (FoodLogProvider
// only ever holds today's logs) -- there is no quantity edit or delete here.
export function NutritionHistoryScreen({ navigation }: Props) {
  const { user } = useAuth();
  const userId = user?.id ?? '';
  const { nutritionTheme } = useProgressTheme();
  const { openMenu } = useAppMenu();

  const now = new Date();
  const [year, setYear] = useState(now.getFullYear());
  const [month, setMonth] = useState(now.getMonth() + 1);
  const [selectedDateKey, setSelectedDateKey] = useState<string | null>(null);
  const todayKey = toLocalDateKey(now);

  const [monthLogs, setMonthLogs] = useState<FoodLogRow[]>([]);
  const [monthLoading, setMonthLoading] = useState(true);
  const [monthError, setMonthError] = useState<string | null>(null);

  // silent skips the setMonthLoading(true) that would otherwise blank the
  // calendar back to a spinner -- used only for the focus-listener's
  // background refresh below, once this screen has already loaded once.
  // Switching months always passes the default (loud), same as
  // WorkoutHistoryScreen's own loadMonth.
  const loadMonth = useCallback(
    async (targetYear: number, targetMonth: number, options: { silent?: boolean } = {}) => {
      if (!userId) return;
      if (!options.silent) setMonthLoading(true);
      setMonthError(null);
      try {
        setMonthLogs(await fetchFoodLogsForMonth(userId, targetYear, targetMonth));
      } catch (err) {
        setMonthError(err instanceof Error ? err.message : 'Failed to load nutrition history');
      } finally {
        setMonthLoading(false);
      }
    },
    [userId],
  );

  const hasLoadedOnce = useRef(false);

  useEffect(() => {
    const unsubscribe = navigation.addListener('focus', () => {
      loadMonth(year, month, { silent: hasLoadedOnce.current });
      hasLoadedOnce.current = true;
    });
    return unsubscribe;
  }, [navigation, loadMonth, year, month]);

  function handlePrevMonth() {
    const next = addMonths(year, month, -1);
    setYear(next.year);
    setMonth(next.month);
    setSelectedDateKey(null);
    loadMonth(next.year, next.month);
  }

  function handleNextMonth() {
    const next = addMonths(year, month, 1);
    setYear(next.year);
    setMonth(next.month);
    setSelectedDateKey(null);
    loadMonth(next.year, next.month);
  }

  function handleSelectDate(dateKey: string) {
    setSelectedDateKey((prev) => (prev === dateKey ? null : dateKey));
  }

  const markedDateKeys = new Set(monthLogs.map((log) => isoToLocalDateKey(log.loggedAt)));
  const monthSummary = computeNutritionMonthSummary(monthLogs);
  const selectedDayLogs = selectedDateKey
    ? monthLogs.filter((log) => isoToLocalDateKey(log.loggedAt) === selectedDateKey)
    : [];

  return (
    <Screen
      contentContainerStyle={styles.content}
      header={
        <AppHeader
          testID="nutrition-history-header"
          title="Nutrition History"
          leftAction={{
            icon: 'menu',
            onPress: () => openMenu(),
            accessibilityLabel: 'Open menu',
            testID: 'nutrition-history-open-menu',
          }}
        />
      }
    >
      <AppCard testID="nutrition-history-calendar-card">
        <MonthCalendar
          testID="nutrition-history-calendar"
          year={year}
          month={month}
          markedDateKeys={markedDateKeys}
          markedDescription="food logged"
          selectedDateKey={selectedDateKey}
          todayKey={todayKey}
          accentColor={nutritionTheme.accent}
          onAccentColor={nutritionTheme.onAccent}
          onSelectDate={handleSelectDate}
          onPrevMonth={handlePrevMonth}
          onNextMonth={handleNextMonth}
        />

        <View style={styles.legendRow}>
          <View style={styles.legendItem}>
            <View style={[styles.legendDot, { backgroundColor: nutritionTheme.accent }]} />
            <Text style={styles.legendLabel}>Food logged</Text>
          </View>
          <View style={styles.legendItem}>
            <View style={[styles.legendDot, { backgroundColor: colors.border }]} />
            <Text style={styles.legendLabel}>Nothing logged</Text>
          </View>
        </View>

        {monthError ? (
          <Text testID="nutrition-history-month-error" style={styles.errorText}>
            {monthError}
          </Text>
        ) : monthLoading ? (
          <View style={styles.loading}>
            <ActivityIndicator
              testID="nutrition-history-month-loading"
              size="large"
              color={colors.textPrimary}
            />
          </View>
        ) : (
          <View testID="nutrition-history-month-summary" style={styles.summaryRow}>
            <StatBlock
              testID="nutrition-history-days-logged"
              value={String(monthSummary.daysLogged)}
              label="Days Logged"
            />
            <StatBlock
              testID="nutrition-history-total-calories"
              value={String(monthSummary.totalCalories)}
              label="Total Calories"
            />
            <StatBlock
              testID="nutrition-history-avg-calories"
              value={String(monthSummary.avgCaloriesPerLoggedDay)}
              label="Avg Cal/Day"
            />
          </View>
        )}
      </AppCard>

      {selectedDateKey ? (
        <AppCard testID="nutrition-history-selected-day">
          <SectionHeader
            label={new Date(selectedDateKey).toLocaleDateString(undefined, {
              weekday: 'long',
              month: 'long',
              day: 'numeric',
            })}
          />
          {selectedDayLogs.length > 0 ? (
            selectedDayLogs.map((log, index) => (
              <View
                key={log.id}
                testID={`nutrition-history-log-row-${log.id}`}
                style={[styles.logRow, index > 0 && styles.logRowDivider]}
              >
                <FoodImage uri={log.imageUrl} name={log.foodNameSnapshot} size={44} />
                <View style={styles.logInfo}>
                  <Text style={styles.logName}>{log.foodNameSnapshot}</Text>
                  <Text style={styles.logMeta}>
                    {log.calories} cal · {log.proteinG}g protein · {log.carbsG}g carbs · {log.fatG}g
                    fat
                  </Text>
                </View>
              </View>
            ))
          ) : (
            <EmptyState testID="nutrition-history-day-empty" title="No food logged on this day" />
          )}
        </AppCard>
      ) : null}
    </Screen>
  );
}
