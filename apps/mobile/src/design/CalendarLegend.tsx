import { StyleSheet, View } from 'react-native';
import { Text } from './Text';
import { colors, spacing, typeScale } from './theme';

interface Props {
  /** Each dot's colour and what it means, in order. */
  items: readonly { color: string; label: string }[];
}

/** The key under a history calendar: a small dot per kind of day, with what it means. */
export function CalendarLegend({ items }: Props) {
  return (
    <View style={styles.legendRow}>
      {items.map((item) => (
        <View key={item.label} style={styles.legendItem}>
          <View style={[styles.legendDot, { backgroundColor: item.color }]} />
          <Text style={styles.legendLabel}>{item.label}</Text>
        </View>
      ))}
    </View>
  );
}

const styles = StyleSheet.create({
  legendRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: spacing.lg,
    marginVertical: spacing.md,
  },
  legendItem: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.xs,
  },
  legendDot: {
    width: 8,
    height: 8,
    borderRadius: 4,
  },
  legendLabel: {
    ...typeScale.secondary,
    color: colors.textMuted,
  },
});
