import { StyleSheet, TouchableOpacity, View } from 'react-native';
import { Text } from '../design/Text';
import { Feather } from '@expo/vector-icons';
import { colors, fonts, minTouchTarget, radii, spacing, typeScale } from '../design/theme';
import { buildMonthGrid, MONTH_LABELS, WEEKDAY_LABELS } from './calendarGrid';

interface Props {
  testID?: string;
  year: number;
  month: number;
  completedDateKeys: Set<string>;
  selectedDateKey: string | null;
  todayKey: string;
  accentColor: string;
  onAccentColor: string;
  onSelectDate: (dateKey: string) => void;
  onPrevMonth: () => void;
  onNextMonth: () => void;
}

// Component Logic: one 7-column grid of fixed-size day cells, each deriving
// its visual state (today/selected/completed/dimmed) from three plain
// booleans rather than a combinatorial style-variant prop -- no per-cell
// wrapper beyond the single TouchableOpacity + its dot. Each day is named for
// assistive tech ("September 5, workout completed"), and the month arrows are
// full 44pt targets.
function describeDay(dateKey: string, completed: boolean): string {
  const [y, m, d] = dateKey.split('-').map(Number);
  const label = new Date(y, m - 1, d).toLocaleDateString(undefined, {
    month: 'long',
    day: 'numeric',
  });
  return completed ? `${label}, workout completed` : label;
}

export function MonthCalendar({
  testID,
  year,
  month,
  completedDateKeys,
  selectedDateKey,
  todayKey,
  accentColor,
  onAccentColor,
  onSelectDate,
  onPrevMonth,
  onNextMonth,
}: Props) {
  const days = buildMonthGrid(year, month);

  return (
    <View testID={testID} style={styles.container}>
      <View style={styles.monthRow}>
        <TouchableOpacity
          testID="calendar-prev-month"
          style={styles.navButton}
          onPress={onPrevMonth}
          accessibilityLabel="Previous month"
          accessibilityRole="button"
        >
          <Feather name="chevron-left" size={18} color={colors.textSecondary} />
        </TouchableOpacity>
        <Text style={styles.monthLabel}>
          {MONTH_LABELS[month - 1]} {year}
        </Text>
        <TouchableOpacity
          testID="calendar-next-month"
          style={styles.navButton}
          onPress={onNextMonth}
          accessibilityLabel="Next month"
          accessibilityRole="button"
        >
          <Feather name="chevron-right" size={18} color={colors.textSecondary} />
        </TouchableOpacity>
      </View>

      <View style={styles.weekdayRow}>
        {WEEKDAY_LABELS.map((label) => (
          <Text key={label} style={styles.weekdayLabel}>
            {label}
          </Text>
        ))}
      </View>

      <View style={styles.grid}>
        {days.map((day) => {
          const isToday = day.dateKey === todayKey;
          const isSelected = day.dateKey === selectedDateKey;
          const isCompleted = completedDateKeys.has(day.dateKey);

          return (
            <TouchableOpacity
              key={day.dateKey}
              testID={`calendar-day-${day.dateKey}`}
              style={styles.dayCell}
              onPress={() => onSelectDate(day.dateKey)}
              activeOpacity={0.7}
              accessibilityRole="button"
              accessibilityLabel={describeDay(day.dateKey, isCompleted)}
              accessibilityState={{ selected: isSelected }}
            >
              <View
                style={[
                  styles.dayCircle,
                  isToday && { backgroundColor: accentColor },
                  isSelected && !isToday && { borderWidth: 1, borderColor: accentColor },
                ]}
              >
                <Text
                  style={[
                    styles.dayText,
                    !day.inCurrentMonth && styles.dayTextDim,
                    isToday && { color: onAccentColor, fontFamily: fonts.display },
                  ]}
                >
                  {day.day}
                </Text>
              </View>
              <View
                testID={testID ? `${testID}-dot-${day.dateKey}` : undefined}
                style={[styles.dot, isCompleted && { backgroundColor: accentColor, opacity: 1 }]}
              />
            </TouchableOpacity>
          );
        })}
      </View>
    </View>
  );
}

const CELL_SIZE = 36;

const styles = StyleSheet.create({
  container: {
    marginBottom: spacing.lg,
  },
  monthRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: spacing.xs,
  },
  navButton: {
    width: minTouchTarget,
    height: minTouchTarget,
    alignItems: 'center',
    justifyContent: 'center',
  },
  monthLabel: {
    ...typeScale.cardTitle,
    color: colors.textPrimary,
  },
  weekdayRow: {
    flexDirection: 'row',
    marginBottom: spacing.xs,
  },
  weekdayLabel: {
    flex: 1,
    textAlign: 'center',
    ...typeScale.caption,
    color: colors.textMuted,
  },
  grid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
  },
  dayCell: {
    width: `${100 / 7}%`,
    alignItems: 'center',
    paddingVertical: spacing.xs,
  },
  dayCircle: {
    width: CELL_SIZE,
    height: CELL_SIZE,
    borderRadius: radii.pill,
    alignItems: 'center',
    justifyContent: 'center',
  },
  dayText: {
    ...typeScale.callout,
    color: colors.textPrimary,
  },
  dayTextDim: {
    color: colors.textMuted,
  },
  dot: {
    width: 4,
    height: 4,
    borderRadius: 2,
    marginTop: 4,
    opacity: 0,
  },
});
