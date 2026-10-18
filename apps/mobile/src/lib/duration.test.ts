import { describeDuration, formatDuration, parseDuration } from './duration';

describe('parseDuration', () => {
  it('reads seconds, minutes:seconds and hours:minutes:seconds', () => {
    expect(parseDuration('45')).toBe(45);
    expect(parseDuration('90')).toBe(90);
    expect(parseDuration('1:30')).toBe(90);
    expect(parseDuration('0:45')).toBe(45);
    expect(parseDuration('1:02:30')).toBe(3750);
    expect(parseDuration(' 2:00 ')).toBe(120);
  });

  it("isn't a duration when it's empty, zero, malformed or has a part past 59", () => {
    for (const text of ['', '0', '0:00', '1:60', '1:5:', 'abc', '1.5', '-30', '1:2:3:4']) {
      expect(parseDuration(text)).toBeNull();
    }
  });
});

describe('formatDuration', () => {
  it('shows minutes:seconds, with hours for a long hold', () => {
    expect(formatDuration(45)).toBe('0:45');
    expect(formatDuration(90)).toBe('1:30');
    expect(formatDuration(600)).toBe('10:00');
    expect(formatDuration(3750)).toBe('1:02:30');
  });

  it('round-trips with parseDuration', () => {
    for (const seconds of [1, 45, 59, 60, 90, 3599, 3600, 3750]) {
      expect(parseDuration(formatDuration(seconds))).toBe(seconds);
    }
  });
});

describe('describeDuration', () => {
  it('words a duration for assistive tech', () => {
    expect(describeDuration(45)).toBe('45 seconds');
    expect(describeDuration(90)).toBe('1 minute 30 seconds');
    expect(describeDuration(120)).toBe('2 minutes');
    expect(describeDuration(3750)).toBe('1 hour 2 minutes 30 seconds');
  });
});
