import { useState } from 'react';
import { ScrollView, Text, TouchableOpacity, View } from 'react-native';
import { Feather } from '@expo/vector-icons';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { BackgroundThemePreview } from '../design/BackgroundThemePreview';
import { useBackgroundTheme } from '../design/BackgroundThemeContext';
import { PrimaryButton } from '../design/Button';
import { colors, spacing } from '../design/theme';
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
  const insets = useSafeAreaInsets();
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
    <View style={[styles.screen, { paddingTop: insets.top }]}>
      <ScrollView
        testID="background-theme-scroll"
        contentContainerStyle={{ paddingBottom: insets.bottom + spacing.xxxl }}
      >
        <View style={styles.scrollContent}>
          <View style={styles.headerRow}>
            <TouchableOpacity
              testID="background-theme-back"
              style={styles.backButton}
              onPress={() => navigation.goBack()}
              accessibilityLabel="Back"
              accessibilityRole="button"
            >
              <Feather name="arrow-left" size={18} color={colors.textPrimary} />
            </TouchableOpacity>
            <Text style={styles.title}>Background Theme</Text>
          </View>
          <Text style={styles.subtitle}>
            Choose the atmosphere behind the app. Independent of your Workout and Nutrition
            accent colors.
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
      </ScrollView>
    </View>
  );
}
