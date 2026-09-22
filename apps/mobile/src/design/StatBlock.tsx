import { StyleSheet, View } from 'react-native';
import { Text } from './Text';
import { colors, radii, spacing, typeScale } from './theme';

interface Props {
  /** The figure, already formatted ("45 min", "1,250 kg", "12"). Set in the mono readout face. */
  value: string;
  /** What it is -- one or two words, under the figure. */
  label: string;
  /** The figure's colour. Neutral by default; pass the mode accent for the one figure that matters most. */
  valueColor?: string;
  testID?: string;
}

// One block of a stat grid inside a widget (a card): a quiet raised surface,
// the figure as the hero, its label beneath. Blocks in a grid are separated
// by exactly `widgetGap` (6px) -- the same rhythm as between widgets -- with no
// borders or icons. Not a card: it sits inside one.
export function StatBlock({ value, label, valueColor = colors.textPrimary, testID }: Props) {
  return (
    <View testID={testID} style={styles.block}>
      <Text style={[styles.value, { color: valueColor }]} numberOfLines={1}>
        {value}
      </Text>
      <Text style={styles.label}>{label}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  block: {
    flex: 1,
    minHeight: 68,
    justifyContent: 'center',
    paddingVertical: spacing.sm,
    paddingHorizontal: spacing.md,
    backgroundColor: colors.surfaceRaised,
    borderRadius: radii.md,
  },
  value: {
    ...typeScale.statMedium,
  },
  label: {
    ...typeScale.caption,
    color: colors.textSecondary,
    marginTop: 2,
  },
});
