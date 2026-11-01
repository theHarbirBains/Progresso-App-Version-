import { useState } from 'react';
import { addMonths } from './calendarGrid';

interface Initial {
  year: number;
  /** 1-12. */
  month: number;
  selectedDateKey?: string | null;
}

/**
 * The month a history calendar shows and the day picked on it (Workout History, Nutrition
 * History). Moving a month clears the day picked and hands `onMove` the month moved to, for its
 * read; picking the day already picked unpicks it.
 */
export function useCalendarMonth(initial: Initial, onMove: (year: number, month: number) => void) {
  const [shown, setShown] = useState({ year: initial.year, month: initial.month });
  const [selectedDateKey, setSelectedDateKey] = useState<string | null>(
    initial.selectedDateKey ?? null,
  );

  function move(delta: number) {
    const next = addMonths(shown.year, shown.month, delta);
    setShown(next);
    setSelectedDateKey(null);
    onMove(next.year, next.month);
  }

  return {
    year: shown.year,
    month: shown.month,
    selectedDateKey,
    prevMonth: () => move(-1),
    nextMonth: () => move(1),
    selectDate(dateKey: string) {
      setSelectedDateKey((prev) => (prev === dateKey ? null : dateKey));
    },
  };
}
