import { FilterChips, type FilterChipOption } from '../design/FilterChips';
import { MUSCLE_GROUPS, MUSCLE_GROUP_LABELS, type MuscleGroup } from './muscleGroups';

interface Props {
  value: MuscleGroup | null;
  onChange: (value: MuscleGroup | null) => void;
  /** Adds a leading "All" chip that clears the filter (null). */
  includeAll?: boolean;
  /** Selected-chip fill/text color. Defaults to the app theme's accent; every call site that has one passes the user's Workout accent so the selected chip follows it. */
  accentColor?: string;
  onAccentColor?: string;
}

const ALL = 'all' as const;

// The muscle-group picker shared by the Exercise Library filter (includeAll),
// the create/edit form's required single-select, the Add Exercise picker and
// the Progress filters: FilterChips (design/FilterChips.tsx) with the muscle
// groups -- 36pt pills with a 44pt touch area, filled with the accent when
// selected, in a sideways-scrolling row that never stretches or squashes them.
export function MuscleGroupChips({
  value,
  onChange,
  includeAll = false,
  accentColor,
  onAccentColor,
}: Props) {
  const options: FilterChipOption<MuscleGroup | typeof ALL>[] = [
    ...(includeAll ? [{ value: ALL, label: 'All' }] : []),
    ...MUSCLE_GROUPS.map((group) => ({ value: group, label: MUSCLE_GROUP_LABELS[group] })),
  ];
  return (
    <FilterChips<MuscleGroup | typeof ALL>
      testID="muscle-group-chip"
      options={options}
      value={value ?? ALL}
      onChange={(next) => onChange(next === ALL ? null : next)}
      accentColor={accentColor}
      onAccentColor={onAccentColor}
    />
  );
}
