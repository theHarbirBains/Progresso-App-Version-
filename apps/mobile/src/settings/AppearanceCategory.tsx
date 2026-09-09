import { ActivityIndicator, StyleSheet, Text, TouchableOpacity, View } from 'react-native';
import { Feather } from '@expo/vector-icons';
import { AppCard } from '../design/AppCard';
import { SectionHeader } from '../design/SectionHeader';
import { colors, spacing } from '../design/theme';
import { DEFAULT_NUTRITION_COLOR, DEFAULT_WORKOUT_COLOR } from '../theme/accentColor';
import { findPresetName } from '../theme/accentPalette';
import { settingsStyles as styles } from './settingsStyles';

interface Props {
  workoutAccentColor: string | null;
  nutritionAccentColor: string | null;
  resetting: boolean;
  onNavigateWorkoutColor: () => void;
  onNavigateNutritionColor: () => void;
  onResetThemeColors: () => void;
}

// Appearance is app-level/global (Settings, not "Workout Settings"), which is
// exactly why the Nutrition accent lives here alongside Workout's -- both
// are theme configuration, reusing the existing accentColor.ts/
// accentPalette.ts/buildAccentTheme() architecture unchanged. There is no
// light/dark/system appearance concept anywhere in the app today (Progresso
// is a single dark theme), so this category deliberately doesn't invent one.
export function AppearanceCategory({
  workoutAccentColor,
  nutritionAccentColor,
  resetting,
  onNavigateWorkoutColor,
  onNavigateNutritionColor,
  onResetThemeColors,
}: Props) {
  return (
    <View style={styles.section}>
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
