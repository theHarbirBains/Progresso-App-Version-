import type { ReactNode } from 'react';
import { KeyboardAvoidingView, Modal, Platform, Pressable, StyleSheet } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useReduceMotionPreference } from '../navigation/navigationTransitions';
import { GlassBackground } from './GlassBackground';
import { colors, radii, spacing } from './theme';

interface Props {
  visible: boolean;
  onClose: () => void;
  children: ReactNode;
  dismissOnBackdropPress?: boolean;
  testID?: string;
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
  testID,
}: Props) {
  const insets = useSafeAreaInsets();
  const reduceMotion = useReduceMotionPreference();

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
});
