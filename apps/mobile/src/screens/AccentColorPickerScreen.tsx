import { useState } from 'react';
import { TouchableOpacity, View } from 'react-native';
import { Text } from '../design/Text';
import { Feather } from '@expo/vector-icons';
import { Circle, Svg } from 'react-native-svg';
import { AppHeader } from '../design/AppHeader';
import { PrimaryButton } from '../design/Button';
import { Screen } from '../design/Screen';
import { colors, spacing } from '../design/theme';
import { ACCENT_PRESET_GROUPS, findPresetName } from '../theme/accentPalette';
import { buildAccentTheme, type AccentTheme } from '../theme/accentColor';
import { RgbSliderPicker } from './RgbSliderPicker';
import { accentColorPickerStyles as styles } from './accentColorPickerStyles';

export type AccentPreviewKind = 'workout' | 'nutrition';

// A fixed, purely illustrative fill amount for the preview's progress
// bar/ring -- never real workout or nutrition data (per the "no fake fitness
// data" requirement), just enough to show the accent color as a fill.
const PREVIEW_FILL = 0.62;

// Small, self-contained mockup of how the chosen accent will look across the
// app -- built independently of DashboardScreen (not a reuse of its JSX),
// so this never touches or risks the real Dashboard.
function AccentPreview({ theme, kind }: { theme: AccentTheme; kind: AccentPreviewKind }) {
  const size = 56;
  const strokeWidth = 6;
  const radius = (size - strokeWidth) / 2;
  const circumference = 2 * Math.PI * radius;

  return (
    <View>
      <View style={styles.previewTopRow}>
        <View style={styles.previewSegmentToggle}>
          <View
            style={[styles.previewSegment, kind === 'workout' && { backgroundColor: theme.accent }]}
          >
            <Feather
              name="activity"
              size={13}
              color={kind === 'workout' ? theme.onAccent : colors.textSecondary}
            />
            <Text
              style={[styles.previewSegmentText, kind === 'workout' && { color: theme.onAccent }]}
            >
              Workout
            </Text>
          </View>
          <View
            style={[
              styles.previewSegment,
              kind === 'nutrition' && { backgroundColor: theme.accent },
            ]}
          >
            <Feather
              name="pie-chart"
              size={13}
              color={kind === 'nutrition' ? theme.onAccent : colors.textSecondary}
            />
            <Text
              style={[styles.previewSegmentText, kind === 'nutrition' && { color: theme.onAccent }]}
            >
              Nutrition
            </Text>
          </View>
        </View>
        <View style={[styles.previewIconBox, { backgroundColor: theme.accentBg }]}>
          <Feather
            name={kind === 'workout' ? 'trending-up' : 'target'}
            size={16}
            color={theme.accent}
          />
        </View>
      </View>

      {kind === 'nutrition' ? (
        <View style={styles.previewRingBlock}>
          <View style={{ width: size, height: size }}>
            <Svg width={size} height={size}>
              <Circle
                cx={size / 2}
                cy={size / 2}
                r={radius}
                stroke={colors.surfaceRaised}
                strokeWidth={strokeWidth}
                fill="none"
              />
              <Circle
                cx={size / 2}
                cy={size / 2}
                r={radius}
                stroke={theme.accent}
                strokeWidth={strokeWidth}
                strokeDasharray={`${circumference} ${circumference}`}
                strokeDashoffset={circumference * (1 - PREVIEW_FILL)}
                strokeLinecap="round"
                fill="none"
                rotation={-90}
                origin={`${size / 2}, ${size / 2}`}
              />
            </Svg>
          </View>
          <View style={{ flex: 1 }}>
            <Text style={styles.previewProgressLabel}>Macro progress</Text>
            <View style={styles.previewProgressTrack}>
              <View
                style={[
                  styles.previewProgressFill,
                  { width: `${PREVIEW_FILL * 100}%`, backgroundColor: theme.accent },
                ]}
              />
            </View>
          </View>
        </View>
      ) : (
        <View style={{ marginBottom: spacing.md }}>
          <Text style={styles.previewProgressLabel}>Progress</Text>
          <View style={styles.previewProgressTrack}>
            <View
              style={[
                styles.previewProgressFill,
                { width: `${PREVIEW_FILL * 100}%`, backgroundColor: theme.accent },
              ]}
            />
          </View>
        </View>
      )}

      <View style={styles.previewRow}>
        <View style={[styles.previewButton, { backgroundColor: theme.accent }]}>
          <Text style={[styles.previewButtonText, { color: theme.onAccent }]}>Primary Action</Text>
        </View>
        {kind === 'workout' ? (
          <View style={[styles.previewCard, { borderLeftColor: theme.accent }]}>
            <Feather name="award" size={16} color={theme.accent} />
            <Text style={styles.previewCardLabel}>Card</Text>
          </View>
        ) : null}
      </View>

      <View style={styles.previewNavRow}>
        <Feather name="home" size={16} color={theme.accent} />
        <Text style={[styles.previewNavLabel, { color: theme.accent }]}>Home (selected)</Text>
      </View>
    </View>
  );
}

