import { StyleSheet, View } from 'react-native';
import { StatValue } from './StatValue';
import { Text } from './Text';
import { colors, typeScale } from './theme';

interface Props {
  value: string;
  /** A short unit rendered small beside the value ("kcal", "kg"). */
  unit?: string;
  /** What the number is -- one or two words, under the value. */
  label: string;
  /** `large` (30), `medium` (19) or `small` (15) -- see typeScale's stat tokens. */
  size?: 'large' | 'medium' | 'small';
  /** The value's color. Defaults to primary text (neutral); pass the active accent only for the one number that matters most. */
  color?: string;
  align?: 'left' | 'center';
  testID?: string;
}

// A labelled numeric readout: the app's core data-display atom. The number is
// the hero (mono, tabular, sized by `size`), the label is quiet. It is
// deliberately not a card -- a Stat sits directly on a screen or inside a
// row/section, so a screen full of them reads as data, not a pile of boxes.
// The accent is opt-in per Stat (default neutral) because accent-colouring
// every number makes none of them stand out.
export function Stat({
  value,
  unit,
  label,
  size = 'medium',
  color = colors.textPrimary,
  align = 'left',
  testID,
}: Props) {
  return (
    <View testID={testID} style={[styles.container, align === 'center' && styles.center]}>
      {size === 'small' ? (
        <Text
          testID={testID ? `${testID}-value` : undefined}
          style={[typeScale.statSmall, { color }]}
        >
          {value}
          {unit ? <Text style={styles.unit}> {unit}</Text> : null}
        </Text>
      ) : (
        <StatValue
          testID={testID ? `${testID}-value` : undefined}
          value={value}
          unit={unit}
          size={size}
          color={color}
        />
      )}
      <Text style={styles.label}>{label}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    gap: 2,
  },
  center: {
    alignItems: 'center',
  },
  unit: {
    ...typeScale.caption,
    color: colors.textSecondary,
  },
  label: {
    ...typeScale.caption,
    color: colors.textSecondary,
  },
});
