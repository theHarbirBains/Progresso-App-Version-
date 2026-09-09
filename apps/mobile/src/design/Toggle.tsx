import { Switch } from 'react-native';
import { colors } from './theme';

interface Props {
  value: boolean;
  onValueChange: (value: boolean) => void;
  disabled?: boolean;
  /** Defaults to colors.accent -- pass a contextual Workout/Nutrition accent where relevant. */
  accentColor?: string;
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
      thumbColor={colors.textPrimary}
      ios_backgroundColor={colors.divider}
      accessibilityRole="switch"
      accessibilityLabel={accessibilityLabel}
      accessibilityState={{ disabled: Boolean(disabled), checked: value }}
    />
  );
}
