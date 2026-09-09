import { StyleSheet, Text, View } from 'react-native';
import { colors, fonts, spacing } from '../design/theme';
import { WheelPicker } from '../design/WheelPicker';
import { clampDay, daysInMonth, MONTH_NAMES, yearRange } from './dateWheelValues';

interface Props {
  testID: string;
  /** month is 0-indexed, matching Date's own convention. */
  month: number;
  day: number;
  year: number;
  onChange: (next: { month: number; day: number; year: number }) => void;
}

const YEARS = yearRange();

/** Month/Day/Year scroll wheels -- the presentation is always Month Day, Year regardless of locale (per spec), while the value stored is a plain calendar date. */
export function DateWheelPicker({ testID, month, day, year, onChange }: Props) {
  const dayCount = daysInMonth(month, year);
  const days = Array.from({ length: dayCount }, (_, i) => String(i + 1));

  function handleMonthChange(value: string) {
    const nextMonth = MONTH_NAMES.indexOf(value);
    onChange({ month: nextMonth, day: clampDay(day, nextMonth, year), year });
  }

  function handleDayChange(value: string) {
    onChange({ month, day: Number(value), year });
  }

  function handleYearChange(value: string) {
    const nextYear = Number(value);
    onChange({ month, day: clampDay(day, month, nextYear), year: nextYear });
  }

  return (
    <View testID={testID} style={styles.row}>
      <View style={styles.monthColumn}>
        <WheelPicker
          testID={`${testID}-month`}
          values={MONTH_NAMES}
          selectedValue={MONTH_NAMES[month]}
          onChange={handleMonthChange}
        />
      </View>
      <View style={styles.dayColumn}>
        <WheelPicker
          testID={`${testID}-day`}
          values={days}
          selectedValue={String(day)}
          onChange={handleDayChange}
        />
      </View>
      <View style={styles.yearColumn}>
        <WheelPicker
          testID={`${testID}-year`}
          values={YEARS.map(String)}
          selectedValue={String(year)}
          onChange={handleYearChange}
        />
      </View>
      <Text style={styles.preview}>
        {MONTH_NAMES[month]} {day}, {year}
      </Text>
    </View>
  );
}

const styles = StyleSheet.create({
  row: {
    flexDirection: 'row',
  },
  monthColumn: { flex: 3 },
  dayColumn: { flex: 2 },
  yearColumn: { flex: 2 },
  preview: {
    position: 'absolute',
    bottom: -spacing.xl,
    left: 0,
    right: 0,
    textAlign: 'center',
    color: colors.textSecondary,
    fontFamily: fonts.displayMedium,
    fontSize: 13,
  },
});
