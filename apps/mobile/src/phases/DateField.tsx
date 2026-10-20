import { useState } from 'react';
import { Pressable, StyleSheet, View } from 'react-native';
import { Feather } from '@expo/vector-icons';
import { BottomSheet } from '../design/BottomSheet';
import { TextButton } from '../design/Button';
import { MonthCalendar } from '../design/MonthCalendar';
import { Text } from '../design/Text';
import { addMonths } from '../design/calendarGrid';
import { colors, minTouchTarget, radii, spacing, typeScale } from '../design/theme';
import { dayFromKey, dayKey } from './phaseRules';

const NO_MARKED_DATES = new Set<string>();

/** "Oct 19, 2026". */
export function formatDayKey(key: string): string {
  return dayFromKey(key).toLocaleDateString(undefined, {
    month: 'short',
    day: 'numeric',
    year: 'numeric',
  });
}

interface Props {
  label: string;
  /** "YYYY-MM-DD", or null for no date. */
  value: string | null;
  onChange: (value: string | null) => void;
  /** Shown when there's no date, for a field that can be left empty. */
  emptyLabel?: string;
  /** Offer to clear the date (an end date left open). */
  clearable?: boolean;
  /** Days after this can't be picked -- today, for a phase. */
  maxKey?: string;
  accentColor: string;
  onAccentColor: string;
  testID: string;
}

/**
 * A date as a field that opens the month calendar in a bottom sheet -- the same calendar Log a
 * Past Workout picks its date with. A day after `maxKey` is refused, not picked.
 */
export function DateField({
  label,
  value,
  onChange,
  emptyLabel = 'Not set',
  clearable = false,
  maxKey,
  accentColor,
  onAccentColor,
  testID,
}: Props) {
  const [open, setOpen] = useState(false);
  const shown = value ? dayFromKey(value) : new Date();
  const [month, setMonth] = useState({ year: shown.getFullYear(), month: shown.getMonth() + 1 });

  return (
    <View>
      <Text style={styles.label}>{label}</Text>
      <Pressable
        testID={testID}
        style={styles.field}
        onPress={() => {
          const start = value ? dayFromKey(value) : new Date();
          setMonth({ year: start.getFullYear(), month: start.getMonth() + 1 });
          setOpen(true);
        }}
        accessibilityRole="button"
        accessibilityLabel={`${label}, ${value ? formatDayKey(value) : emptyLabel}`}
      >
        <Text style={value ? styles.value : styles.empty}>
          {value ? formatDayKey(value) : emptyLabel}
        </Text>
        <Feather name="calendar" size={16} color={colors.textMuted} />
      </Pressable>
      {clearable && value ? (
        <TextButton
          testID={`${testID}-clear`}
          label={`Clear ${label}`}
          onPress={() => onChange(null)}
        />
      ) : null}

      <BottomSheet visible={open} onClose={() => setOpen(false)} testID={`${testID}-sheet`}>
        <MonthCalendar
          testID={`${testID}-calendar`}
          year={month.year}
          month={month.month}
          markedDateKeys={NO_MARKED_DATES}
          markedDescription=""
          selectedDateKey={value}
          todayKey={dayKey(new Date())}
          accentColor={accentColor}
          onAccentColor={onAccentColor}
          onSelectDate={(key) => {
            if (maxKey && key > maxKey) return;
            onChange(key);
            setOpen(false);
          }}
          onPrevMonth={() => setMonth((prev) => addMonths(prev.year, prev.month, -1))}
          onNextMonth={() => setMonth((prev) => addMonths(prev.year, prev.month, 1))}
        />
      </BottomSheet>
    </View>
  );
}

const styles = StyleSheet.create({
  label: {
    ...typeScale.label,
    color: colors.textSecondary,
    marginBottom: spacing.xs,
  },
  field: {
    minHeight: minTouchTarget,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: spacing.xs,
    backgroundColor: colors.surface,
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: radii.md,
    paddingHorizontal: spacing.md,
  },
  value: {
    ...typeScale.body,
    color: colors.textPrimary,
  },
  empty: {
    ...typeScale.body,
    color: colors.textMuted,
  },
});
