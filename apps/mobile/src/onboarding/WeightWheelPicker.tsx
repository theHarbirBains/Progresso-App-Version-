import { StyleSheet, TouchableOpacity, View } from 'react-native';
import { Text } from '../design/Text';
import { colors, fonts, radii, spacing, typeScale } from '../design/theme';
import { WheelPicker } from '../design/WheelPicker';
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
      <View style={styles.unitToggle}>
        <TouchableOpacity
          testID={`${testID}-unit-kg`}
          style={[styles.unitOption, unit === 'kg' && styles.unitOptionSelected]}
          onPress={() => onChangeUnit('kg')}
        >
          <Text style={[styles.unitText, unit === 'kg' && styles.unitTextSelected]}>kg</Text>
        </TouchableOpacity>
        <TouchableOpacity
          testID={`${testID}-unit-lb`}
          style={[styles.unitOption, unit === 'lb' && styles.unitOptionSelected]}
          onPress={() => onChangeUnit('lb')}
        >
          <Text style={[styles.unitText, unit === 'lb' && styles.unitTextSelected]}>lb</Text>
        </TouchableOpacity>
      </View>
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

const styles = StyleSheet.create({
  container: {
    alignItems: 'center',
  },
  unitToggle: {
    flexDirection: 'row',
    marginBottom: spacing.lg,
    borderRadius: radii.pill,
    backgroundColor: colors.surfaceRaised,
    borderWidth: 1,
    borderColor: colors.border,
    padding: 4,
  },
  unitOption: {
    paddingVertical: spacing.xs,
    paddingHorizontal: spacing.xl,
    borderRadius: radii.pill,
  },
  unitOptionSelected: {
    backgroundColor: colors.accent,
  },
  unitText: {
    ...typeScale.callout,
    color: colors.textSecondary,
    fontFamily: fonts.display,
  },
  unitTextSelected: {
    color: colors.onAccent,
  },
  preview: {
    ...typeScale.secondary,
    marginTop: spacing.md,
    color: colors.textSecondary,
    fontFamily: fonts.displayMedium,
  },
});
