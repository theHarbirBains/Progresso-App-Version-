import { View } from 'react-native';
import { TextButton } from '../design/Button';
import { useBackgroundTheme } from '../design/BackgroundThemeContext';
import { ListRow } from '../design/ListRow';
import { Section } from '../design/Section';
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

// A colour swatch as a row's leading element -- the one bit of colour on the
// row, so it shows the actual value being chosen.
function Swatch({ color }: { color: string }) {
  return <View style={[styles.swatch, { backgroundColor: color }]} />;
}

/** Appearance category: the Background Theme and the two mode accent colours, each a row that opens its own picker, plus a quiet destructive Reset. */
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
  const workoutColor = workoutAccentColor ?? DEFAULT_WORKOUT_COLOR;
  const nutritionColor = nutritionAccentColor ?? DEFAULT_NUTRITION_COLOR;

  return (
    <View style={styles.categoryGap}>
      <Section title="Background Theme">
        <ListRow
          testID="open-background-theme-settings"
          leading={<Swatch color={backgroundTheme.colors.background} />}
          title="Background Theme"
          value={BACKGROUND_THEMES[backgroundTheme.id].name}
          onPress={onNavigateBackgroundTheme}
        />
      </Section>

      <Section title="Theme Colors">
        <ListRow
          testID="open-workout-color-settings"
          leading={<Swatch color={workoutColor} />}
          title="Workout Mode"
          value={findPresetName(workoutColor) ?? 'Custom'}
          onPress={onNavigateWorkoutColor}
        />
        <ListRow
          testID="open-nutrition-color-settings"
          leading={<Swatch color={nutritionColor} />}
          title="Nutrition Mode"
          value={findPresetName(nutritionColor) ?? 'Custom'}
          divider
          onPress={onNavigateNutritionColor}
        />
      </Section>

      <TextButton
        testID="reset-theme-colors"
        label="Reset Theme Colors"
        destructive
        loading={resetting}
        onPress={onResetThemeColors}
      />
    </View>
  );
}