interface Props {
  title: string;
  subtitle: string;
  initialColor: string;
  previewKind: AccentPreviewKind;
  saving: boolean;
  saveError: string | null;
  onSave: (hex: string) => void;
  onBack: () => void;
}

// Shared UI for both Workout Mode Color and Nutrition Mode Color -- the two
// screens differ only in title/subtitle/current-value/preview-shape, so the
// bulk of the picker (palette grid, custom color, live preview) lives here
// once rather than being duplicated per mode.
export function AccentColorPickerScreen({
  title,
  subtitle,
  initialColor,
  previewKind,
  saving,
  saveError,
  onSave,
  onBack,
}: Props) {
  const [selectedColor, setSelectedColor] = useState(initialColor);
  const [customMode, setCustomMode] = useState(findPresetName(initialColor) === null);

  const theme = buildAccentTheme(selectedColor);

  return (
    <Screen
      scrollTestID="accent-color-picker-scroll"
      contentContainerStyle={styles.scrollContent}
      header={
        <AppHeader
          title={title}
          leftAction={{
            icon: 'arrow-left',
            onPress: onBack,
            accessibilityLabel: 'Back',
            testID: 'accent-color-picker-back',
          }}
        />
      }
    >
      <Text style={styles.subtitle}>{subtitle}</Text>

      <View style={styles.section}>
        <Text style={styles.groupLabel}>Preview</Text>
        <AccentPreview theme={theme} kind={previewKind} />
      </View>

      {ACCENT_PRESET_GROUPS.map((group) => (
        <View key={group.label} style={styles.section}>
          <Text style={styles.groupLabel}>{group.label}</Text>
          <View style={styles.swatchGrid}>
            {group.colors.map((preset) => {
              const isSelected = !customMode && preset.hex.toUpperCase() === selectedColor;
              const presetTheme = buildAccentTheme(preset.hex);
              return (
                <TouchableOpacity
                  key={preset.hex}
                  testID={`preset-swatch-${preset.hex}`}
                  style={styles.swatchItem}
                  onPress={() => {
                    setSelectedColor(preset.hex.toUpperCase());
                    setCustomMode(false);
                  }}
                  accessibilityLabel={preset.name}
                  accessibilityRole="button"
                  accessibilityState={{ selected: isSelected }}
                >
                  <View
                    style={[
                      styles.swatchCircle,
                      { backgroundColor: preset.hex },
                      isSelected && styles.swatchCircleSelected,
                    ]}
                  >
                    {isSelected ? (
                      <Feather name="check" size={16} color={presetTheme.onAccent} />
                    ) : null}
                  </View>
                  <Text style={styles.swatchName} numberOfLines={1}>
                    {preset.name}
                  </Text>
                </TouchableOpacity>
              );
            })}
          </View>
        </View>
      ))}

      <View style={styles.section}>
        <Text style={styles.groupLabel}>Custom Color</Text>
        <View style={styles.swatchGrid}>
          <TouchableOpacity
            testID="open-custom-color"
            style={styles.swatchItem}
            onPress={() => setCustomMode(true)}
            accessibilityLabel="Custom Color"
            accessibilityRole="button"
            accessibilityState={{ selected: customMode }}
          >
            <View
              style={[
                styles.swatchCircle,
                styles.customSwatchCircle,
                customMode && styles.swatchCircleSelected,
              ]}
            >
              <Feather name="droplet" size={16} color={colors.textPrimary} />
            </View>
            <Text style={styles.swatchName}>Custom</Text>
          </TouchableOpacity>
        </View>

        {customMode ? (
          <View style={styles.customColorCard}>
            <RgbSliderPicker value={selectedColor} onChange={(hex) => setSelectedColor(hex)} />
          </View>
        ) : null}
      </View>

      {saveError ? (
        <Text testID="accent-color-save-error" style={styles.saveError}>
          {saveError}
        </Text>
      ) : null}

      <PrimaryButton
        testID="accent-color-save"
        label="Save"
        onPress={() => onSave(selectedColor)}
        loading={saving}
        accentColor={theme.accent}
        onAccentColor={theme.onAccent}
      />
    </Screen>
  );
}
