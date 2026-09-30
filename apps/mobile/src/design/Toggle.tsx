import { Switch } from 'react-native';
import { colors } from './theme';

interface Props {
  value: boolean;
  onValueChange: (value: boolean) => void;
  disabled?: boolean;
  /** Defaults to colors.accent -- pass a contextual Workout/Nutrition accent where relevant. */
  accentColor?: string;
  /**
   * The thumb color while ON. Defaults to colors.background -- a plain dark
   * dot, safe against any accent. Pass the theme's own `onAccent` (already
   * computed to contrast against `accentColor`) when a screen has one --
   * without it, a white/near-white accent (the app's own default Workout
   * and Nutrition theme -- see accentColor.ts) makes an ON toggle nearly
   * unreadable: a white thumb on a white track, with no visible circle at
   * all. onAccent is guaranteed dark-on-light or light-on-dark against
   * `accentColor`, so the thumb reads as a distinct dot in either case.
   */
  onAccentColor?: string;
  accessibilityLabel: string;
  testID?: string;
}

// Component Logic: a thin theme wrapper around React Native's own Switch --
// no custom Animated/gesture implementation, since the native control
// already gives correct platform animation, disabled dimming, and
// accessibility switch semantics for free.
export function Toggle({
  value,
  onValueChange,
  disabled,
  accentColor = colors.accent,
  onAccentColor = colors.background,
  accessibilityLabel,
  testID,
}: Props) {
  return (
    <Switch
      testID={testID}
      value={value}
      onValueChange={onValueChange}
      disabled={disabled}
      trackColor={{ false: colors.divider, true: accentColor }}
      thumbColor={value ? onAccentColor : colors.textPrimary}
      ios_backgroundColor={colors.divider}
      accessibilityRole="switch"
      accessibilityLabel={accessibilityLabel}
      accessibilityState={{ disabled: Boolean(disabled), checked: value }}
    />
  );
}
