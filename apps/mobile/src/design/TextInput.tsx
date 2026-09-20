import { useState, type ReactNode } from 'react';
import {
  StyleSheet,
  TextInput as RNTextInput,
  View,
  type KeyboardTypeOptions,
  type TextInputProps as RNTextInputProps,
} from 'react-native';
import { Text } from './Text';
import { colors, radii, spacing, typeScale } from './theme';

interface Props {
  label?: string;
  placeholder?: string;
  value: string;
  onChangeText: (text: string) => void;
  secureTextEntry?: boolean;
  keyboardType?: KeyboardTypeOptions;
  autoCapitalize?: RNTextInputProps['autoCapitalize'];
  autoComplete?: RNTextInputProps['autoComplete'];
  returnKeyType?: RNTextInputProps['returnKeyType'];
  onSubmitEditing?: () => void;
  /** Called when the field loses focus, after its own focus styling has been cleared. */
  onBlur?: () => void;
  /** Presence shows this message in the destructive color and switches the border to the error state. */
  error?: string;
  /** Shown in the muted color when there is no `error`. */
  helperText?: string;
  disabled?: boolean;
  leftAccessory?: ReactNode;
  rightAccessory?: ReactNode;
  testID?: string;
  accessibilityLabel?: string;
}

// Component Logic: one bordered row (label above, helper/error text below,
// optional accessory slots either side of the native TextInput) with a
// single `borderColor` computed from three booleans (error, focused,
// default) -- no per-state style variants to keep in sync, no nested
// wrapper beyond what the accessories require.
export function TextInput({
  label,
  placeholder,
  value,
  onChangeText,
  secureTextEntry,
  keyboardType,
  autoCapitalize,
  autoComplete,
  returnKeyType,
  onSubmitEditing,
  onBlur,
  error,
  helperText,
  disabled,
  leftAccessory,
  rightAccessory,
  testID,
  accessibilityLabel,
}: Props) {
  const [focused, setFocused] = useState(false);

  const borderColor = error ? colors.destructive : focused ? colors.textSecondary : colors.border;

  return (
    <View>
      {label ? <Text style={styles.label}>{label}</Text> : null}
      <View style={[styles.row, { borderColor }, disabled && styles.rowDisabled]}>
        {leftAccessory}
        <RNTextInput
          testID={testID}
          style={styles.input}
          placeholder={placeholder}
          placeholderTextColor={colors.textMuted}
          value={value}
          onChangeText={onChangeText}
          secureTextEntry={secureTextEntry}
          keyboardType={keyboardType}
          autoCapitalize={autoCapitalize}
          autoComplete={autoComplete}
          returnKeyType={returnKeyType}
          onSubmitEditing={onSubmitEditing}
          editable={!disabled}
          onFocus={() => setFocused(true)}
          onBlur={() => {
            setFocused(false);
            onBlur?.();
          }}
          accessibilityLabel={accessibilityLabel ?? label}
        />
        {rightAccessory}
      </View>
      {error ? (
        <Text testID={testID ? `${testID}-error` : undefined} style={styles.errorText}>
          {error}
        </Text>
      ) : helperText ? (
        <Text style={styles.helperText}>{helperText}</Text>
      ) : null}
    </View>
  );
}

const styles = StyleSheet.create({
  label: {
    ...typeScale.label,
    color: colors.textSecondary,
    marginBottom: spacing.xs,
  },
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: colors.surface,
    borderWidth: 1,
    borderRadius: radii.md,
    paddingHorizontal: spacing.md,
  },
  rowDisabled: {
    opacity: 0.5,
  },
  input: {
    flex: 1,
    paddingVertical: 12,
    color: colors.textPrimary,
    ...typeScale.body,
  },
  errorText: {
    ...typeScale.caption,
    color: colors.destructive,
    marginTop: spacing.xs,
  },
  helperText: {
    ...typeScale.caption,
    color: colors.textMuted,
    marginTop: spacing.xs,
  },
});
