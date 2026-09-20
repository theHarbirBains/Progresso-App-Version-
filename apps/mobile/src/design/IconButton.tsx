import { ActivityIndicator, StyleSheet, TouchableOpacity } from 'react-native';
import { Feather } from '@expo/vector-icons';
import { GlassBackground } from './GlassBackground';
import { colors, minTouchTarget, radii } from './theme';

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

const VISIBLE_SIZE = 36;
const HIT_INSET = (minTouchTarget - VISIBLE_SIZE) / 2;
const ICON_BUTTON_HIT_SLOP = {
  top: HIT_INSET,
  bottom: HIT_INSET,
  left: HIT_INSET,
  right: HIT_INSET,
} as const;

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
      // The 36pt circle is the visible size; the touch area is extended to
      // the 44pt minimum (see theme.minTouchTarget) without changing it.
      hitSlop={ICON_BUTTON_HIT_SLOP}
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
    width: VISIBLE_SIZE,
    height: VISIBLE_SIZE,
    borderRadius: radii.pill,
    alignItems: 'center',
    justifyContent: 'center',
    overflow: 'hidden',
  },
  disabled: {
    opacity: 0.5,
  },
});
