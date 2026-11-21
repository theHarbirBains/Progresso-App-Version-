import { Pressable, StyleSheet, View } from 'react-native';
import { Text } from '../../design/Text';
import { colors, fonts, radii, spacing, typeScale } from '../../design/theme';

export interface WeekBar {
  key: string;
  /** "S", "M", ... under the bar. */
  letter: string;
  /** How full, 0-1; null draws an empty track (nothing to show that day). */
  fraction: number | null;
  /** A small figure over the bar ("12", "80%", "—"); none leaves the room empty. */
  label?: string | null;
  /** A day ahead: faded. */
  muted?: boolean;
  /** The day being looked at: its letter in the accent. */
  selected?: boolean;
  /** What VoiceOver reads for the day. */
  accessibilityLabel: string;
}

interface Props {
  days: WeekBar[];
  /** The track's height; the bars fill it from the bottom. */
  height?: number;
  /** A slim strip in a row: no labels or letters, just the seven bars. */
  compact?: boolean;
  accentColor: string;
  /** Tapping a day (not one ahead) opens it. */
  onPressDay?: (key: string) => void;
  testID?: string;
}

/**
 * A week as seven bars, Sunday to Saturday: each a rounded track of `surfaceLift` filled from the
 * bottom in the accent (never past full -- more isn't a warning), a small mono figure over it and
 * its day's letter under it, the day looked at in the accent and the days ahead faded. The
 * Micronutrients pages' weekly tracker; `compact` is the strip a nutrient's row carries.
 */
export function WeekBars({
  days,
  height = 56,
  compact = false,
  accentColor,
  onPressDay,
  testID = 'week-bars',
}: Props) {
  return (
    <View testID={testID} style={[styles.row, compact && styles.rowCompact]}>
      {days.map((day) => {
        const fill = day.fraction === null ? 0 : Math.max(0, Math.min(1, day.fraction));
        const column = (
          <>
            {compact ? null : (
              <Text style={styles.label} numberOfLines={1}>
                {day.label ?? ' '}
              </Text>
            )}
            <View
              style={[
                styles.track,
                compact && styles.trackCompact,
                { height },
                day.selected && !compact ? { borderColor: accentColor } : null,
              ]}
            >
              {fill > 0 ? (
                <View
                  testID={`${testID}-${day.key}-fill`}
                  style={[
                    styles.fill,
                    {
                      height: Math.max(compact ? 2 : 4, height * fill),
                      backgroundColor: accentColor,
                    },
                  ]}
                />
              ) : null}
            </View>
            {compact ? null : (
              <Text
                style={[
                  styles.letter,
                  day.selected ? [styles.letterSelected, { color: accentColor }] : null,
                ]}
              >
                {day.letter}
              </Text>
            )}
          </>
        );
        const style = [styles.column, day.muted && styles.muted];
        return onPressDay && !day.muted ? (
          <Pressable
            key={day.key}
            testID={`${testID}-${day.key}`}
            style={({ pressed }) => [style, pressed && styles.pressed]}
            onPress={() => onPressDay(day.key)}
            accessibilityRole="button"
            accessibilityLabel={day.accessibilityLabel}
            accessibilityState={{ selected: day.selected === true }}
          >
            {column}
          </Pressable>
        ) : (
          <View
            key={day.key}
            testID={`${testID}-${day.key}`}
            style={style}
            accessible
            accessibilityLabel={day.accessibilityLabel}
          >
            {column}
          </View>
        );
      })}
    </View>
  );
}

const styles = StyleSheet.create({
  row: {
    flexDirection: 'row',
    gap: spacing.sm,
  },
  rowCompact: {
    gap: 3,
  },
  column: {
    flex: 1,
    alignItems: 'center',
    gap: spacing.xs,
  },
  muted: {
    opacity: 0.35,
  },
  pressed: {
    opacity: 0.7,
  },
  label: {
    ...typeScale.caption,
    fontFamily: fonts.mono,
    color: colors.textSecondary,
  },
  track: {
    alignSelf: 'stretch',
    justifyContent: 'flex-end',
    overflow: 'hidden',
    borderRadius: radii.sm,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: 'transparent',
    backgroundColor: colors.surfaceLift,
  },
  trackCompact: {
    borderRadius: 2,
  },
  fill: {
    borderRadius: radii.sm,
  },
  letter: {
    ...typeScale.caption,
    color: colors.textMuted,
  },
  letterSelected: {
    fontFamily: fonts.semibold,
  },
});
