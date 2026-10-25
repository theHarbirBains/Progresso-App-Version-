import { Animated, Pressable, StyleSheet, View } from 'react-native';
import { Card } from '../design/Card';
import { TextButton } from '../design/Button';
import { Text } from '../design/Text';
import { colors, minTouchTarget, spacing, typeScale } from '../design/theme';
import { dayLabel, isTodayKey } from './logDay';
import type { DayDirection } from './useDaySwipe';

interface Props {
  day: string;
  /** The day's widgets' movement as they're swiped (useDaySwipe): the date glides along with it. */
  slide: Animated.Value;
  width: number;
  onToday: () => void;
  /** Tapping the date: the calendar, to pick any day. */
  onChooseDay: () => void;
  /** Assistive tech's way to change day -- a swipe isn't something VoiceOver can do. */
  onAdjust: (direction: DayDirection) => void;
}

/**
 * The Nutrition screen's day: its date ("Saturday, October 24"), with a small "Today" above it on
 * today -- tapping it opens the calendar -- and, on any other day, a way straight back to today. There are no arrows:
 * the screen is swiped from day to day (useDaySwipe), and the date glides with the swipe at a
 * slower pace, fading as it goes. For VoiceOver it's an adjustable control: swipe up for the
 * next day, down for the day before.
 */
export function DayBar({ day, slide, width, onToday, onChooseDay, onAdjust }: Props) {
  const today = isTodayKey(day);
  const label = dayLabel(day);
  const spoken = today ? `Today, ${label}` : label;
  const glide = {
    opacity: slide.interpolate({
      inputRange: [-width * 0.5, 0, width * 0.5],
      outputRange: [0, 1, 0],
      extrapolate: 'clamp',
    }),
    transform: [
      {
        translateX: slide.interpolate({
          inputRange: [-width, 0, width],
          outputRange: [-width * 0.4, 0, width * 0.4],
          extrapolate: 'clamp',
        }),
      },
    ],
  };

  return (
    <Card testID="nutrition-day-bar" style={styles.card}>
      <Pressable
        testID="nutrition-day-label"
        accessibilityRole="adjustable"
        accessibilityLabel="Day"
        accessibilityValue={{ text: spoken }}
        accessibilityHint="Double-tap to choose a day."
        accessibilityActions={[{ name: 'increment' }, { name: 'decrement' }]}
        onAccessibilityAction={(event) => {
          if (event.nativeEvent.actionName === 'increment') onAdjust('next');
          if (event.nativeEvent.actionName === 'decrement') onAdjust('previous');
        }}
        onPress={onChooseDay}
        style={styles.label}
      >
        <Animated.View style={[styles.glide, glide]}>
          {today ? (
            <Text testID="nutrition-day-today-mark" style={styles.todayMark}>
              Today
            </Text>
          ) : null}
          <Text style={styles.labelText} numberOfLines={1}>
            {label}
          </Text>
        </Animated.View>
      </Pressable>
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
    overflow: 'hidden',
  },
  label: {
    minHeight: minTouchTarget,
    alignItems: 'center',
    justifyContent: 'center',
  },
  glide: {
    alignItems: 'center',
  },
  todayMark: {
    ...typeScale.caption,
    color: colors.textSecondary,
    textTransform: 'uppercase',
    letterSpacing: 0.8,
  },
  labelText: {
    ...typeScale.cardTitle,
    color: colors.textPrimary,
  },
  today: {
    alignItems: 'center',
  },
});
