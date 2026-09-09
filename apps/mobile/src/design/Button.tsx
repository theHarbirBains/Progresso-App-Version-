import { StyleSheet, Text, TouchableOpacity } from 'react-native';
import { colors, radii, spacing } from './theme';

interface ButtonProps {
  label: string;
  onPress: () => void;
  disabled?: boolean;
  testID?: string;
}

interface PrimaryButtonProps extends ButtonProps {
  /** Defaults to colors.accent -- pass a contextual Workout/Nutrition accent where the button should follow the user's chosen theme color rather than the static brand accent (same override pattern as SegmentedControl/Toggle). */
  accentColor?: string;
  onAccentColor?: string;
}

export function PrimaryButton({
  label,
  onPress,
  disabled,
  testID,
  accentColor = colors.accent,
  onAccentColor = colors.onAccent,
}: PrimaryButtonProps) {
  return (
    <TouchableOpacity
      testID={testID}
      onPress={onPress}
      disabled={disabled}
      activeOpacity={0.85}
      style={[styles.primary, { backgroundColor: accentColor }, disabled && styles.disabled]}
    >
      <Text style={[styles.primaryText, { color: onAccentColor }]}>{label}</Text>
    </TouchableOpacity>
  );
}

export function SecondaryButton({ label, onPress, disabled, testID }: ButtonProps) {
  return (
    <TouchableOpacity
      testID={testID}
      onPress={onPress}
      disabled={disabled}
      activeOpacity={0.85}
      style={[styles.secondary, disabled && styles.disabled]}
    >
      <Text style={styles.secondaryText}>{label}</Text>
    </TouchableOpacity>
  );
}

export function DestructiveButton({ label, onPress, disabled, testID }: ButtonProps) {
  return (
    <TouchableOpacity
      testID={testID}
      onPress={onPress}
      disabled={disabled}
      activeOpacity={0.85}
      style={[styles.destructive, disabled && styles.disabled]}
    >
      <Text style={styles.destructiveText}>{label}</Text>
    </TouchableOpacity>
  );
}

export function TextButton({ label, onPress, disabled, testID }: ButtonProps) {
  return (
    <TouchableOpacity testID={testID} onPress={onPress} disabled={disabled} activeOpacity={0.7}>
      <Text style={[styles.textLink, disabled && styles.disabled]}>{label}</Text>
    </TouchableOpacity>
  );
}

const styles = StyleSheet.create({
  primary: {
    // backgroundColor is always supplied inline (accentColor prop, default
    // colors.accent) -- not set here, so there is no stale value to fall out
    // of sync with the actual default.
    borderRadius: radii.lg,
    paddingVertical: spacing.md + 2,
    alignItems: 'center',
  },
  primaryText: {
    // color likewise always supplied inline (onAccentColor prop).
    fontSize: 16,
    fontWeight: '700',
  },
  secondary: {
    borderRadius: radii.lg,
    borderWidth: 1,
    borderColor: colors.border,
    paddingVertical: spacing.md + 2,
    alignItems: 'center',
  },
  secondaryText: {
    color: colors.textPrimary,
    fontSize: 15,
    fontWeight: '600',
  },
  destructive: {
    borderRadius: radii.lg,
    borderWidth: 1,
    borderColor: colors.destructiveBorder,
    paddingVertical: spacing.md + 2,
    alignItems: 'center',
  },
  destructiveText: {
    color: colors.destructive,
    fontSize: 15,
    fontWeight: '600',
  },
  textLink: {
    color: colors.textSecondary,
    fontSize: 14,
  },
  disabled: {
    opacity: 0.5,
  },
});
