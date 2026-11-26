import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useRef,
  type ReactNode,
} from 'react';
import {
  Animated,
  Easing,
  KeyboardAvoidingView,
  Modal,
  PanResponder,
  Platform,
  Pressable,
  StyleSheet,
  View,
  type NativeScrollEvent,
  type NativeSyntheticEvent,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useReduceMotionPreference } from '../navigation/navigationTransitions';
import { GlassBackground } from './GlassBackground';
import { colors, radii, spacing } from './theme';

interface Props {
  visible: boolean;
  onClose: () => void;
  children: ReactNode;
  dismissOnBackdropPress?: boolean;
  /**
   * Swiped down to tuck it away: a grabber at its top, the sheet following the finger down (the
   * backdrop fading with it), let go far enough or quickly enough and it closes, else it springs
   * back. A list inside it scrolls as ever; the sheet only moves from the list's top
   * (useSheetScrollHandler).
   */
  swipeToDismiss?: boolean;
  testID?: string;
}

/** Whether a drag let go here closes the sheet: pulled a good way down, or flicked down. */
export function swipeDismisses(dy: number, vy: number, sheetHeight: number): boolean {
  const far = Math.min(120, Math.max(60, sheetHeight * 0.3));
  return dy > far || (vy > 0.9 && dy > 24);
}

const SheetScroll = createContext<((offsetY: number) => void) | null>(null);

/**
 * For a list scrolling inside a swipeable sheet: its onScroll, so a drag down moves the sheet only
 * once the list is at its top. Does nothing in any other sheet.
 */
export function useSheetScrollHandler() {
  const report = useContext(SheetScroll);
  return useCallback(
    (event: NativeSyntheticEvent<NativeScrollEvent>) => report?.(event.nativeEvent.contentOffset.y),
    [report],
  );
}

