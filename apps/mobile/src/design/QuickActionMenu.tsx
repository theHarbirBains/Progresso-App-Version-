import { Modal, Pressable, StyleSheet, Text, TouchableOpacity, View } from 'react-native';
import { Feather } from '@expo/vector-icons';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { GlassBackground } from './GlassBackground';
import { colors, radii, spacing, typeScale } from './theme';

interface Props {
  visible: boolean;
  onClose: () => void;
  onStartWorkout: () => void;
  onLogFood: () => void;
  accentColor: string;
}

/**
 * The center "+" button's action sheet. Only offers actions that already
 * have real functionality behind them (Start Workout, Log Food) -- no
 * placeholder actions pretending to work.
 */
export function QuickActionMenu({
  visible,
  onClose,
  onStartWorkout,
  onLogFood,
  accentColor,
}: Props) {
  const insets = useSafeAreaInsets();

  return (
    <Modal visible={visible} transparent animationType="fade" onRequestClose={onClose}>
      <Pressable
        testID="quick-action-backdrop"
        style={styles.backdrop}
        onPress={onClose}
        accessibilityLabel="Close quick actions"
      >
        <View style={[styles.sheet, { paddingBottom: insets.bottom + spacing.xl }]}>
          <GlassBackground variant="chrome" bordered={false} />
          <Text style={styles.title}>Quick Actions</Text>
          <TouchableOpacity
            testID="quick-action-start-workout"
            style={styles.action}
            onPress={onStartWorkout}
            accessibilityRole="button"
          >
            <View style={[styles.iconBox, { backgroundColor: accentColor }]}>
              <Feather name="activity" size={18} color={colors.background} />
            </View>
            <Text style={styles.actionLabel}>Start Workout</Text>
          </TouchableOpacity>
          <TouchableOpacity
            testID="quick-action-log-food"
            style={styles.action}
            onPress={onLogFood}
            accessibilityRole="button"
          >
            <View style={[styles.iconBox, { backgroundColor: accentColor }]}>
              <Feather name="coffee" size={18} color={colors.background} />
            </View>
            <Text style={styles.actionLabel}>Log Food</Text>
          </TouchableOpacity>
        </View>
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
    borderTopLeftRadius: radii.lg,
    borderTopRightRadius: radii.lg,
    borderTopWidth: 1,
    borderTopColor: colors.glassBorderStrong,
    paddingTop: spacing.lg,
    paddingHorizontal: spacing.xxl,
    overflow: 'hidden',
  },
  title: {
    ...typeScale.sectionHeading,
    color: colors.textMuted,
    marginBottom: spacing.md,
  },
  action: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.md,
    paddingVertical: spacing.md,
  },
  iconBox: {
    width: 36,
    height: 36,
    borderRadius: radii.md,
    alignItems: 'center',
    justifyContent: 'center',
  },
  actionLabel: {
    color: colors.textPrimary,
    fontSize: 16,
    fontWeight: '600',
  },
});
