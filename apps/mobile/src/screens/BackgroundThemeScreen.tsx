import { useState } from 'react';
import { TouchableOpacity, View } from 'react-native';
import { Text } from '../design/Text';
import { Feather } from '@expo/vector-icons';
import { AppHeader } from '../design/AppHeader';
import { BackgroundThemePreview } from '../design/BackgroundThemePreview';
import { useBackgroundTheme } from '../design/BackgroundThemeContext';
import { PrimaryButton } from '../design/Button';
import { Screen } from '../design/Screen';
import { BACKGROUND_THEME_ORDER, BACKGROUND_THEMES } from '../design/backgroundThemes';
import type { RootStackScreenProps } from '../navigation/types';
import { useProgressTheme } from '../progress/useProgressTheme';
import { backgroundThemeScreenStyles as styles } from './backgroundThemeScreenStyles';

type Props = RootStackScreenProps<'BackgroundThemeSettings'>;

// Mirrors WorkoutColorScreen/AccentColorPickerScreen's shape (grid of
// selectable options, live preview per option, explicit Save) but for the
// Background Theme -- a separate configuration layer from Workout/Nutrition
// accent, which is why the selected-state colour here comes from the
// existing Workout accent (useProgressTheme) rather than anything defined
// by the background theme itself.
export function BackgroundThemeScreen({ navigation }: Props) {
  const { themeId, setThemeId } = useBackgroundTheme();
  const { theme: accent } = useProgressTheme();

  const [selected, setSelected] = useState(themeId);
  const [saving, setSaving] = useState(false);
  const [saveError, setSaveError] = useState<string | null>(null);

  async function handleSave() {
    setSaveError(null);
    setSaving(true);
    try {
      await setThemeId(selected);
      navigation.goBack();
    } catch (err) {
      setSaveError(err instanceof Error ? err.message : 'Failed to save');
    } finally {
      setSaving(false);
    }
  }

  return (
    <Screen
      scrollTestID="background-theme-scroll"
      contentContainerStyle={styles.scrollContent}
      header={
        <AppHeader
          title="Background Theme"
          leftAction={{
            icon: 'arrow-left',
            onPress: () => navigation.goBack(),
            accessibilityLabel: 'Back',
            testID: 'background-theme-back',
          }}
        />
      }
    >
      <View>
        <Text style={styles.subtitle}>
          Choose the atmosphere behind the app. Independent of your Workout and Nutrition accent
          colors.
        </Text>

        <View style={styles.grid}>
          {BACKGROUND_THEME_ORDER.map((id) => {
            const theme = BACKGROUND_THEMES[id];
            const isSelected = selected === id;
            return (
              <TouchableOpacity
                key={id}
                testID={`background-theme-tile-${id}`}
                style={[styles.tile, isSelected && { borderColor: accent.accent }]}
                onPress={() => setSelected(id)}
                accessibilityRole="button"
                accessibilityLabel={`${theme.name}. ${theme.description}`}
                accessibilityState={{ selected: isSelected }}
              >
                <View style={styles.swatch}>
                  <BackgroundThemePreview theme={theme} />
                  {isSelected ? (
                    <View style={[styles.checkBadge, { backgroundColor: accent.accent }]}>
                      <Feather name="check" size={13} color={accent.onAccent} />
                    </View>
                  ) : null}
                </View>
                <View style={styles.tileBody}>
                  <Text style={styles.tileName}>{theme.name}</Text>
                  <Text style={styles.tileDescription} numberOfLines={1}>
                    {theme.description}
                  </Text>
                </View>
              </TouchableOpacity>
            );
          })}
        </View>

        {saveError ? (
          <Text testID="background-theme-save-error" style={styles.saveError}>
            {saveError}
          </Text>
        ) : null}

        <View style={styles.saveButtonWrap}>
          <PrimaryButton
            testID="background-theme-save"
            label="Save Changes"
            onPress={handleSave}
            disabled={saving || selected === themeId}
            accentColor={accent.accent}
            onAccentColor={accent.onAccent}
          />
        </View>
      </View>
    </Screen>
  );
}
