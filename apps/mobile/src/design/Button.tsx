import {
  ActivityIndicator,
  StyleSheet,
  TouchableOpacity,
  View,
  type TextStyle,
} from 'react-native';
import { Feather } from '@expo/vector-icons';
import { Text } from './Text';
import { colors, fonts, minTouchTarget, radii, spacing } from './theme';
import { useAppTheme } from '../theme/appThemeContext';

export type ButtonSize = 'lg' | 'md' | 'sm';

interface ButtonProps {
  label: string;
  onPress: () => void;
  disabled?: boolean;
  /** Replaces the label with a spinner and blocks presses -- the one place a "saving..." state lives, instead of each screen hand-rolling its own. */
  loading?: boolean;
  /** `lg` (default) is the full-width primary action; `md` is a standard inline action; `sm` is compact, and still exposes a 44pt touch area. */
  size?: ButtonSize;
  /** Defaults to the label. Only override when the visible label alone would be ambiguous out of context. */
  accessibilityLabel?: string;
  /** An optional Feather glyph before the label, in the label's colour. */
  icon?: keyof typeof Feather.glyphMap;
  testID?: string;
}

interface PrimaryButtonProps extends ButtonProps {
  /** Defaults to the app theme's accent (and its ink) -- pass a colour only where the button must differ. */
  accentColor?: string;
  onAccentColor?: string;
}

// The four variants below share one implementation of everything that isn't
// a color: the pressable frame, sizing, the 44pt minimum touch target, the
// disabled/loading rules, and the accessibility contract (role, label, and
// `disabled`/`busy` state). A screen should never hand-roll a button --
// pick a variant and a size.
const SIZE_STYLE = {
  lg: { minHeight: 52, paddingHorizontal: spacing.xl },
  md: { minHeight: minTouchTarget, paddingHorizontal: spacing.lg },
  sm: { minHeight: 36, paddingHorizontal: spacing.md },
} as const;

// `sm` is visibly shorter than the 44pt minimum, so its touch area is
// extended (not its appearance) to meet it.
const SM_HIT_SLOP = { top: 4, bottom: 4, left: 0, right: 0 } as const;

const LABEL_SIZE = { lg: 16, md: 15, sm: 14 } as const;
const ICON_SIZE = { lg: 18, md: 17, sm: 16 } as const;

function Frame({
  size = 'lg',
  variantStyle,
  label,
  labelStyle,
  spinnerColor,
  onPress,
  disabled,
  loading,
  accessibilityLabel,
  icon,
  testID,
}: ButtonProps & {
  variantStyle: object | object[];
  labelStyle: TextStyle;
  spinnerColor: string;
}) {
  const blocked = Boolean(disabled || loading);
  return (
    <TouchableOpacity
      testID={testID}
      onPress={onPress}
      disabled={blocked}
      activeOpacity={0.85}
      hitSlop={size === 'sm' ? SM_HIT_SLOP : undefined}
      accessibilityRole="button"
      accessibilityLabel={accessibilityLabel ?? label}
      accessibilityState={{ disabled: blocked, busy: Boolean(loading) }}
      style={[styles.base, SIZE_STYLE[size], variantStyle, disabled && styles.disabled]}
    >
      {loading ? (
        <ActivityIndicator size="small" color={spinnerColor} />
      ) : icon ? (
        <View style={styles.iconRow}>
          <Feather name={icon} size={ICON_SIZE[size]} color={labelStyle.color as string} />
          <Text style={[{ fontSize: LABEL_SIZE[size] }, labelStyle]}>{label}</Text>
        </View>
      ) : (
        <Text style={[{ fontSize: LABEL_SIZE[size] }, labelStyle]}>{label}</Text>
      )}
    </TouchableOpacity>
  );
}

export function PrimaryButton({
  accentColor: accentColorProp,
  onAccentColor: onAccentColorProp,
  ...props
}: PrimaryButtonProps) {
  // Unless told otherwise, the app theme's accent and the ink that reads on it.
  const themeAccent = useAppTheme().accent;
  const accentColor = accentColorProp ?? themeAccent.accent;
  const onAccentColor = onAccentColorProp ?? themeAccent.onAccent;
  return (
    <Frame
      {...props}
      // backgroundColor is always supplied inline (accentColor prop, default
      // the theme's accent) -- not set in the stylesheet, so there is no stale
      // value to fall out of sync with the actual default. The label color
      // likewise always comes from onAccentColor.
      variantStyle={{ backgroundColor: accentColor }}
      labelStyle={{ color: onAccentColor, fontFamily: fonts.display }}
      spinnerColor={onAccentColor}
    />
  );
}

export function SecondaryButton(props: ButtonProps) {
  return (
    <Frame
      {...props}
      variantStyle={styles.secondary}
      labelStyle={styles.secondaryText}
      spinnerColor={colors.textPrimary}
    />
  );
}

export function DestructiveButton(props: ButtonProps) {
  return (
    <Frame
      {...props}
      variantStyle={styles.destructive}
      labelStyle={styles.destructiveText}
      spinnerColor={colors.destructive}
    />
  );
}

// A plain text action with no container -- a quiet link ("Forgot password?",
// "Skip"). Sized to be a comfortable target even though it draws no box.
export function TextButton({
  label,
  onPress,
  disabled,
  loading,
  accessibilityLabel,
  testID,
  destructive,
}: ButtonProps & {
  /** Tints the label with the destructive color -- for a quiet destructive action ("Delete") that shouldn't be a bordered button. */
  destructive?: boolean;
}) {
  const blocked = Boolean(disabled || loading);
  return (
    <TouchableOpacity
      testID={testID}
      onPress={onPress}
      disabled={blocked}
      activeOpacity={0.7}
      style={styles.textButtonFrame}
      accessibilityRole="button"
      accessibilityLabel={accessibilityLabel ?? label}
      accessibilityState={{ disabled: blocked, busy: Boolean(loading) }}
    >
      {loading ? (
        <ActivityIndicator size="small" color={colors.textSecondary} />
      ) : (
        <Text
          style={[
            styles.textLink,
            destructive && styles.textLinkDestructive,
            disabled && styles.disabled,
          ]}
        >
          {label}
        </Text>
      )}
    </TouchableOpacity>
  );
}

const styles = StyleSheet.create({
  base: {
    borderRadius: radii.md,
    alignItems: 'center',
    justifyContent: 'center',
  },
  iconRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
  },
  secondary: {
    borderWidth: 1,
    borderColor: colors.border,
  },
  secondaryText: {
    color: colors.textPrimary,
    fontFamily: fonts.semibold,
  },
  destructive: {
    borderWidth: 1,
    borderColor: colors.destructiveBorder,
  },
  destructiveText: {
    color: colors.destructive,
    fontFamily: fonts.semibold,
  },
  textButtonFrame: {
    minHeight: minTouchTarget,
    alignItems: 'center',
    justifyContent: 'center',
  },
  textLink: {
    color: colors.textSecondary,
    fontSize: 14,
  },
  textLinkDestructive: {
    color: colors.destructive,
  },
  disabled: {
    opacity: 0.5,
  },
});
