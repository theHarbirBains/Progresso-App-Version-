import { useEffect, useRef, useState } from 'react';
import { StyleSheet, View, type TextInputInstance } from 'react-native';
import { Text } from '../design/Text';
import { TextInput } from '../design/TextInput';
import { colors, typeScale } from '../design/theme';
import { UnitToggle } from './UnitToggle';
import { bodyWeightRange, bodyWeightText, typedBodyWeightKg } from './weightHeightConversion';

const UNITS = [
  { value: 'kg', label: 'kg' },
  { value: 'lb', label: 'lb' },
] as const;

interface Props {
  testID: string;
  unit: 'kg' | 'lb';
  /** The weight typed, in kg -- null until there is one. */
  weightKg: number | null;
  onChangeUnit: (unit: 'kg' | 'lb') => void;
  /** Kg as it's typed; null while the box is blank or holds something that isn't a weight. */
  onChangeWeightKg: (weightKg: number | null) => void;
}

/**
 * Onboarding's weight: typed into a box, in kg or lb, with the keyboard up as the step opens.
 * Switching units shows what was typed in the other one; the weight itself (kg) isn't touched
 * unless it's typed again, so switching back and forth never drifts it.
 */
export function WeightField({ testID, unit, weightKg, onChangeUnit, onChangeWeightKg }: Props) {
  const [text, setText] = useState(() => (weightKg === null ? '' : bodyWeightText(weightKg, unit)));
  const inputRef = useRef<TextInputInstance>(null);

  useEffect(() => {
    inputRef.current?.focus();
  }, []);

  function changeText(next: string) {
    setText(next);
    onChangeWeightKg(typedBodyWeightKg(next, unit));
  }

  function changeUnit(next: 'kg' | 'lb') {
    if (next === unit) return;
    if (weightKg !== null) {
      setText(bodyWeightText(weightKg, next));
    } else {
      // Not a weight yet in one unit, but it may be in the other: 60 is too light in lb, not kg.
      onChangeWeightKg(typedBodyWeightKg(text, next));
    }
    onChangeUnit(next);
  }

  const { min, max } = bodyWeightRange(unit);
  return (
    <View testID={testID}>
      <View style={styles.toggle}>
        <UnitToggle testID={testID} options={UNITS} value={unit} onChange={changeUnit} />
      </View>
      <TextInput
        testID={`${testID}-input`}
        inputRef={inputRef}
        label="Weight"
        placeholder={unit === 'kg' ? 'e.g. 75' : 'e.g. 165'}
        keyboardType="decimal-pad"
        value={text}
        onChangeText={changeText}
        maxLength={6}
        accessibilityLabel={`Your weight in ${unit === 'kg' ? 'kilograms' : 'pounds'}`}
        helperText={`Between ${min} and ${max} ${unit}`}
        rightAccessory={<Text style={styles.unit}>{unit}</Text>}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  toggle: {
    alignItems: 'center',
  },
  unit: {
    ...typeScale.callout,
    color: colors.textSecondary,
  },
});
