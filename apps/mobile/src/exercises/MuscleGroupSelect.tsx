import { useState } from 'react';
import { ScrollView, StyleSheet, TouchableOpacity, View } from 'react-native';
import { Text } from '../design/Text';
import { Feather } from '@expo/vector-icons';
import { BottomSheet } from '../design/BottomSheet';
import { ListRow } from '../design/ListRow';
import { colors, radii, spacing, typeScale } from '../design/theme';
import { MUSCLE_GROUPS, MUSCLE_GROUP_LABELS, type MuscleGroup } from './muscleGroups';

interface Props {
  value: MuscleGroup | null;
  onChange: (value: MuscleGroup) => void;
  accentColor?: string;
  testID?: string;
}

// A real dropdown: tapping the field opens a sheet listing every muscle
// group, tapping one selects it and closes the sheet. MuscleGroupChips'
// horizontal-scroll row (a quick filter elsewhere -- Exercise Library, Add
// Exercise) doesn't fit a create/edit form's own single required choice as
// well as one tappable field does, so this is a separate component rather
// than a variant of that one.
export function MuscleGroupSelect({ value, onChange, accentColor = colors.accent, testID }: Props) {
  const [open, setOpen] = useState(false);

  return (
    <View>
      <Text style={styles.fieldLabel}>Muscle Group</Text>
      <TouchableOpacity
        testID={testID}
        style={styles.field}
        onPress={() => setOpen(true)}
        accessibilityRole="button"
        accessibilityLabel={
          value ? `Muscle Group, ${MUSCLE_GROUP_LABELS[value]}` : 'Muscle Group, not set'
        }
      >
        <Text style={[styles.fieldValue, !value && styles.placeholder]}>
          {value ? MUSCLE_GROUP_LABELS[value] : 'Select a muscle group'}
        </Text>
        <Feather name="chevron-down" size={18} color={colors.textMuted} />
      </TouchableOpacity>

      <BottomSheet
        visible={open}
        onClose={() => setOpen(false)}
        testID={testID ? `${testID}-sheet` : 'muscle-group-select-sheet'}
      >
        <Text style={styles.sheetTitle}>Muscle Group</Text>
        <ScrollView showsVerticalScrollIndicator={false} style={styles.sheetScroll}>
          {MUSCLE_GROUPS.map((group, index) => (
            <ListRow
              key={group}
              testID={testID ? `${testID}-option-${group}` : undefined}
              title={MUSCLE_GROUP_LABELS[group]}
              divider={index > 0}
              chevron={false}
              onPress={() => {
                onChange(group);
                setOpen(false);
              }}
              trailing={
                value === group ? <Feather name="check" size={18} color={accentColor} /> : undefined
              }
            />
          ))}
        </ScrollView>
      </BottomSheet>
    </View>
  );
}

const styles = StyleSheet.create({
  fieldLabel: {
    ...typeScale.label,
    color: colors.textSecondary,
    marginBottom: spacing.sm,
  },
  // Mirrors TextInput's own row so this reads as a natural sibling field --
  // same border/radius/background, just a static value + chevron in place
  // of an editable native input.
  field: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    backgroundColor: colors.surface,
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: radii.md,
    paddingHorizontal: spacing.md,
    paddingVertical: 12,
  },
  fieldValue: {
    ...typeScale.body,
    color: colors.textPrimary,
  },
  placeholder: {
    color: colors.textMuted,
  },
  sheetTitle: {
    ...typeScale.cardTitle,
    color: colors.textPrimary,
    marginBottom: spacing.sm,
  },
  sheetScroll: {
    maxHeight: 400,
  },
});
