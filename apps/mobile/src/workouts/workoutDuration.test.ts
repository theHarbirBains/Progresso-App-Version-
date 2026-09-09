import { computeElapsedSeconds, formatElapsed } from './workoutDuration';

describe('computeElapsedSeconds', () => {
  it('computes seconds elapsed since performedAt', () => {
    const performedAt = '2026-01-01T00:00:00.000Z';
    const now = new Date('2026-01-01T00:01:30.000Z').getTime();
    expect(computeElapsedSeconds(performedAt, now)).toBe(90);
  });

  it('never returns negative elapsed time', () => {
    const performedAt = '2026-01-01T00:05:00.000Z';
    const now = new Date('2026-01-01T00:00:00.000Z').getTime();
    expect(computeElapsedSeconds(performedAt, now)).toBe(0);
  });
});

describe('formatElapsed', () => {
  it('formats under an hour as MM:SS', () => {
    expect(formatElapsed(90)).toBe('01:30');
    expect(formatElapsed(5)).toBe('00:05');
  });

  it('formats an hour or more as H:MM:SS', () => {
    expect(formatElapsed(3661)).toBe('1:01:01');
  });
});
