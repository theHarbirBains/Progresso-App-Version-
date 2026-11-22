import { fetchOneRepMax, fetchRepPRs } from '../workouts/prQueries';
import { fetchWorkoutDetail } from '../workouts/workoutQueries';
import { fetchShareCardData } from './shareCardData';

jest.mock('../workouts/workoutQueries', () => ({
  fetchWorkoutDetail: jest.fn(),
  // Real (pure, no supabase dependency) implementation.
  ...jest.requireActual('../workouts/setCompletion'),
}));

jest.mock('../workouts/prQueries', () => ({
  fetchRepPRs: jest.fn(),
  fetchOneRepMax: jest.fn(),
}));

const mockFetchWorkoutDetail = fetchWorkoutDetail as jest.Mock;
const mockFetchRepPRs = fetchRepPRs as jest.Mock;
const mockFetchOneRepMax = fetchOneRepMax as jest.Mock;

function exercise(overrides: Partial<Record<string, unknown>> = {}) {
  return {
    id: 'we1',
    exerciseId: 'ex1',
    exerciseName: 'Bench Press',
    muscleGroup: 'chest' as const,
    orderIndex: 1,
    sets: [{ id: 's1', setIndex: 1, weightKg: 100, reps: 8 }],
    ...overrides,
  };
}

function workoutDetail(overrides: Partial<Record<string, unknown>> = {}) {
  return {
    id: 'w1',
    name: 'Push Day',
    performedAt: '2026-01-01T10:00:00Z',
    completedAt: '2026-01-01T11:00:00Z',
    exercises: [exercise()],
    ...overrides,
  };
}

beforeEach(() => {
  mockFetchWorkoutDetail.mockReset().mockResolvedValue(workoutDetail());
  mockFetchRepPRs.mockReset().mockResolvedValue([]);
  mockFetchOneRepMax.mockReset().mockResolvedValue(null);
});

