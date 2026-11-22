import { StyleSheet, View } from 'react-native';
import { Text } from '../design/Text';
import { colors, fonts, spacing, typeScale } from '../design/theme';
import { WheelPicker } from '../design/WheelPicker';
import {
  clampDay,
  clampToLatest,
  daysInMonth,
  MONTH_NAMES,
  yearRange,
  type WheelDate,
} from './dateWheelValues';

interface Props {
  testID: string;
  /** month is 0-indexed, matching Date's own convention. */
  month: number;
  day: number;
  year: number;
  onChange: (next: { month: number; day: number; year: number }) => void;
  /** The latest date the wheels go to (onboarding's birthday: 13 years ago today). The year
   * wheel ends at its year, and in that year the months and days end at it, so nothing later
   * can be picked. */
  latest?: WheelDate;
  /** The "Month Day, Year" line under the wheels -- off where the date is shown above them
   * instead (onboarding's birthday card). */
  showPreview?: boolean;
}

const YEARS = yearRange();

/** Month/Day/Year scroll wheels -- the presentation is always Month Day, Year regardless of locale (per spec), while the value stored is a plain calendar date. */
export function DateWheelPicker({
  testID,
  month,
  day,
  year,
  onChange,
  latest,
  showPreview = true,
}: Props) {
  const years = latest ? yearRange(new Date(), latest.year) : YEARS;
  const inLatestYear = latest !== undefined && year === latest.year;
  const months = inLatestYear ? MONTH_NAMES.slice(0, latest.month + 1) : MONTH_NAMES;
  const dayCount = inLatestYear && month === latest.month ? latest.day : daysInMonth(month, year);
  const days = Array.from({ length: dayCount }, (_, i) => String(i + 1));

  function emit(next: WheelDate) {
    onChange(clampToLatest(next, latest));
  }

  function handleMonthChange(value: string) {
    const nextMonth = MONTH_NAMES.indexOf(value);
    emit({ month: nextMonth, day: clampDay(day, nextMonth, year), year });
  }

  function handleDayChange(value: string) {
    emit({ month, day: Number(value), year });
  }

  function handleYearChange(value: string) {
    const nextYear = Number(value);
    emit({ month, day: clampDay(day, month, nextYear), year: nextYear });
  }

  return (
    <View testID={testID} style={styles.row}>
      <View style={styles.monthColumn}>
        <WheelPicker
          testID={`${testID}-month`}
          values={months}
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
          values={years.map(String)}
          selectedValue={String(year)}
          onChange={handleYearChange}
        />
      </View>
      {showPreview ? (
        <Text style={styles.preview}>
          {MONTH_NAMES[month]} {day}, {year}
        </Text>
      ) : null}
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
    ...typeScale.secondary,
    position: 'absolute',
    bottom: -spacing.xl,
    left: 0,
    right: 0,
    textAlign: 'center',
    color: colors.textSecondary,
    fontFamily: fonts.displayMedium,
  },
});
