import { isLiveRecord } from '../workouts/topSetSummary';
import { shareDisplayNames, shareTitle } from './shareNames';

describe('shareDisplayNames', () => {
  it('leaves a closing parenthetical off where that confuses it with nothing else', () => {
    expect(
      shareDisplayNames(['Machine Shoulder Press (Double Stack)', 'Romanian Deadlift (RDL)']),
    ).toEqual(['Machine Shoulder Press', 'Romanian Deadlift']);
  });

  it('keeps it where two exercises would read the same, or another is already called that', () => {
    expect(shareDisplayNames(['Leg Press (Wide)', 'Leg Press (Narrow)'])).toEqual([
      'Leg Press (Wide)',
      'Leg Press (Narrow)',
    ]);
    expect(shareDisplayNames(['Leg Press (Plate Loaded)', 'Leg Press'])).toEqual([
      'Leg Press (Plate Loaded)',
      'Leg Press',
    ]);
  });

  it('never shortens a variation written into the name itself', () => {
    expect(shareDisplayNames(['Seated Cable Row — Close-Grip V-Handle'])).toEqual([
      'Seated Cable Row — Close-Grip V-Handle',
    ]);
  });
});

describe('shareTitle', () => {
  it("keeps the workout's own name", () => {
    expect(shareTitle('Shoulders & Arms', ['Shoulders'], false)).toBe('Shoulders & Arms');
  });

  it('says what a workout without a real name trained', () => {
    expect(shareTitle('Workout', ['Shoulders', 'Biceps', 'Triceps'], false)).toBe(
      'Shoulders, Biceps & Triceps',
    );
    expect(shareTitle('  ', ['Chest'], false)).toBe('Chest');
    expect(shareTitle('', [], true)).toBe('Cardio');
    expect(shareTitle('', [], false)).toBe('Workout');
  });
});

describe('isLiveRecord', () => {
  const records = {
    repPRs: [{ reps: 8, weightKg: 100, sourceSetId: 's1' }] as never,
    oneRepMax: { weightKg: 120, sourceSetId: 's3' } as never,
    record: null,
  };

  it("is a weighted set that's its rep count's PR or the true 1RM now", () => {
    expect(isLiveRecord({ id: 's1', reps: 8 }, 'weight_reps', records)).toBe(true);
    expect(isLiveRecord({ id: 's3', reps: 1 }, 'weight_reps', records)).toBe(true);
    expect(isLiveRecord({ id: 's2', reps: 8 }, 'weight_reps', records)).toBe(false);
  });

  it("is a bodyweight or timed set that's the most reps or the longest now", () => {
    const most = { repPRs: [], oneRepMax: null, record: { sourceSetId: 's9' } as never };
    expect(isLiveRecord({ id: 's9', reps: 20 }, 'bodyweight', most)).toBe(true);
    expect(isLiveRecord({ id: 's8', reps: null }, 'timed', most)).toBe(false);
  });
});