describe('fetchShareCardData', () => {
  it('rejects an incomplete (active) workout', async () => {
    mockFetchWorkoutDetail.mockResolvedValue(workoutDetail({ completedAt: null }));

    await expect(fetchShareCardData('w1', 'user-1')).rejects.toThrow(
      'Only completed workouts can be shared',
    );
  });

  it('carries its cardio -- each activity named, with its figures -- and the active time', async () => {
    mockFetchWorkoutDetail.mockResolvedValue(
      workoutDetail({
        strengthEndedAt: '2026-01-01T10:40:00Z',
        cardio: [
          {
            id: 'c1',
            workoutId: 'w1',
            activity: 'outdoor_run',
            name: null,
            durationSeconds: 900,
            distanceM: 2500,
            speedKmh: null,
            afterStrength: true,
            createdAt: '2026-01-01T10:42:00Z',
          },
        ],
      }),
    );

    const result = await fetchShareCardData('w1', 'user-1');

    expect(result.cardio).toEqual([
      {
        activity: 'outdoor_run',
        icon: 'wind',
        name: 'Outdoor Running',
        // Every figure it recorded, never calories.
        figures: '15 min · 2.5 km · 6:00 /km',
        durationSeconds: 900,
      },
    ]);
    expect(result.cardioSeconds).toBe(900);
    // The duration is the whole workout, start to finish: the run is in it once, never added on.
    expect(result.durationMinutes).toBe(60);
    // Cardio is never a set or volume.
    expect(result.totalSets).toBe(1);
  });

  it('has no cardio for a workout without cardio', async () => {
    const result = await fetchShareCardData('w1', 'user-1');

    expect(result.cardio).toEqual([]);
    expect(result.cardioSeconds).toBe(0);
  });

  it('counts every logged set that is a record now, as the workout page does', async () => {
    mockFetchWorkoutDetail.mockResolvedValue(
      workoutDetail({
        exercises: [
          exercise({
            sets: [
              { id: 's1', setIndex: 1, weightKg: 100, reps: 8 },
              { id: 's2', setIndex: 2, weightKg: 90, reps: 10 },
              { id: 's3', setIndex: 3, weightKg: 110, reps: 1 },
            ],
          }),
        ],
      }),
    );
    mockFetchRepPRs.mockResolvedValue([
      { reps: 8, weightKg: 100, sourceSetId: 's1' },
      { reps: 10, weightKg: 95, sourceSetId: 'older' },
    ]);
    mockFetchOneRepMax.mockResolvedValue({ weightKg: 110, sourceSetId: 's3' });

    const result = await fetchShareCardData('w1', 'user-1');

    // The 8-rep PR and the true 1RM; the 10-rep set isn't the record any more.
    expect(result.recordCount).toBe(2);
  });

  it('names each top set as the card shows it, never ambiguously, and says what kind it is', async () => {
    mockFetchWorkoutDetail.mockResolvedValue(
      workoutDetail({
        exercises: [
          exercise({
            id: 'we1',
            exerciseId: 'ex1',
            exerciseName: 'Machine Shoulder Press (Double Stack)',
          }),
          exercise({ id: 'we2', exerciseId: 'ex2', exerciseName: 'Leg Press (Wide)' }),
          exercise({ id: 'we3', exerciseId: 'ex3', exerciseName: 'Leg Press (Narrow)' }),
        ],
      }),
    );

    const result = await fetchShareCardData('w1', 'user-1');

    expect(result.topSets.map((set) => set.displayName)).toEqual([
      'Machine Shoulder Press',
      'Leg Press (Wide)',
      'Leg Press (Narrow)',
    ]);
    expect(result.topSets[0]).toMatchObject({
      exerciseName: 'Machine Shoulder Press (Double Stack)',
      label: 'Top Set',
    });
  });

  it('titles a workout without a name of its own by what it trained', async () => {
    mockFetchWorkoutDetail.mockResolvedValue(
      workoutDetail({
        name: 'Workout',
        exercises: [
          exercise({ id: 'we1', exerciseId: 'ex1', muscleGroup: 'shoulders' }),
          exercise({ id: 'we2', exerciseId: 'ex2', muscleGroup: 'biceps' }),
        ],
      }),
    );

    const result = await fetchShareCardData('w1', 'user-1');

    expect(result.title).toBe('Shoulders & Biceps');
    expect(result.workoutName).toBe('Workout');
  });

  it('returns the workout name, date, and muscles trained', async () => {
    const result = await fetchShareCardData('w1', 'user-1');

    expect(result.workoutName).toBe('Push Day');
    expect(result.performedAt).toBe('2026-01-01T10:00:00Z');
    expect(result.musclesTrained).toBe('Chest');
  });

  it('dedupes muscle groups across exercises', async () => {
    mockFetchWorkoutDetail.mockResolvedValue(
      workoutDetail({
        exercises: [
          exercise({ id: 'we1', exerciseId: 'ex1', muscleGroup: 'chest' }),
          exercise({ id: 'we2', exerciseId: 'ex2', muscleGroup: 'chest' }),
          exercise({ id: 'we3', exerciseId: 'ex3', muscleGroup: 'triceps' }),
        ],
      }),
    );

    const result = await fetchShareCardData('w1', 'user-1');

    expect(result.musclesTrained).toBe('Chest, Triceps');
  });

  it('computes duration from performedAt/completedAt', async () => {
    const result = await fetchShareCardData('w1', 'user-1');

    expect(result.durationMinutes).toBe(60);
  });

  it('returns null duration when completedAt is not after performedAt', async () => {
    mockFetchWorkoutDetail.mockResolvedValue(
      workoutDetail({ performedAt: '2026-01-01T10:00:00Z', completedAt: '2026-01-01T10:00:00Z' }),
    );

    const result = await fetchShareCardData('w1', 'user-1');

    expect(result.durationMinutes).toBeNull();
  });

  it('picks the heaviest set per exercise as its top set', async () => {
    mockFetchWorkoutDetail.mockResolvedValue(
      workoutDetail({
        exercises: [
          exercise({
            sets: [
              { id: 's1', setIndex: 1, weightKg: 100, reps: 10 },
              { id: 's2', setIndex: 2, weightKg: 110, reps: 8 },
            ],
          }),
        ],
      }),
    );

    const result = await fetchShareCardData('w1', 'user-1');

    expect(result.topSets).toEqual([
      {
        exerciseName: 'Bench Press',
        displayName: 'Bench Press',
        label: 'Top Set',
        photoUrl: null,
        measurementType: 'weight_reps',
        weightKg: 110,
        reps: 8,
        durationSeconds: null,
        prLabel: null,
      },
    ]);
  });

  it("returns every exercise's top set, in existing workout order, so the card's PR count covers the whole workout", async () => {
    const exercises = Array.from({ length: 8 }, (_, i) =>
      exercise({ id: `we${i}`, exerciseId: `ex${i}`, exerciseName: `Exercise ${i}` }),
    );
    mockFetchWorkoutDetail.mockResolvedValue(workoutDetail({ exercises }));

    const result = await fetchShareCardData('w1', 'user-1');

    expect(result.topSets.map((s) => s.exerciseName)).toEqual(
      Array.from({ length: 8 }, (_, i) => `Exercise ${i}`),
    );
    expect(mockFetchRepPRs).toHaveBeenCalledTimes(8);
  });

  it("carries each exercise's machine photo, or null when it has none", async () => {
    mockFetchWorkoutDetail.mockResolvedValue(
      workoutDetail({
        exercises: [
          exercise({ photoUrl: 'https://example.com/leg-press.jpg' }),
          exercise({ id: 'we2', exerciseId: 'ex2', exerciseName: 'Hack Squat' }),
        ],
      }),
    );

    const result = await fetchShareCardData('w1', 'user-1');

    expect(result.topSets.map((s) => s.photoUrl)).toEqual([
      'https://example.com/leg-press.jpg',
      null,
    ]);
  });

  it('skips an exercise with no sets rather than crashing', async () => {
    mockFetchWorkoutDetail.mockResolvedValue(
      workoutDetail({ exercises: [exercise({ sets: [] })] }),
    );

    const result = await fetchShareCardData('w1', 'user-1');

    expect(result.topSets).toEqual([]);
  });

  it('labels a rep-count PR only when the top set is the current source', async () => {
    mockFetchRepPRs.mockResolvedValue([
      { reps: 8, bestWeightKg: 100, sourceSetId: 's1', achievedAt: '2026-01-01T00:00:00Z' },
    ]);

    const result = await fetchShareCardData('w1', 'user-1');

    expect(result.topSets[0].prLabel).toBe('8 Rep PR');
  });

  it('does not label a PR when a different set holds the current record', async () => {
    mockFetchRepPRs.mockResolvedValue([
      {
        reps: 8,
        bestWeightKg: 120,
        sourceSetId: 'some-other-set',
        achievedAt: '2026-01-01T00:00:00Z',
      },
    ]);

    const result = await fetchShareCardData('w1', 'user-1');

    expect(result.topSets[0].prLabel).toBeNull();
  });

  it('labels a true 1RM only for a 1-rep top set that is the current source', async () => {
    mockFetchWorkoutDetail.mockResolvedValue(
      workoutDetail({
        exercises: [exercise({ sets: [{ id: 's9', setIndex: 1, weightKg: 140, reps: 1 }] })],
      }),
    );
    mockFetchOneRepMax.mockResolvedValue({
      weightKg: 140,
      sourceSetId: 's9',
      achievedAt: '2026-01-01T00:00:00Z',
    });

    const result = await fetchShareCardData('w1', 'user-1');

    expect(result.topSets[0].prLabel).toBe('1RM');
  });

  it('returns an empty topSets array for a workout with no qualifying sets', async () => {
    mockFetchWorkoutDetail.mockResolvedValue(workoutDetail({ exercises: [] }));

    const result = await fetchShareCardData('w1', 'user-1');

    expect(result.topSets).toEqual([]);
    expect(result.musclesTrained).toBe('');
  });

  it('handles unusually large weights and reps without altering the definition', async () => {
    mockFetchWorkoutDetail.mockResolvedValue(
      workoutDetail({
        exercises: [exercise({ sets: [{ id: 's1', setIndex: 1, weightKg: 500.5, reps: 50 }] })],
      }),
    );

    const result = await fetchShareCardData('w1', 'user-1');

    expect(result.topSets[0]).toEqual({
      exerciseName: 'Bench Press',
      displayName: 'Bench Press',
      label: 'Top Set',
      photoUrl: null,
      measurementType: 'weight_reps',
      weightKg: 500.5,
      reps: 50,
      durationSeconds: null,
      prLabel: null,
    });
  });
});

