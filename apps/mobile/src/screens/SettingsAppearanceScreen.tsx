import { useState } from 'react';
import { Alert, View } from 'react-native';
import { Text } from '../design/Text';
import { AppHeader } from '../design/AppHeader';
import { TextButton } from '../design/Button';
import { useBackgroundTheme } from '../design/BackgroundThemeContext';
import { LoadingState } from '../design/LoadingState';
import { ListRow } from '../design/ListRow';
import { Screen } from '../design/Screen';
import { Section } from '../design/Section';
import { BACKGROUND_THEMES } from '../design/backgroundThemes';
import type { RootStackScreenProps } from '../navigation/types';
import { useProfile } from '../profile/ProfileProvider';
import { findPresetName } from '../theme/accentPalette';
import { DEFAULT_NUTRITION_COLOR, DEFAULT_WORKOUT_COLOR } from '../theme/accentColor';
import { settingsStyles as styles } from '../settings/settingsStyles';

type Props = RootStackScreenProps<'SettingsAppearance'>;

// A colour swatch as a row's leading element -- the one bit of colour on the
// row, so it shows the actual value being chosen.
function Swatch({ color }: { color: string }) {
  return <View style={[styles.swatch, { backgroundColor: color }]} />;
}

/**
 * Appearance: the Background Theme and the two mode accent colours, each a
 * row that opens its own existing picker screen, plus a quiet destructive
 * Reset -- the same content AppearanceCategory (Settings' old in-screen tab)
 * had, now its own pushed subpage. No new behavior: every picker/reset
 * action is the same updateProfile call as before.
 */
export function SettingsAppearanceScreen({ navigation }: Props) {
  const { profile, loading, updateProfile } = useProfile();
  const { theme: backgroundTheme } = useBackgroundTheme();
  const [resetting, setResetting] = useState(false);
  const [saveError, setSaveError] = useState<string | null>(null);

  const workoutColor = profile?.workoutAccentColor ?? DEFAULT_WORKOUT_COLOR;
  const nutritionColor = profile?.nutritionAccentColor ?? DEFAULT_NUTRITION_COLOR;

  function handleResetThemeColors() {
    Alert.alert(
      'Reset Theme Colors',
      'This will restore Workout and Nutrition to the default Warm Amber.',
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Reset',
          style: 'destructive',
          onPress: async () => {
            setResetting(true);
            try {
              await updateProfile({
                workoutAccentColor: DEFAULT_WORKOUT_COLOR,
                nutritionAccentColor: DEFAULT_NUTRITION_COLOR,
              });
            } catch (err) {
              setSaveError(err instanceof Error ? err.message : 'Failed to reset theme colors');
            } finally {
              setResetting(false);
            }
          },
        },
      ],
    );
  }

  if (loading) {
    return <LoadingState testID="settings-appearance-loading" />;
  }

  return (
    <Screen
      testID="settings-appearance-screen"
      scrollTestID="settings-appearance-scroll"
      contentContainerStyle={styles.categoryGap}
      header={
        <AppHeader
          testID="settings-appearance-header"
          title="Appearance"
          onBack={() => navigation.goBack()}
        />
      }
    >
      <Section title="Background Theme">
        <ListRow
          testID="open-background-theme-settings"
          leading={<Swatch color={backgroundTheme.colors.background} />}
          title="Background Theme"
          value={BACKGROUND_THEMES[backgroundTheme.id].name}
          onPress={() => navigation.navigate('BackgroundThemeSettings')}
        />
      </Section>

      <Section title="Theme Colors">
        <ListRow
          testID="open-workout-color-settings"
          leading={<Swatch color={workoutColor} />}
          title="Workout Mode"
          value={findPresetName(workoutColor) ?? 'Custom'}
          onPress={() => navigation.navigate('WorkoutColorSettings')}
        />
        <ListRow
          testID="open-nutrition-color-settings"
          leading={<Swatch color={nutritionColor} />}
          title="Nutrition Mode"
          value={findPresetName(nutritionColor) ?? 'Custom'}
          divider
          onPress={() => navigation.navigate('NutritionColorSettings')}
        />
      </Section>

      {saveError ? (
        <Text testID="settings-appearance-error" style={styles.errorText}>
          {saveError}
        </Text>
      ) : null}

      <TextButton
        testID="reset-theme-colors"
        label="Reset Theme Colors"
        destructive
        loading={resetting}
        onPress={handleResetThemeColors}
      />
    </Screen>
  );
}
