import { TouchableOpacity, View } from 'react-native';
import { Text } from '../design/Text';
import { TIME_RANGES, type TimeRange } from '../workouts/exerciseProgress';
import { progressStyles as styles } from './progressStyles';

interface Props {
  value: TimeRange;
  onChange: (range: TimeRange) => void;
  accentColor: string;
  onAccentColor: string;
}

/** The 4W/3M/6M/1Y/All chip row, reused across every Progress screen with a chart. */
export function TimeRangeSelector({ value, onChange, accentColor, onAccentColor }: Props) {
  return (
    <View style={styles.chipRow}>
      {TIME_RANGES.map((range) => {
        const selected = value === range.value;
        return (
          <TouchableOpacity
            key={range.value}
            testID={`time-range-${range.value}`}
            style={[
              styles.chip,
              selected && { backgroundColor: accentColor, borderColor: accentColor },
            ]}
            onPress={() => onChange(range.value)}
            hitSlop={{ top: 4, bottom: 4, left: 0, right: 0 }}
            accessibilityRole="button"
            accessibilityLabel={range.label}
            accessibilityState={{ selected }}
          >
            <Text style={[styles.chipText, selected && { color: onAccentColor }]}>
              {range.label}
            </Text>
          </TouchableOpacity>
        );
      })}
    </View>
  );
}
