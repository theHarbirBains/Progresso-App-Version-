import { View } from 'react-native';
import { Text } from '../design/Text';
import { WheelPicker } from '../design/WheelPicker';
import { UnitToggle, wheelPickerStyles as styles } from './UnitToggle';
import {
  decimalRange,
  kgToLb,
  lbToKg,
  nearestValue,
  WEIGHT_KG_RANGE,
  WEIGHT_LB_RANGE,
} from './weightHeightConversion';

const KG_VALUES = decimalRange(WEIGHT_KG_RANGE.min, WEIGHT_KG_RANGE.max, WEIGHT_KG_RANGE.step);
const LB_VALUES = decimalRange(WEIGHT_LB_RANGE.min, WEIGHT_LB_RANGE.max, WEIGHT_LB_RANGE.step);
const UNITS = [
  { value: 'kg', label: 'kg' },
  { value: 'lb', label: 'lb' },
] as const;

interface Props {
  testID: string;
  unit: 'kg' | 'lb';
  /** Canonical weight in kg -- always the single source of truth, so toggling
   * units back and forth never compounds rounding error from a previous
   * conversion. */
  weightKg: number;
  onChangeUnit: (unit: 'kg' | 'lb') => void;
  onChangeWeightKg: (weightKg: number) => void;
}

export function WeightWheelPicker({
  testID,
  unit,
  weightKg,
  onChangeUnit,
  onChangeWeightKg,
}: Props) {
  const values = unit === 'kg' ? KG_VALUES : LB_VALUES;
  const displayValue = unit === 'kg' ? weightKg : kgToLb(weightKg);
  const selected = nearestValue(values, displayValue);

  function handleSelect(value: string) {
    const raw = Number(value);
    onChangeWeightKg(unit === 'kg' ? raw : lbToKg(raw));
  }

  return (
    <View testID={testID} style={styles.container}>
      <UnitToggle testID={testID} options={UNITS} value={unit} onChange={onChangeUnit} />
      <WheelPicker
        testID={`${testID}-wheel`}
        values={values}
        selectedValue={selected}
        onChange={handleSelect}
      />
      <Text testID={`${testID}-preview`} style={styles.preview}>
        {selected} {unit}
      </Text>
    </View>
  );
}
