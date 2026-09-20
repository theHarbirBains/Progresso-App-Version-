import { useState } from 'react';
import { TouchableOpacity, View } from 'react-native';
import { Text } from '../design/Text';
import { Feather } from '@expo/vector-icons';
import { AppCard } from '../design/AppCard';
import { Badge } from '../design/Badge';
import { colors } from '../design/theme';
import type { AccentTheme } from '../theme/accentColor';
import { materializeWorkoutSplitPreset } from './workoutSplitQueries';
import { WORKOUT_SPLIT_PRESETS, type WorkoutSplitPreset } from './workoutSplitPresets';
import { PRESET_DESCRIPTIONS, PRESET_ICONS } from './workoutSplitPresetDisplay';
import { workoutSplitPresetPickerStyles as styles } from './workoutSplitPresetPickerStyles';

interface Props {
  testID: string;
  userId: string;
  theme: AccentTheme;
  /** Called with the newly materialized+activated split's id once selection succeeds. */
  onPresetActivated: (splitId: string) => void;
  onCreateOwn: () => void;
}

/**
 * The preset-list + "Create Custom Split" picker shared by
 * ChooseWorkoutSplitScreen (reached from Settings/the tracking gate) and
 * the onboarding split step -- extracted so both use the exact same
 * materialize-and-activate logic rather than two copies of it. Visual
 * treatment (card layout, chips, icon circle, selected state) matches
 * ChooseWorkoutSplitScreen's own preset cards; only the surrounding header
 * differs, since onboarding renders its own title/progress bar around this.
 */
export function WorkoutSplitPresetPicker({
  testID,
  userId,
  theme,
  onPresetActivated,
  onCreateOwn,
}: Props) {
  const [busyPresetId, setBusyPresetId] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  async function handleSelectPreset(preset: WorkoutSplitPreset) {
    if (!userId || busyPresetId) return;
    setError(null);
    setBusyPresetId(preset.id);
    try {
      const split = await materializeWorkoutSplitPreset(userId, preset);
      onPresetActivated(split.id);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to select workout split');
      setBusyPresetId(null);
    }
  }

  return (
    <View testID={testID}>
      {error ? (
        <Text testID={`${testID}-error`} style={styles.errorText}>
          {error}
        </Text>
      ) : null}

      <View style={styles.presetList}>
        {WORKOUT_SPLIT_PRESETS.map((preset) => {
          const busy = busyPresetId === preset.id;
          const disabled = busyPresetId !== null && !busy;
          return (
            <AppCard
              key={preset.id}
              testID={`${testID}-preset-${preset.id}`}
              onPress={() => handleSelectPreset(preset)}
              style={[
                styles.presetCard,
                busy && { borderColor: theme.accent, borderWidth: 1.5 },
                disabled && { opacity: 0.4 },
              ]}
            >
              <View style={styles.cardTopRow}>
                <View style={[styles.iconCircle, busy && { backgroundColor: theme.accentBg }]}>
                  <Feather
                    name={PRESET_ICONS[preset.id] ?? 'layers'}
                    size={18}
                    color={colors.textPrimary}
                  />
                </View>
                <Text style={styles.presetName} numberOfLines={1}>
                  {preset.name}
                </Text>
                {busy ? (
                  <Feather
                    testID={`${testID}-preset-${preset.id}-selected`}
                    name="check-circle"
                    size={20}
                    color={theme.accent}
                  />
                ) : (
                  <Feather name="chevron-right" size={20} color={colors.textMuted} />
                )}
              </View>

              <Text style={styles.presetDescription}>{PRESET_DESCRIPTIONS[preset.id]}</Text>

              <View style={styles.chipRow}>
                {preset.days.map((day) => (
                  <Badge
                    key={day.name}
                    label={day.name}
                    color={colors.textSecondary}
                    backgroundColor={colors.surfaceRaised}
                  />
                ))}
              </View>
            </AppCard>
          );
        })}
      </View>

      <TouchableOpacity
        testID={`${testID}-create-own`}
        style={[styles.createSplitButton, { backgroundColor: theme.accent }]}
        onPress={onCreateOwn}
        accessibilityRole="button"
        accessibilityLabel="Create Custom Split"
      >
        <Feather name="edit-2" size={18} color={theme.onAccent} />
        <Text style={[styles.createSplitButtonText, { color: theme.onAccent }]}>
          Create Custom Split
        </Text>
      </TouchableOpacity>
    </View>
  );
}
