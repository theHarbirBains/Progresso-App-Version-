import { useState } from 'react';
import { FlatList, Modal, Pressable, Text, TouchableOpacity, View } from 'react-native';
import { Feather } from '@expo/vector-icons';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { colors, radii, spacing } from '../design/theme';
import { progressStyles as styles } from './progressStyles';

export interface SelectableExercise {
  id: string;
  name: string;
}

interface Props {
  exercises: SelectableExercise[];
  selectedId: string | null;
  onSelect: (id: string) => void;
  accentColor: string;
  testID?: string;
}

/**
 * "Bench Press ▾" -- tapping it opens a list of only the exercises this
 * user actually has workout history for (the caller passes that filtered
 * list in; this component has no data-fetching of its own).
 */
export function ExerciseSelector({ exercises, selectedId, onSelect, accentColor, testID }: Props) {
  const insets = useSafeAreaInsets();
  const [open, setOpen] = useState(false);
  const selected = exercises.find((e) => e.id === selectedId);

  return (
    <View>
      <TouchableOpacity
        testID={testID ?? 'exercise-selector-trigger'}
        style={styles.exerciseSelectorTrigger}
        onPress={() => setOpen(true)}
        accessibilityRole="button"
        accessibilityLabel={`Change exercise, currently ${selected?.name ?? 'none selected'}`}
      >
        <Text style={styles.exerciseSelectorLabel}>{selected?.name ?? 'Select exercise'}</Text>
        <Feather name="chevron-down" size={18} color={colors.textSecondary} />
      </TouchableOpacity>

      <Modal
        visible={open}
        transparent
        animationType="fade"
        onRequestClose={() => setOpen(false)}
        testID="exercise-selector-modal"
      >
        <Pressable
          style={{ flex: 1, backgroundColor: 'rgba(0,0,0,0.5)' }}
          onPress={() => setOpen(false)}
          testID="exercise-selector-backdrop"
        >
          <View
            style={{
              marginTop: 'auto',
              backgroundColor: colors.surface,
              borderTopLeftRadius: radii.lg,
              borderTopRightRadius: radii.lg,
              paddingTop: spacing.lg,
              paddingHorizontal: spacing.xxl,
              paddingBottom: insets.bottom + spacing.xl,
              maxHeight: '70%',
            }}
          >
            <Text style={[styles.menuTitle, { marginBottom: spacing.md }]}>Select Exercise</Text>
            <FlatList
              data={exercises}
              keyExtractor={(item) => item.id}
              renderItem={({ item }) => {
                const isSelected = item.id === selectedId;
                return (
                  <TouchableOpacity
                    testID={`exercise-option-${item.id}`}
                    style={[styles.menuItem, isSelected && styles.menuItemActive]}
                    onPress={() => {
                      onSelect(item.id);
                      setOpen(false);
                    }}
                    accessibilityRole="button"
                    accessibilityState={{ selected: isSelected }}
                  >
                    <Text
                      style={[
                        styles.menuItemLabel,
                        isSelected && [styles.menuItemLabelActive, { color: accentColor }],
                      ]}
                    >
                      {item.name}
                    </Text>
                    {isSelected ? <Feather name="check" size={18} color={accentColor} /> : null}
                  </TouchableOpacity>
                );
              }}
            />
          </View>
        </Pressable>
      </Modal>
    </View>
  );
}
