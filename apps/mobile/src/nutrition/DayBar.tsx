import { Pressable, StyleSheet, View } from 'react-native';
import { Card } from '../design/Card';
import { IconButton } from '../design/IconButton';
import { TextButton } from '../design/Button';
import { Text } from '../design/Text';
import { colors, minTouchTarget, spacing, typeScale } from '../design/theme';
import { dayLabel, isTodayKey } from './logDay';

interface Props {
  day: string;
  onPrevious: () => void;
  onNext: () => void;
  onToday: () => void;
  /** Tapping the date: the calendar, to pick any day. */
  onChooseDay: () => void;
}

/**
 * The Nutrition screen's day: the day shown, with the day before and the day after on either
 * side (never past today), and -- on any day but today -- a way straight back to today. The date
 * itself opens the calendar. Swiping the screen moves between days too.
 */
export function DayBar({ day, onPrevious, onNext, onToday, onChooseDay }: Props) {
  const today = isTodayKey(day);
  const label = dayLabel(day);
  return (
    <Card testID="nutrition-day-bar" style={styles.card}>
      <View style={styles.row}>
        <IconButton
          testID="nutrition-day-previous"
          icon="chevron-left"
          accessibilityLabel="Previous day"
          onPress={onPrevious}
        />
        <Pressable
          testID="nutrition-day-label"
          accessibilityRole="button"
          accessibilityLabel={`${label}. Choose a day`}
          onPress={onChooseDay}
          style={styles.label}
        >
          <Text style={styles.labelText}>{label}</Text>
        </Pressable>
        <IconButton
          testID="nutrition-day-next"
          icon="chevron-right"
          accessibilityLabel="Next day"
          onPress={onNext}
          disabled={today}
        />
      </View>
      {today ? null : (
        <View style={styles.today}>
          <TextButton testID="nutrition-day-today" label="Back to Today" onPress={onToday} />
        </View>
      )}
    </Card>
  );
}

const styles = StyleSheet.create({
  card: {
    paddingVertical: spacing.sm,
  },
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  label: {
    flex: 1,
    minHeight: minTouchTarget,
    alignItems: 'center',
    justifyContent: 'center',
  },
  labelText: {
    ...typeScale.cardTitle,
    color: colors.textPrimary,
  },
  today: {
    alignItems: 'center',
  },
});
