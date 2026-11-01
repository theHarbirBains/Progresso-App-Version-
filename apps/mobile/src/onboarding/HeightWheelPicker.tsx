import { StyleSheet, View } from 'react-native';
import { Text } from '../design/Text';
import { WheelPicker } from '../design/WheelPicker';
import { UnitToggle, wheelPickerStyles } from './UnitToggle';
import {
  cmFromFeetAndInches,
  feetAndInchesFromCm,
  HEIGHT_CM_RANGE,
  HEIGHT_FT_RANGE,
  HEIGHT_IN_RANGE,
  intRange,
  nearestValue,
} from './weightHeightConversion';

const CM_VALUES = intRange(HEIGHT_CM_RANGE.min, HEIGHT_CM_RANGE.max);
const FT_VALUES = intRange(HEIGHT_FT_RANGE.min, HEIGHT_FT_RANGE.max);
const IN_VALUES = intRange(HEIGHT_IN_RANGE.min, HEIGHT_IN_RANGE.max);
const UNITS = [
  { value: 'cm', label: 'cm' },
  { value: 'ft_in', label: 'ft/in' },
] as const;

interface Props {
  testID: string;
  unit: 'cm' | 'ft_in';
  /** Canonical height in cm -- always the single source of truth, same
   * rationale as WeightWheelPicker's canonical kg value. */
  heightCm: number;
  onChangeUnit: (unit: 'cm' | 'ft_in') => void;
  onChangeHeightCm: (heightCm: number) => void;
}

export function HeightWheelPicker({
  testID,
  unit,
  heightCm,
  onChangeUnit,
  onChangeHeightCm,
}: Props) {
  const { feet, inches } = feetAndInchesFromCm(heightCm);

  function handleCmSelect(value: string) {
    onChangeHeightCm(Number(value));
  }

  function handleFeetSelect(value: string) {
    onChangeHeightCm(cmFromFeetAndInches(Number(value), inches));
  }

  function handleInchesSelect(value: string) {
    onChangeHeightCm(cmFromFeetAndInches(feet, Number(value)));
  }

  return (
    <View testID={testID} style={wheelPickerStyles.container}>
      <UnitToggle testID={testID} options={UNITS} value={unit} onChange={onChangeUnit} />

      {unit === 'cm' ? (
        <>
          <WheelPicker
            testID={`${testID}-wheel-cm`}
            values={CM_VALUES}
            selectedValue={nearestValue(CM_VALUES, heightCm)}
            onChange={handleCmSelect}
          />
          <Text testID={`${testID}-preview`} style={wheelPickerStyles.preview}>
            {Math.round(heightCm)} cm
          </Text>
        </>
      ) : (
        <>
          <View style={styles.row}>
            <View style={styles.column}>
              <WheelPicker
                testID={`${testID}-wheel-ft`}
                values={FT_VALUES}
                selectedValue={String(feet)}
                onChange={handleFeetSelect}
              />
            </View>
            <View style={styles.column}>
              <WheelPicker
                testID={`${testID}-wheel-in`}
                values={IN_VALUES}
                selectedValue={String(inches)}
                onChange={handleInchesSelect}
              />
            </View>
          </View>
          <Text testID={`${testID}-preview`} style={wheelPickerStyles.preview}>
            {feet} ft {inches} in
          </Text>
        </>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  row: {
    flexDirection: 'row',
  },
  column: {
    width: 100,
  },
});
