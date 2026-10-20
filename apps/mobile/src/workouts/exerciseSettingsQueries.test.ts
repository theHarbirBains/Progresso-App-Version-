import { supabase } from '../lib/supabase';
import {
  clearExerciseSetting,
  fetchExerciseSettings,
  saveExerciseSetting,
} from './exerciseSettingsQueries';

jest.mock('../lib/supabase', () => ({ supabase: { from: jest.fn() } }));

const mockFrom = supabase.from as jest.Mock;

interface Result {
  data: unknown;
  error: { message: string } | null;
}

// Same chainable-and-thenable mock builder pattern used throughout this
// codebase (see workoutQueries.test.ts).
function mockTable(result: Result) {
  const calls: Record<string, unknown[][]> = {};
  const builder: Record<string, unknown> = {};
  for (const m of ['select', 'eq', 'upsert', 'delete'] as const) {
    calls[m] = [];
    builder[m] = jest.fn((...args: unknown[]) => {
      calls[m].push(args);
      return builder;
    });
  }
  builder.single = jest.fn().mockResolvedValue(result);
  builder.then = (resolve: (v: Result) => unknown, reject: (e: unknown) => unknown) =>
    Promise.resolve(result).then(resolve, reject);
  mockFrom.mockImplementation(() => builder);
  return { calls };
}

beforeEach(() => {
  mockFrom.mockReset();
});

const row = {
  exercise_id: 'ex-1',
  rep_range_min: 3,
  rep_range_max: 5,
  weight_increment_kg: '2.50',
  exercises: { name: 'Deadlift' },
};

describe('fetchExerciseSettings', () => {
  it("reads the person's own exercise settings, by exercise", async () => {
    const { calls } = mockTable({
      data: [row, { ...row, exercise_id: 'ex-2', rep_range_min: null, rep_range_max: null }],
      error: null,
    });

    const settings = await fetchExerciseSettings('user-1');

    expect(mockFrom).toHaveBeenCalledWith('exercise_progression_settings');
    expect(calls.eq).toEqual([['user_id', 'user-1']]);
    expect(settings.get('ex-1')).toEqual({
      exerciseId: 'ex-1',
      exerciseName: 'Deadlift',
      range: { min: 3, max: 5 },
      incrementKg: 2.5,
    });
    expect(settings.get('ex-2')?.range).toBeNull();
  });
});

describe('saveExerciseSetting', () => {
  it("saves an exercise's own range and step", async () => {
    const { calls } = mockTable({ data: row, error: null });

    const saved = await saveExerciseSetting('user-1', 'ex-1', {
      range: { min: 3, max: 5 },
      incrementKg: 2.5,
    });

    expect(calls.upsert).toEqual([
      [
        {
          user_id: 'user-1',
          exercise_id: 'ex-1',
          rep_range_min: 3,
          rep_range_max: 5,
          weight_increment_kg: 2.5,
        },
        { onConflict: 'user_id,exercise_id' },
      ],
    ]);
    expect(saved?.range).toEqual({ min: 3, max: 5 });
  });

  it("takes the exercise back to the person's range when neither is set", async () => {
    const { calls } = mockTable({ data: null, error: null });

    await expect(
      saveExerciseSetting('user-1', 'ex-1', { range: null, incrementKg: null }),
    ).resolves.toBeNull();

    expect(calls.upsert).toEqual([]);
    expect(calls.delete).toHaveLength(1);
    expect(calls.eq).toEqual([
      ['user_id', 'user-1'],
      ['exercise_id', 'ex-1'],
    ]);
  });
});

describe('clearExerciseSetting', () => {
  it('throws the database error', async () => {
    mockTable({ data: null, error: { message: 'boom' } });

    await expect(clearExerciseSetting('user-1', 'ex-1')).rejects.toThrow('boom');
  });
});
