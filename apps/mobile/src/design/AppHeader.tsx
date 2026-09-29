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
  /** A small count badge on this action's corner -- see IconButton's own doc. */
  badgeCount?: number;
  testID?: string;
}

interface Props {
  title?: string;
  subtitle?: string;
  /** Renders a standard back IconButton. Ignored if `leftAction` is given. */
  onBack?: () => void;
  /** A custom left action, for the rare screen that needs something other than Back. */
  leftAction?: HeaderAction;
  /** A second icon immediately after `leftAction`/the Back button, for a screen that needs two left-side actions (e.g. Feed's menu + search). Ignored if there's no primary left action to sit next to. */
  leftAction2?: HeaderAction;
  rightAction?: HeaderAction;
  /** A second icon after `rightAction` (e.g. Feed's "+" then a notifications bell), independent of whether `rightAction` itself is given. */
  rightAction2?: HeaderAction;
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
  leftAction2,
  rightAction,
  rightAction2,
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
  // leftAction2 needs a primary left action to sit next to (there's no
  // "second action, no first" case); rightAction2 doesn't have that
  // constraint since the primary right slot always renders something
  // (rightAction, the loading spinner, or a spacer) regardless.
  const showLeftSecondary = Boolean(left && leftAction2);
  const showRightSecondary = Boolean(rightAction2);

  return (
    <View testID={testID} style={[styles.row, safeArea && { paddingTop: insets.top + spacing.md }]}>
      {left ? (
        <IconButton
          testID={left.testID}
          icon={left.icon}
          onPress={left.onPress}
          accessibilityLabel={left.accessibilityLabel}
          disabled={left.disabled}
          badgeCount={left.badgeCount}
        />
      ) : (
        <View style={styles.spacer} />
      )}

      {/* A real second left action, or -- when only the right side has one
          -- a blank spacer of the same width, so both sides stay equal and
          the title column (and its centered text) doesn't skew toward
          whichever side has more icons. */}
      {showLeftSecondary ? (
        <IconButton
          testID={leftAction2!.testID}
          icon={leftAction2!.icon}
          onPress={leftAction2!.onPress}
          accessibilityLabel={leftAction2!.accessibilityLabel}
          disabled={leftAction2!.disabled}
          badgeCount={leftAction2!.badgeCount}
        />
      ) : showRightSecondary ? (
        <View style={styles.spacer} />
      ) : null}

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
          badgeCount={rightAction.badgeCount}
        />
      ) : (
        <View style={styles.spacer} />
      )}

      {/* Mirrors the left side's own secondary-or-spacer slot above. */}
      {showRightSecondary ? (
        <IconButton
          testID={rightAction2!.testID}
          icon={rightAction2!.icon}
          onPress={rightAction2!.onPress}
          accessibilityLabel={rightAction2!.accessibilityLabel}
          disabled={rightAction2!.disabled}
          badgeCount={rightAction2!.badgeCount}
        />
      ) : showLeftSecondary ? (
        <View style={styles.spacer} />
      ) : null}
    </View>
  );
}

const styles = StyleSheet.create({
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.md,
    // Unlike Screen's widgets (deliberately edge-to-edge, see DESIGN.md's
    // Feed section), a header's title text and icons (the hamburger/side
    // menu, a '+', Back) read as cramped flush against the screen edge --
    // this keeps its own standard screen gutter instead.
    paddingHorizontal: spacing.xxl,
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
