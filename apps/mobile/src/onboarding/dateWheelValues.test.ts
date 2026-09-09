import {
  clampDay,
  currentMaxYear,
  daysInMonth,
  formatMonthDayYear,
  MONTH_NAMES,
  toDateStringUTC,
  yearRange,
} from './dateWheelValues';

describe('daysInMonth / clampDay', () => {
  it('returns 28 for February in a non-leap year', () => {
    expect(daysInMonth(1, 2001)).toBe(28);
  });

  it('returns 29 for February in a leap year', () => {
    expect(daysInMonth(1, 2000)).toBe(29);
  });

  it('clamps day 31 down to 28 when switching to February', () => {
    expect(clampDay(31, 1, 2001)).toBe(28);
  });

  it('leaves an already-valid day untouched', () => {
    expect(clampDay(15, 0, 2001)).toBe(15);
  });
});

describe('yearRange / currentMaxYear', () => {
  it('never includes a year after the given "now"', () => {
    const now = new Date(2026, 0, 1);
    expect(currentMaxYear(now)).toBe(2026);
    expect(Math.max(...yearRange(now))).toBe(2026);
  });

  it('descends from the max year down to 1900', () => {
    const now = new Date(2026, 0, 1);
    const years = yearRange(now);
    expect(years[0]).toBe(2026);
    expect(years[years.length - 1]).toBe(1900);
  });
});

describe('formatMonthDayYear', () => {
  it('formats as "Month Day, Year" regardless of locale', () => {
    expect(formatMonthDayYear(new Date(2001, 8, 14))).toBe('September 14, 2001');
  });
});

describe('toDateStringUTC', () => {
  it('formats a zero-indexed month into a YYYY-MM-DD string', () => {
    expect(toDateStringUTC(8, 14, 2001)).toBe('2001-09-14');
  });

  it('pads single-digit months and days', () => {
    expect(toDateStringUTC(0, 5, 2001)).toBe('2001-01-05');
  });

  it('MONTH_NAMES has exactly 12 entries starting with January', () => {
    expect(MONTH_NAMES).toHaveLength(12);
    expect(MONTH_NAMES[0]).toBe('January');
    expect(MONTH_NAMES[11]).toBe('December');
  });
});
