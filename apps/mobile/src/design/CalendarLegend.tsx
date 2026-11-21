import { Feather } from '@expo/vector-icons';
import { StyleSheet, View } from 'react-native';
import { Text } from './Text';
import { colors, spacing, typeScale } from './theme';

interface Props {
  /** Each mark's colour and what it means, in order -- a dot, or the glyph given (a rest day's moon). */
  items: readonly { color: string; label: string; icon?: keyof typeof Feather.glyphMap }[];
}

/** The key under a history calendar: a small dot (or glyph) per kind of day, with what it means. */
export function CalendarLegend({ items }: Props) {
  return (
    <View style={styles.legendRow}>
      {items.map((item) => (
        <View key={item.label} style={styles.legendItem}>
          {item.icon ? (
            <Feather name={item.icon} size={10} color={item.color} />
          ) : (
            <View style={[styles.legendDot, { backgroundColor: item.color }]} />
          )}
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
