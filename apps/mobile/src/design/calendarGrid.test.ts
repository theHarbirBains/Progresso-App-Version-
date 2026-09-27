import { addMonths, buildMonthGrid, isoToLocalDateKey, toLocalDateKey } from './calendarGrid';

describe('toLocalDateKey / isoToLocalDateKey', () => {
  it('formats a Date as local YYYY-MM-DD', () => {
    expect(toLocalDateKey(new Date(2026, 8, 7))).toBe('2026-09-07');
  });

  it('pads single-digit months and days', () => {
    expect(toLocalDateKey(new Date(2026, 0, 5))).toBe('2026-01-05');
  });

  it('derives the same key from an ISO timestamp', () => {
    expect(isoToLocalDateKey(new Date(2026, 8, 7, 14, 30).toISOString())).toBe('2026-09-07');
  });
});

describe('buildMonthGrid', () => {
  it('includes every day of the month, marked as inCurrentMonth', () => {
    const grid = buildMonthGrid(2026, 9);
    const currentMonthDays = grid.filter((d) => d.inCurrentMonth);
    expect(currentMonthDays).toHaveLength(30);
    expect(currentMonthDays[0].dateKey).toBe('2026-09-01');
    expect(currentMonthDays[29].dateKey).toBe('2026-09-30');
  });

  it('pads leading days from the previous month so the grid starts on Sunday', () => {
    // September 1, 2026 is a Tuesday, so 2 leading days (Sun/Mon) come from August.
    const grid = buildMonthGrid(2026, 9);
    const leading = grid.filter((d) => !d.inCurrentMonth && d.dateKey < '2026-09-01');
    expect(leading).toHaveLength(2);
    expect(leading[0].dateKey).toBe('2026-08-30');
    expect(leading[1].dateKey).toBe('2026-08-31');
  });

  it('pads trailing days so every week row is complete (a multiple of 7)', () => {
    const grid = buildMonthGrid(2026, 9);
    expect(grid.length % 7).toBe(0);
  });
});

describe('addMonths', () => {
  it('moves forward a month', () => {
    expect(addMonths(2026, 9, 1)).toEqual({ year: 2026, month: 10 });
  });

  it('moves backward a month', () => {
    expect(addMonths(2026, 9, -1)).toEqual({ year: 2026, month: 8 });
  });

  it('rolls over into the next year', () => {
    expect(addMonths(2026, 12, 1)).toEqual({ year: 2027, month: 1 });
  });

  it('rolls back into the previous year', () => {
    expect(addMonths(2026, 1, -1)).toEqual({ year: 2025, month: 12 });
  });
});
