import { ActivityIndicator, StyleSheet, View } from 'react-native';
import { Text } from './Text';
import { Feather } from '@expo/vector-icons';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { IconButton } from './IconButton';
import { colors, spacing, typeScale } from './theme';

interface HeaderAction {
  icon: keyof typeof Feather.glyphMap;
  onPress: () => void;
  accessibilityLabel: string;
  disabled?: boolean;
  testID?: string;
}

interface Props {
  title?: string;
  subtitle?: string;
  /** Renders a standard back IconButton. Ignored if `leftAction` is given. */
  onBack?: () => void;
  /** A custom left action, for the rare screen that needs something other than Back. */
  leftAction?: HeaderAction;
  rightAction?: HeaderAction;
  /** Replaces `rightAction` with a spinner -- e.g. a header-level save in progress. */
  loading?: boolean;
  /** Default true: pads for the device's top safe area, matching ScreenContainer's own inset handling. */
  safeArea?: boolean;
  testID?: string;
}

// Component Logic: a fixed three-slot row (left icon slot, flexible title
// column, right icon slot) where each icon slot renders its IconButton or
// an equal-width empty spacer -- never a fourth wrapper, never conditional
// row layouts -- so the title stays centered/aligned the same way whether
// or not either action is present, matching the symmetric-header pattern
// already used by the live-workout header.
export function AppHeader({
  title,
  subtitle,
  onBack,
  leftAction,
  rightAction,
  loading,
  safeArea = true,
  testID,
}: Props) {
  const insets = useSafeAreaInsets();
  const left =
    leftAction ??
    (onBack
      ? {
          icon: 'arrow-left' as const,
          onPress: onBack,
          accessibilityLabel: 'Back',
          testID: 'app-header-back',
        }
      : null);

  return (
    <View testID={testID} style={[styles.row, safeArea && { paddingTop: insets.top + spacing.md }]}>
      {left ? (
        <IconButton
          testID={left.testID}
          icon={left.icon}
          onPress={left.onPress}
          accessibilityLabel={left.accessibilityLabel}
          disabled={left.disabled}
        />
      ) : (
        <View style={styles.spacer} />
      )}

      <View style={styles.titleColumn}>
        {title ? <Text style={styles.title}>{title}</Text> : null}
        {subtitle ? <Text style={styles.subtitle}>{subtitle}</Text> : null}
      </View>

      {loading ? (
        <View style={styles.spacer}>
          <ActivityIndicator size="small" color={colors.textSecondary} />
        </View>
      ) : rightAction ? (
        <IconButton
          testID={rightAction.testID}
          icon={rightAction.icon}
          onPress={rightAction.onPress}
          accessibilityLabel={rightAction.accessibilityLabel}
          disabled={rightAction.disabled}
        />
      ) : (
        <View style={styles.spacer} />
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.md,
    // Matches Screen's own tightened horizontal gutter (spacing.sm) so a
    // header's title/icons line up with the card edges below it.
    paddingHorizontal: spacing.sm,
    paddingBottom: spacing.lg,
  },
  spacer: {
    width: 36,
    height: 36,
    alignItems: 'center',
    justifyContent: 'center',
  },
  titleColumn: {
    flex: 1,
  },
  title: {
    ...typeScale.screenTitle,
    color: colors.textPrimary,
    textAlign: 'center',
  },
  subtitle: {
    ...typeScale.body,
    color: colors.textSecondary,
    marginTop: 2,
    textAlign: 'center',
  },
});
