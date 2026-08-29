import { StyleSheet, Text, TouchableOpacity } from 'react-native';
import { colors, radii, spacing } from './theme';

interface ButtonProps {
  label: string;
  onPress: () => void;
  disabled?: boolean;
  testID?: string;
}

export function PrimaryButton({ label, onPress, disabled, testID }: ButtonProps) {
  return (
    <TouchableOpacity
      testID={testID}
      onPress={onPress}
      disabled={disabled}
      activeOpacity={0.85}
      style={[styles.primary, disabled && styles.disabled]}
    >
      <Text style={styles.primaryText}>{label}</Text>
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
    backgroundColor: colors.accent,
    borderRadius: radii.lg,
    paddingVertical: spacing.md + 2,
    alignItems: 'center',
  },
  primaryText: {
    color: colors.onAccent,
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
