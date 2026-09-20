import { StyleSheet, TouchableOpacity, View } from 'react-native';
import { Text } from '../design/Text';
import { colors, fonts, radii, spacing } from '../design/theme';
import { WheelPicker } from '../design/WheelPicker';
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
    <View testID={testID} style={styles.container}>
      <View style={styles.unitToggle}>
        <TouchableOpacity
          testID={`${testID}-unit-cm`}
          style={[styles.unitOption, unit === 'cm' && styles.unitOptionSelected]}
          onPress={() => onChangeUnit('cm')}
        >
          <Text style={[styles.unitText, unit === 'cm' && styles.unitTextSelected]}>cm</Text>
        </TouchableOpacity>
        <TouchableOpacity
          testID={`${testID}-unit-ft_in`}
          style={[styles.unitOption, unit === 'ft_in' && styles.unitOptionSelected]}
          onPress={() => onChangeUnit('ft_in')}
        >
          <Text style={[styles.unitText, unit === 'ft_in' && styles.unitTextSelected]}>ft/in</Text>
        </TouchableOpacity>
      </View>

      {unit === 'cm' ? (
        <>
          <WheelPicker
            testID={`${testID}-wheel-cm`}
            values={CM_VALUES}
            selectedValue={nearestValue(CM_VALUES, heightCm)}
            onChange={handleCmSelect}
          />
          <Text testID={`${testID}-preview`} style={styles.preview}>
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
          <Text testID={`${testID}-preview`} style={styles.preview}>
            {feet} ft {inches} in
          </Text>
        </>
      )}
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
    color: colors.textSecondary,
    fontFamily: fonts.display,
    fontSize: 14,
  },
  unitTextSelected: {
    color: colors.onAccent,
  },
  row: {
    flexDirection: 'row',
  },
  column: {
    width: 100,
  },
  preview: {
    marginTop: spacing.md,
    color: colors.textSecondary,
    fontFamily: fonts.displayMedium,
    fontSize: 13,
  },
});
