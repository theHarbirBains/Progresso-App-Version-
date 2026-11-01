import { useEffect } from 'react';
import { useAuth } from '../auth/AuthProvider';
import { useFoodLog } from '../nutrition/FoodLogProvider';
import { useNutritionGoals } from '../nutrition/NutritionGoalsProvider';
import { sumDailyTotals, type NutritionGoalValues } from '../nutrition/nutritionCalculations';
import { useAppTheme } from '../theme/appThemeContext';
import { applyWidgetTheme, clearWidgets, showNutritionWidget } from './widgetUpdates';

const NO_TARGETS: NutritionGoalValues = {
  calories: null,
  proteinG: null,
  carbsG: null,
  fatG: null,
};

/**
 * Keeps Today's Nutrition in step with the app, from the same shared food log and daily targets
 * Nutrition shows -- every log, edit, delete and target save reaches it with no fetch of its own
 * -- dresses every widget in the app's theme whenever it changes (Settings > Appearance, or the
 * season turning), and clears every widget on sign-out. Mounted once, inside the providers
 * (App.tsx).
 */
export function WidgetSync() {
  const { status } = useAuth();
  const { logs, loading: logsLoading, error: logsError } = useFoodLog();
  const { goals, loading: goalsLoading, error: goalsError } = useNutritionGoals();
  const { theme, loaded: themeLoaded } = useAppTheme();

  useEffect(() => {
    // Once the saved choice is read, so the widgets never wear the original look by mistake.
    if (themeLoaded) void applyWidgetTheme(theme);
  }, [theme, themeLoaded]);

  useEffect(() => {
    if (status === 'signedOut') void clearWidgets();
  }, [status]);

  useEffect(() => {
    // Only once both are really known: never a half-loaded day, nor a failed read's empty one.
    if (status !== 'signedIn' || logsLoading || goalsLoading || logsError || goalsError) return;
    void showNutritionWidget(sumDailyTotals(logs), goals ?? NO_TARGETS);
  }, [status, logs, goals, logsLoading, goalsLoading, logsError, goalsError]);

  return null;
}
