import { ScrollView, Text, TouchableOpacity } from 'react-native';
import { exerciseStyles as styles } from '../screens/exerciseStyles';
import { MUSCLE_GROUPS, MUSCLE_GROUP_LABELS, type MuscleGroup } from './muscleGroups';

interface Props {
  value: MuscleGroup | null;
  onChange: (value: MuscleGroup | null) => void;
  /** Adds a leading "All" chip that clears the filter (null). */
  includeAll?: boolean;
}

// Shared by the library's filter row (includeAll) and the create/edit
// form's required single-select picker.
export function MuscleGroupChips({ value, onChange, includeAll = false }: Props) {
  const options: (MuscleGroup | null)[] = includeAll
    ? [null, ...MUSCLE_GROUPS]
    : [...MUSCLE_GROUPS];

  return (
    <ScrollView
      horizontal
      showsHorizontalScrollIndicator={false}
      contentContainerStyle={styles.chipRow}
    >
      {options.map((option) => {
        const selected = option === value;
        const label = option === null ? 'All' : MUSCLE_GROUP_LABELS[option];
        return (
          <TouchableOpacity
            key={option ?? 'all'}
            testID={`muscle-group-chip-${option ?? 'all'}`}
            style={[styles.chip, selected && styles.chipSelected]}
            onPress={() => onChange(option)}
          >
            <Text style={[styles.chipText, selected && styles.chipTextSelected]}>{label}</Text>
          </TouchableOpacity>
        );
      })}
    </ScrollView>
  );
}