// Component Logic: generalizes QuickActionMenu's existing Modal+backdrop+
// sheet structure to arbitrary children instead of two hardcoded actions,
// and swaps its animation to 'none' under Reduce Motion (the same
// established pattern AppSideMenu/the navigator already use) rather than
// adding a second, bespoke reduced-motion mechanism.
export function BottomSheet({
  visible,
  onClose,
  children,
  dismissOnBackdropPress = true,
  swipeToDismiss = false,
  testID,
}: Props) {
  const insets = useSafeAreaInsets();
  const reduceMotion = useReduceMotionPreference();
  // How far the sheet's been pulled down, its height, and where a list inside it is scrolled to.
  const drag = useRef(new Animated.Value(0)).current;
  const height = useRef(0);
  const listOffset = useRef(0);
  const close = useRef(onClose);
  close.current = onClose;

  useEffect(() => {
    if (visible) {
      drag.setValue(0);
      listOffset.current = 0;
    }
  }, [visible, drag]);

  const pan = useMemo(
    () =>
      PanResponder.create({
        // A tap on the sheet itself stays on it (never the backdrop's); its rows still get theirs.
        onStartShouldSetPanResponder: () => true,
        // A drag down from the list's top moves the sheet, ahead of the list and its rows.
        onMoveShouldSetPanResponderCapture: (_, g) =>
          g.dy > 6 && Math.abs(g.dy) > Math.abs(g.dx) * 1.2 && listOffset.current <= 0,
        onPanResponderMove: (_, g) => drag.setValue(Math.max(0, g.dy)),
        onPanResponderRelease: (_, g) => {
          if (swipeDismisses(g.dy, g.vy, height.current)) {
            if (reduceMotion) {
              close.current();
              return;
            }
            Animated.timing(drag, {
              toValue: Math.max(height.current, 400),
              duration: 180,
              easing: Easing.out(Easing.quad),
              useNativeDriver: true,
            }).start(() => close.current());
          } else {
            Animated.spring(drag, {
              toValue: 0,
              stiffness: 260,
              damping: 26,
              mass: 1,
              useNativeDriver: true,
            }).start();
          }
        },
        onPanResponderTerminate: () => {
          Animated.spring(drag, { toValue: 0, useNativeDriver: true }).start();
        },
      }),
    [drag, reduceMotion],
  );

  const reportScroll = useCallback((offsetY: number) => {
    listOffset.current = offsetY;
  }, []);

  const dim = drag.interpolate({
    inputRange: [0, 400],
    outputRange: [1, 0],
    extrapolate: 'clamp',
  });

  return (
    <Modal
      visible={visible}
      transparent
      animationType={reduceMotion ? 'none' : 'slide'}
      onRequestClose={onClose}
      testID={testID}
    >
      {/* Wrapping the backdrop+sheet in a KeyboardAvoidingView (rather than
          relying on each sheet's own content to avoid the keyboard) is what
          lets ANY BottomSheet consumer with a text field -- this one or a
          future one -- rise above the keyboard automatically: 'padding' on
          iOS pads the bottom of this full-screen view, and 'height' on
          Android shrinks it, and since the sheet below is bottom-anchored
          (backdrop's justifyContent: 'flex-end'), either one pushes the
          sheet up by exactly the keyboard's height. maxHeight on the sheet
          itself (below) is what then gives a scrollable child (e.g.
          ExerciseFormScreen's sheet-presentation ScrollView) an actual
          bounded box to scroll within once the available space shrinks,
          instead of the sheet trying to grow past the top of the screen. */}
      <KeyboardAvoidingView
        style={styles.avoiding}
        behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
      >
        {swipeToDismiss ? (
          <Pressable
            testID={testID ? `${testID}-backdrop` : 'bottom-sheet-backdrop'}
            style={[styles.backdrop, styles.clear]}
            onPress={dismissOnBackdropPress ? onClose : undefined}
            accessibilityLabel="Close"
            accessibilityRole="button"
          >
            <Animated.View pointerEvents="none" style={[styles.dim, { opacity: dim }]} />
            <Animated.View
              testID={testID ? `${testID}-content` : 'bottom-sheet-content'}
              style={[
                styles.sheet,
                { paddingBottom: insets.bottom + spacing.xl, transform: [{ translateY: drag }] },
              ]}
              onLayout={(event) => {
                height.current = event.nativeEvent.layout.height;
              }}
              {...pan.panHandlers}
            >
              <GlassBackground variant="chrome" bordered={false} />
              <View
                testID={testID ? `${testID}-grabber` : 'bottom-sheet-grabber'}
                style={styles.grabber}
                accessibilityElementsHidden
                importantForAccessibility="no-hide-descendants"
              />
              {/* A tap inside stays inside, never reaching the backdrop. */}
              <Pressable style={styles.inside} onPress={() => {}} accessible={false}>
                <SheetScroll.Provider value={reportScroll}>{children}</SheetScroll.Provider>
              </Pressable>
            </Animated.View>
          </Pressable>
        ) : (
          <Pressable
            testID={testID ? `${testID}-backdrop` : 'bottom-sheet-backdrop'}
            style={styles.backdrop}
            onPress={dismissOnBackdropPress ? onClose : undefined}
            accessibilityLabel="Close"
            accessibilityRole="button"
          >
            <Pressable
              testID={testID ? `${testID}-content` : 'bottom-sheet-content'}
              style={[styles.sheet, { paddingBottom: insets.bottom + spacing.xl }]}
              onPress={(event) => event.stopPropagation()}
            >
              <GlassBackground variant="chrome" bordered={false} />
              {children}
            </Pressable>
          </Pressable>
        )}
      </KeyboardAvoidingView>
    </Modal>
  );
}

const styles = StyleSheet.create({
  avoiding: {
    flex: 1,
  },
  backdrop: {
    flex: 1,
    backgroundColor: 'rgba(0, 0, 0, 0.5)',
    justifyContent: 'flex-end',
  },
  // A swipeable sheet's backdrop dims in a layer of its own, fading as the sheet is pulled down.
  clear: {
    backgroundColor: 'transparent',
  },
  dim: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    backgroundColor: 'rgba(0, 0, 0, 0.5)',
  },
  sheet: {
    maxHeight: '90%',
    borderTopLeftRadius: radii.lg,
    borderTopRightRadius: radii.lg,
    borderTopWidth: 1,
    borderTopColor: colors.glassBorderStrong,
    paddingTop: spacing.lg,
    paddingHorizontal: spacing.xxl,
    overflow: 'hidden',
  },
  inside: {
    flexShrink: 1,
  },
  // The grabber: a short rounded bar centred at the top, saying the sheet can be pulled down.
  grabber: {
    alignSelf: 'center',
    width: 36,
    height: 5,
    borderRadius: radii.pill,
    backgroundColor: colors.textMuted,
    opacity: 0.6,
    marginTop: -spacing.sm,
    marginBottom: spacing.md,
  },
});
