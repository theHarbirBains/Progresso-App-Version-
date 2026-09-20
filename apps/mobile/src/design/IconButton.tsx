import { ActivityIndicator, StyleSheet, TouchableOpacity } from 'react-native';
import { Feather } from '@expo/vector-icons';
import { GlassBackground } from './GlassBackground';
import { colors, radii } from './theme';

interface Props {
  icon: keyof typeof Feather.glyphMap;
  onPress: () => void;
  accessibilityLabel: string;
  disabled?: boolean;
  loading?: boolean;
  /** Icon glyph color. Defaults to colors.textPrimary. */
  color?: string;
  /** Fills the circle with this color instead of the default bordered-surface
   * treatment -- e.g. an accent-filled action. Pass a matching `color`
   * (usually the accent's onAccent) alongside for readable contrast. */
  backgroundColor?: string;
  testID?: string;
}

// Component Logic: one 36x36 bordered circle (the exact treatment already
// repeated across several screens' hand-rolled "back button" styles) that
// renders either a Feather glyph or a loading spinner in its place --
// no variant enum, no extra wrapping Views, just color/backgroundColor
// props for the two visual states (default surface vs. accent-filled) that
// actually occur in the app today.
export function IconButton({
  icon,
  onPress,
  accessibilityLabel,
  disabled,
  loading,
  color = colors.textPrimary,
  backgroundColor,
  testID,
}: Props) {
  return (
    <TouchableOpacity
      testID={testID}
      style={[
        styles.button,
        backgroundColor ? { backgroundColor, borderWidth: 0 } : null,
        disabled && styles.disabled,
      ]}
      onPress={onPress}
      disabled={disabled || loading}
      activeOpacity={0.8}
      accessibilityRole="button"
      accessibilityLabel={accessibilityLabel}
      accessibilityState={{ disabled: Boolean(disabled) }}
    >
      {!backgroundColor ? <GlassBackground /> : null}
      {loading ? (
        <ActivityIndicator size="small" color={color} />
      ) : (
        <Feather name={icon} size={18} color={color} />
      )}
    </TouchableOpacity>
  );
}

const styles = StyleSheet.create({
  button: {
    width: 36,
    height: 36,
    borderRadius: radii.pill,
    alignItems: 'center',
    justifyContent: 'center',
    overflow: 'hidden',
  },
  disabled: {
    opacity: 0.5,
  },
});
