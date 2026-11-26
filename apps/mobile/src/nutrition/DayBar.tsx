import { Feather } from '@expo/vector-icons';
import { Animated, Pressable, StyleSheet, View } from 'react-native';
import { Card } from '../design/Card';
import { Text } from '../design/Text';
import { colors, minTouchTarget, radii, spacing, typeScale } from '../design/theme';
import { dayFromKey } from '../lib/dayKey';
import { dayLabel, isTodayKey } from './logDay';
import type { DayDirection } from './useDaySwipe';

interface Props {
  day: string;
  /** The day's widgets' movement as they're swiped (useDaySwipe): the date glides along with it. */
  slide: Animated.Value;
  width: number;
  /** Tapping the date: the calendar, to pick any day. */
  onChooseDay: () => void;
  /** Assistive tech's way to change day -- a swipe isn't something VoiceOver can do. */
  onAdjust: (direction: DayDirection) => void;
  /** The shown day's dot. */
  accentColor: string;
  /**
   * One line, for the Nutrition screen's one page (Harbir's design): an arrow either side --
   * the day before, the day after -- and between them a calendar glyph, "Today" in the accent on
   * today, and the date, tapped for the calendar. No dots. The swipe still turns the day.
   */
  compact?: boolean;
}

/** Sunday to Saturday -- the week the weekly budget counts. */
const WEEK = [0, 1, 2, 3, 4, 5, 6];

/**
 * The Nutrition screen's day: its date ("Saturday, October 24"), with a small "Today" above it on
 * today -- tapping it opens the calendar. There are no arrows and no button back to today: the
 * screen is swiped from day to day (useDaySwipe), and opens on today again once it's left and
 * come back to. (`compact`, the screen's one-page line, has an arrow either side as well.) The date glides with the swipe at a slower pace, fading as it goes. Under it, the
 * week's days as dots (Sunday to Saturday, the week the budget counts), the day shown a short pill
 * in the accent -- a page indicator, so the page reads as one to swipe through, with no words. For
 * VoiceOver it's an adjustable control: swipe up for the next day, down for the day before.
 */
export function DayBar({
  day,
  slide,
  width,
  onChooseDay,
  onAdjust,
  accentColor,
  compact = false,
}: Props) {
  const today = isTodayKey(day);
  const weekday = dayFromKey(day).getDay();
  const label = dayLabel(day);
  const spoken = today ? `Today, ${label}` : label;
  // The one line's shorter date: "Oct 21" (with the year when it isn't this year's).
  const shortDate = dayFromKey(day).toLocaleDateString(undefined, {
    month: 'short',
    day: 'numeric',
    ...(dayFromKey(day).getFullYear() === new Date().getFullYear() ? {} : { year: 'numeric' }),
  });
  const weekdayName = dayFromKey(day).toLocaleDateString(undefined, { weekday: 'long' });
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

  if (compact) {
    return (
      <Card testID="nutrition-day-bar" style={[styles.card, styles.compactCard]}>
        <View style={styles.compactRow}>
          <Pressable
            testID="nutrition-day-previous"
            onPress={() => onAdjust('previous')}
            style={styles.arrow}
            accessibilityRole="button"
            accessibilityLabel="The day before"
          >
            <Feather name="chevron-left" size={22} color={colors.textPrimary} />
          </Pressable>
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
            style={styles.compactLabel}
          >
            <Animated.View style={[styles.compactGlide, glide]}>
              <Feather name="calendar" size={17} color={colors.textSecondary} />
              <Text
                testID="nutrition-day-text"
                style={styles.compactText}
                numberOfLines={1}
                adjustsFontSizeToFit
                minimumFontScale={0.8}
              >
                {today ? (
                  <Text testID="nutrition-day-today-mark" style={{ color: accentColor }}>
                    Today
                  </Text>
                ) : (
                  weekdayName
                )}
                , {shortDate}
              </Text>
            </Animated.View>
          </Pressable>
          <Pressable
            testID="nutrition-day-next"
            onPress={() => onAdjust('next')}
            style={styles.arrow}
            accessibilityRole="button"
            accessibilityLabel="The day after"
          >
            <Feather name="chevron-right" size={22} color={colors.textPrimary} />
          </Pressable>
        </View>
      </Card>
    );
  }

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
          {/* Its line is kept on every day, so the page never jumps as the day turns. */}
          <Text testID={today ? 'nutrition-day-today-mark' : undefined} style={styles.todayMark}>
            {today ? 'Today' : '\u00a0'}
          </Text>
          <Text style={styles.labelText} numberOfLines={1}>
            {label}
          </Text>
        </Animated.View>
        <View
          testID="nutrition-day-dots"
          style={styles.dots}
          accessibilityElementsHidden
          importantForAccessibility="no-hide-descendants"
        >
          {WEEK.map((index) => (
            <View
              key={index}
              testID={`nutrition-day-dot-${index}`}
              style={[
                styles.dot,
                index === weekday ? [styles.dotShown, { backgroundColor: accentColor }] : null,
              ]}
            />
          ))}
        </View>
      </Pressable>
    </Card>
  );
}

const styles = StyleSheet.create({
  card: {
    paddingVertical: spacing.sm,
    overflow: 'hidden',
  },
  compactCard: {
    paddingVertical: 0,
    paddingHorizontal: spacing.xs,
  },
  compactRow: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  arrow: {
    width: minTouchTarget,
    height: minTouchTarget,
    alignItems: 'center',
    justifyContent: 'center',
  },
  compactLabel: {
    flex: 1,
    minWidth: 0,
    minHeight: minTouchTarget,
    justifyContent: 'center',
  },
  compactGlide: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: spacing.sm,
  },
  compactText: {
    ...typeScale.cardTitle,
    color: colors.textPrimary,
    flexShrink: 1,
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
  dots: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    marginTop: spacing.sm,
  },
  // The membership cards' page dots, drawn smaller: a quiet mark under the date.
  dot: {
    width: 6,
    height: 6,
    borderRadius: radii.pill,
    backgroundColor: colors.glassBorderStrong,
  },
  dotShown: {
    width: 14,
  },
});
