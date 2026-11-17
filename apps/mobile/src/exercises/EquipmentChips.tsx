import { FilterChips, type FilterChipOption } from '../design/FilterChips';
import { EQUIPMENT, EQUIPMENT_LABELS, type Equipment } from './equipment';

interface Props {
  value: Equipment | null;
  onChange: (value: Equipment | null) => void;
  accentColor?: string;
  onAccentColor?: string;
}

const ALL = 'all' as const;

// The library's and the picker's choice of what an exercise is done with -- All, then each kind of
// equipment -- as the same FilterChips row as the muscle groups above it. Built-ins all say what
// they're done with; a person's own exercise shows under one once it's been given equipment.
export function EquipmentChips({ value, onChange, accentColor, onAccentColor }: Props) {
  const options: FilterChipOption<Equipment | typeof ALL>[] = [
    { value: ALL, label: 'All Equipment' },
    ...EQUIPMENT.map((equipment) => ({ value: equipment, label: EQUIPMENT_LABELS[equipment] })),
  ];
  return (
    <FilterChips<Equipment | typeof ALL>
      testID="equipment-chip"
      options={options}
      value={value ?? ALL}
      onChange={(next) => onChange(next === ALL ? null : next)}
      accentColor={accentColor}
      onAccentColor={onAccentColor}
    />
  );
}