describe('fetchShareCardData totals', () => {
  it('counts only logged sets and sums weight x reps over them, across every exercise', async () => {
    mockFetchWorkoutDetail.mockResolvedValue(
      workoutDetail({
        exercises: [
          exercise({
            sets: [
              {
                id: 's1',
                setIndex: 1,
                weightKg: 100,
                reps: 5,
                completedAt: '2026-01-01T10:05:00Z',
              },
              {
                id: 's2',
                setIndex: 2,
                weightKg: 100,
                reps: 5,
                completedAt: '2026-01-01T10:10:00Z',
              },
              { id: 's3', setIndex: 3, weightKg: null, reps: null, completedAt: null },
            ],
          }),
          exercise({
            id: 'we2',
            exerciseId: 'ex2',
            exerciseName: 'Row',
            sets: [
              {
                id: 's4',
                setIndex: 1,
                weightKg: 60,
                reps: 10,
                completedAt: '2026-01-01T10:20:00Z',
              },
            ],
          }),
        ],
      }),
    );

    const result = await fetchShareCardData('w1', 'user-1');

    expect(result.totalSets).toBe(3);
    expect(result.totalVolumeKg).toBe(100 * 5 + 100 * 5 + 60 * 10);
  });

  it('counts only exercises with at least one logged set', async () => {
    mockFetchWorkoutDetail.mockResolvedValue(
      workoutDetail({
        exercises: [
          exercise({
            sets: [
              {
                id: 's1',
                setIndex: 1,
                weightKg: 100,
                reps: 5,
                completedAt: '2026-01-01T10:05:00Z',
              },
            ],
          }),
          // Planned, never logged.
          exercise({
            id: 'we2',
            exerciseId: 'ex2',
            exerciseName: 'Row',
            sets: [{ id: 's2', setIndex: 1, weightKg: null, reps: null, completedAt: null }],
          }),
          exercise({ id: 'we3', exerciseId: 'ex3', exerciseName: 'Curl', sets: [] }),
        ],
      }),
    );

    const result = await fetchShareCardData('w1', 'user-1');

    expect(result.exerciseCount).toBe(1);
  });

  it('reports zero sets and zero volume for a workout with nothing logged', async () => {
    mockFetchWorkoutDetail.mockResolvedValue(workoutDetail({ exercises: [] }));

    const result = await fetchShareCardData('w1', 'user-1');

    expect(result.totalSets).toBe(0);
    expect(result.totalVolumeKg).toBe(0);
    expect(result.exerciseCount).toBe(0);
  });
});
