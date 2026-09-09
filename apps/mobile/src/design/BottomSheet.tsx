import type { ReactNode } from 'react';
import { Modal, Pressable, StyleSheet } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useReduceMotionPreference } from '../navigation/navigationTransitions';
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
          {children}
        </Pressable>
      </Pressable>
    </Modal>
  );
}

const styles = StyleSheet.create({
  backdrop: {
    flex: 1,
    backgroundColor: 'rgba(0, 0, 0, 0.5)',
    justifyContent: 'flex-end',
  },
  sheet: {
    backgroundColor: colors.surface,
    borderTopLeftRadius: radii.lg,
    borderTopRightRadius: radii.lg,
    paddingTop: spacing.lg,
    paddingHorizontal: spacing.xxl,
  },
});
