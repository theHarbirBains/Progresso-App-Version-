import { Modal, Pressable, Text, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { liveWorkoutStyles as styles } from '../screens/liveWorkoutStyles';

interface Props {
  visible: boolean;
  onClose: () => void;
  onCompleteWorkout: () => void;
}

/**
 * The workout header's "..." options menu. Complete Workout is the only
 * existing, supported whole-workout action right now -- no delete/discard
 * capability exists in the backend for a workout, so nothing else is
 * exposed here.
 */
export function WorkoutActionMenu({ visible, onClose, onCompleteWorkout }: Props) {
  const insets = useSafeAreaInsets();
  return (
    <Modal visible={visible} transparent animationType="fade" onRequestClose={onClose}>
      <Pressable testID="workout-action-backdrop" style={styles.menuBackdrop} onPress={onClose}>
        <View style={[styles.menuSheet, { paddingBottom: insets.bottom + 20 }]}>
          <Pressable
            testID="workout-action-complete"
            style={styles.menuItem}
            onPress={onCompleteWorkout}
          >
            <Text style={styles.menuItemText}>Complete Workout</Text>
          </Pressable>
        </View>
      </Pressable>
    </Modal>
  );
}
