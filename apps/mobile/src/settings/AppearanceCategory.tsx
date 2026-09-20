import { ActivityIndicator, StyleSheet, TouchableOpacity, View } from 'react-native';
import { Text } from '../design/Text';
import { Feather } from '@expo/vector-icons';
import { AppCard } from '../design/AppCard';
import { useBackgroundTheme } from '../design/BackgroundThemeContext';
import { SectionHeader } from '../design/SectionHeader';
import { colors, spacing } from '../design/theme';
import { BACKGROUND_THEMES } from '../design/backgroundThemes';
import { DEFAULT_NUTRITION_COLOR, DEFAULT_WORKOUT_COLOR } from '../theme/accentColor';
import { findPresetName } from '../theme/accentPalette';
import { settingsStyles as styles } from './settingsStyles';

interface Props {
  workoutAccentColor: string | null;
  nutritionAccentColor: string | null;
  resetting: boolean;
  onNavigateWorkoutColor: () => void;
  onNavigateNutritionColor: () => void;
  onNavigateBackgroundTheme: () => void;
  onResetThemeColors: () => void;
}

// Appearance is app-level/global (Settings, not "Workout Settings"), which is
// exactly why the Nutrition accent lives here alongside Workout's -- both
// are theme configuration, reusing the existing accentColor.ts/
// accentPalette.ts/buildAccentTheme() architecture unchanged. Background
// Theme (the app's environment/backdrop) is a third, independent
// configuration layer -- see design/BackgroundThemeContext.tsx -- listed in
// its own card so it reads as a separate choice from the two accent colors.
// Dark variants only for now: there is still no light/dark/system mode
// concept (Progresso's UI itself stays a single dark theme).
export function AppearanceCategory({
  workoutAccentColor,
  nutritionAccentColor,
  resetting,
  onNavigateWorkoutColor,
  onNavigateNutritionColor,
  onNavigateBackgroundTheme,
  onResetThemeColors,
}: Props) {
  const { theme: backgroundTheme } = useBackgroundTheme();

  return (
    <View style={styles.section}>
      <SectionHeader label="Background Theme" />
      <AppCard>
        <TouchableOpacity
          testID="open-background-theme-settings"
          style={styles.row}
          onPress={onNavigateBackgroundTheme}
        >
          <View style={[styles.swatch, { backgroundColor: backgroundTheme.colors.background }]} />
          <View style={styles.rowBody}>
            <Text style={styles.rowTitle}>Background Theme</Text>
            <Text style={styles.rowValue}>{BACKGROUND_THEMES[backgroundTheme.id].name}</Text>
          </View>
          <Feather name="chevron-right" size={20} color={colors.textMuted} />
        </TouchableOpacity>
      </AppCard>

      <SectionHeader label="Theme Colors" />
      <AppCard>
        <TouchableOpacity
          testID="open-workout-color-settings"
          style={styles.row}
          onPress={onNavigateWorkoutColor}
        >
          <View
            style={[
              styles.swatch,
              { backgroundColor: workoutAccentColor ?? DEFAULT_WORKOUT_COLOR },
            ]}
          />
          <View style={styles.rowBody}>
            <Text style={styles.rowTitle}>Workout Mode</Text>
            <Text style={styles.rowValue}>
              {findPresetName(workoutAccentColor ?? DEFAULT_WORKOUT_COLOR) ?? 'Custom'}
            </Text>
          </View>
          <Feather name="chevron-right" size={20} color={colors.textMuted} />
        </TouchableOpacity>

        <TouchableOpacity
          testID="open-nutrition-color-settings"
          style={[styles.row, styles.rowDivider]}
          onPress={onNavigateNutritionColor}
        >
          <View
            style={[
              styles.swatch,
              { backgroundColor: nutritionAccentColor ?? DEFAULT_NUTRITION_COLOR },
            ]}
          />
          <View style={styles.rowBody}>
            <Text style={styles.rowTitle}>Nutrition Mode</Text>
            <Text style={styles.rowValue}>
              {findPresetName(nutritionAccentColor ?? DEFAULT_NUTRITION_COLOR) ?? 'Custom'}
            </Text>
          </View>
          <Feather name="chevron-right" size={20} color={colors.textMuted} />
        </TouchableOpacity>
      </AppCard>

      <TouchableOpacity
        testID="reset-theme-colors"
        style={localStyles.resetButton}
        onPress={onResetThemeColors}
        disabled={resetting}
      >
        {resetting ? (
          <ActivityIndicator color={colors.destructive} />
        ) : (
          <Text style={localStyles.resetButtonText}>Reset Theme Colors</Text>
        )}
      </TouchableOpacity>
    </View>
  );
}

const localStyles = StyleSheet.create({
  resetButton: {
    alignItems: 'center',
    paddingVertical: spacing.md,
    marginTop: spacing.sm,
  },
  resetButtonText: {
    color: colors.destructive,
    fontSize: 14,
    fontWeight: '600',
  },
});
