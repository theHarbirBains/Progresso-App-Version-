import { compareToPrevious } from './progressiveOverload';
import type { SetRecord } from './workoutQueries';

// Identity-ish formatter: keeps assertions readable while still exercising
// the fact that the comparison itself always happens in kg, and only the
// caller-supplied formatter ever touches display units.
const fmt = (kg: number) => `${kg}kg`;

function set(id: string, weightKg: number, reps: number): SetRecord {
  return { id, setIndex: 1, weightKg, reps };
}

describe('compareToPrevious', () => {
  it('returns null when there are no current sets', () => {
    expect(compareToPrevious([], [set('p1', 100, 8)], fmt)).toBeNull();
  });

  it('returns null when there is no previous performance', () => {
    expect(compareToPrevious([set('c1', 100, 8)], [], fmt)).toBeNull();
  });

  it('reports a weight delta when the top set is heavier at the same rep count', () => {
    const result = compareToPrevious([set('c1', 110, 8)], [set('p1', 100, 8)], fmt);
    expect(result).toEqual({ message: '+10kg at 8 reps' });
  });

  it('reports the before/after weight when the top set is heavier at a different rep count', () => {
    const result = compareToPrevious([set('c1', 175, 6)], [set('p1', 165, 8)], fmt);
    expect(result).toEqual({ message: 'Your top set increased from 165kg to 175kg' });
  });

  it('reports a match when the same weight is lifted for more reps', () => {
    const result = compareToPrevious([set('c1', 100, 10)], [set('p1', 100, 8)], fmt);
    expect(result).toEqual({ message: 'Matched your previous weight for more reps' });
  });

  it('returns null when the top set is lighter than previous', () => {
    expect(compareToPrevious([set('c1', 90, 8)], [set('p1', 100, 8)], fmt)).toBeNull();
  });

  it('returns null when weight and reps both match exactly', () => {
    expect(compareToPrevious([set('c1', 100, 8)], [set('p1', 100, 8)], fmt)).toBeNull();
  });

  it('compares canonical kg values, unaffected by the display formatter', () => {
    // Formatter deliberately drops precision -- the comparison itself must
    // still be correct because it operates on the raw kg numbers, not on
    // formatted strings.
    const roundingFmt = (kg: number) => `${Math.round(kg)}`;
    const result = compareToPrevious([set('c1', 100.4, 8)], [set('p1', 100.1, 8)], roundingFmt);
    expect(result).toEqual({ message: '+0 at 8 reps' });
  });

  it('uses the heaviest set among several when picking the current top set', () => {
    const current = [set('c1', 90, 10), set('c2', 120, 5)];
    const result = compareToPrevious(current, [set('p1', 100, 5)], fmt);
    expect(result).toEqual({ message: '+20kg at 5 reps' });
  });
});
