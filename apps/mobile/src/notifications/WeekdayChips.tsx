import { StyleSheet, TouchableOpacity, View } from 'react-native';
import { Text } from '../design/Text';
import { colors, minTouchTarget, radii, spacing, typeScale } from '../design/theme';

// Monday first. 0 is Sunday, as Date counts.
const DAYS = [
  { day: 1, short: 'M', name: 'Monday' },
  { day: 2, short: 'T', name: 'Tuesday' },
  { day: 3, short: 'W', name: 'Wednesday' },
  { day: 4, short: 'T', name: 'Thursday' },
  { day: 5, short: 'F', name: 'Friday' },
  { day: 6, short: 'S', name: 'Saturday' },
  { day: 0, short: 'S', name: 'Sunday' },
];

interface Props {
  days: number[];
  onChange: (days: number[]) => void;
  accentColor: string;
  onAccentColor: string;
  disabled?: boolean;
  testID?: string;
}

/**
 * The days a reminder comes on: seven round chips, Monday to Sunday, any number chosen -- the
 * filter chips' look (filled with the accent when chosen, a hairline when not), sized to fit a
 * row on the narrowest iPhone.
 */
export function WeekdayChips({
  days,
  onChange,
  accentColor,
  onAccentColor,
  disabled,
  testID,
}: Props) {
  const chosen = new Set(days);
  return (
    <View testID={testID} style={styles.row}>
      {DAYS.map(({ day, short, name }) => {
        const selected = chosen.has(day);
        return (
          <TouchableOpacity
            key={day}
            testID={testID ? `${testID}-${day}` : undefined}
            disabled={disabled}
            onPress={() => {
              const next = new Set(chosen);
              if (selected) next.delete(day);
              else next.add(day);
              onChange(Array.from(next).sort((a, b) => a - b));
            }}
            style={[
              styles.chip,
              selected
                ? { backgroundColor: accentColor, borderColor: accentColor }
                : { borderColor: colors.border },
              disabled && styles.disabled,
            ]}
            accessibilityRole="checkbox"
            accessibilityLabel={name}
            accessibilityState={{ checked: selected, disabled }}
          >
            <Text
              style={[styles.label, { color: selected ? onAccentColor : colors.textSecondary }]}
            >
              {short}
            </Text>
          </TouchableOpacity>
        );
      })}
    </View>
  );
}

const styles = StyleSheet.create({
  row: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    gap: spacing.xs,
  },
  chip: {
    width: minTouchTarget - spacing.xs,
    height: minTouchTarget - spacing.xs,
    alignItems: 'center',
    justifyContent: 'center',
    borderRadius: radii.pill,
    borderWidth: 1,
    backgroundColor: colors.surfaceRaised,
  },
  label: {
    ...typeScale.callout,
    fontFamily: typeScale.label.fontFamily,
  },
  disabled: {
    opacity: 0.5,
  },
});
