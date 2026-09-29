import { useEffect, useRef, type ReactNode } from 'react';
import { Animated, Modal, Pressable, StyleSheet } from 'react-native';
import { Feather } from '@expo/vector-icons';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useReduceMotionPreference } from '../navigation/navigationTransitions';
import { Text } from './Text';
import { colors, fonts, minTouchTarget, spacing, typeScale, radii } from './theme';

interface Props {
  visible: boolean;
  onClose: () => void;
  children: ReactNode;
  testID?: string;
}

const ANIMATION_MS = 220;
// Roughly where AppHeader's own rightmost icon sits (safe-area top +
// spacing.md top padding + the 36pt icon + spacing.lg bottom padding) --
// close enough for the bubble to visibly grow out from that button without
// this component needing the header to report its own icon's exact layout.
const HEADER_ICON_BOTTOM = spacing.md + 36 + spacing.lg;

// A popup that grows out of its trigger (Feed's header "+") instead of
// sliding up from the bottom edge like `BottomSheet` -- scales in from a
// point anchored at its own top-right corner (`transformOrigin`), landing
// near where the triggering icon actually sits. Only the entrance animates:
// AppSideMenu can animate its close too because it never unmounts (just
// translates off-screen), but this is Modal-based like BottomSheet, so
// closing means the Modal unmounts outright -- animating that would mean
// deferring the caller's onClose behind a JS animation callback, real
// complexity for a menu that's open for seconds at most. Closing is instant.
export function BubbleMenu({ visible, onClose, children, testID }: Props) {
  const insets = useSafeAreaInsets();
  const reduceMotion = useReduceMotionPreference();
  const progress = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    if (!visible) return;
    if (reduceMotion) {
      progress.setValue(1);
      return;
    }
    progress.setValue(0);
    Animated.timing(progress, {
      toValue: 1,
      duration: ANIMATION_MS,
      useNativeDriver: true,
    }).start();
  }, [visible, reduceMotion, progress]);

  const scale = progress.interpolate({ inputRange: [0, 1], outputRange: [0.4, 1] });

  return (
    <Modal visible={visible} transparent animationType="none" onRequestClose={onClose} testID={testID}>
      <Pressable
        testID={testID ? `${testID}-backdrop` : 'bubble-menu-backdrop'}
        style={styles.backdrop}
        onPress={onClose}
        accessibilityLabel="Close"
        accessibilityRole="button"
      >
        <Animated.View
          style={[
            styles.bubble,
            {
              top: insets.top + HEADER_ICON_BOTTOM,
              opacity: progress,
              transform: [{ scale }],
              transformOrigin: 'top right',
            },
          ]}
        >
          <Pressable
            testID={testID ? `${testID}-content` : 'bubble-menu-content'}
            style={styles.content}
            onPress={(event) => event?.stopPropagation?.()}
          >
            {children}
          </Pressable>
        </Animated.View>
      </Pressable>
    </Modal>
  );
}

interface BubbleMenuRowProps {
  icon: keyof typeof Feather.glyphMap;
  label: string;
  onPress: () => void;
  testID?: string;
}

// A plain icon + label row for BubbleMenu's own content -- deliberately not
// `ListRow` here: this menu is meant to read as a quick, light popup (see
// the source app's own equivalent), so its rows skip ListRow's icon-well
// background and trailing chevron rather than looking like a list of
// navigable settings.
export function BubbleMenuRow({ icon, label, onPress, testID }: BubbleMenuRowProps) {
  return (
    <Pressable
      testID={testID}
      onPress={onPress}
      style={rowStyles.row}
      accessibilityRole="button"
      accessibilityLabel={label}
    >
      <Feather name={icon} size={18} color={colors.textPrimary} />
      <Text style={rowStyles.label}>{label}</Text>
    </Pressable>
  );
}

const rowStyles = StyleSheet.create({
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.md,
    minHeight: minTouchTarget,
  },
  label: {
    ...typeScale.callout,
    fontFamily: fonts.semibold,
    color: colors.textPrimary,
  },
});

const styles = StyleSheet.create({
  backdrop: {
    flex: 1,
    backgroundColor: 'rgba(0, 0, 0, 0.5)',
  },
  content: {
    gap: spacing.xs,
  },
  bubble: {
    position: 'absolute',
    right: spacing.xxl,
    minWidth: 220,
    // Flat solid black, not the glass tint+blur every other surface (cards,
    // BottomSheet, AppSideMenu) uses -- explicit call, since the blur's own
    // translucency read as two competing shades against the dimmed backdrop
    // behind it rather than one clean surface.
    backgroundColor: colors.background,
    borderRadius: radii.lg,
    borderWidth: 1,
    borderColor: colors.glassBorderStrong,
    paddingVertical: spacing.sm,
    paddingHorizontal: spacing.lg,
    overflow: 'hidden',
  },
});
