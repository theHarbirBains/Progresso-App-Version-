import { supabase } from '../lib/supabase';
import { addPlannedExercises } from '../workouts/splitPlanQueries';
import {
  createWorkoutSplit,
  createWorkoutSplitDay,
  deleteWorkoutSplit,
  setWorkoutSplitDayMuscleGroups,
} from '../workouts/workoutSplitQueries';
import { TEST_PROGRAM } from './__fixtures__/programs';
import { activateProgram } from './programActivation';
import { variationById } from './programs';

jest.mock('../lib/supabase', () => ({ supabase: { from: jest.fn() } }));
jest.mock('../workouts/workoutSplitQueries', () => ({
  createWorkoutSplit: jest.fn(),
  createWorkoutSplitDay: jest.fn(),
  deleteWorkoutSplit: jest.fn(),
  setWorkoutSplitDayMuscleGroups: jest.fn(),
}));
jest.mock('../workouts/splitPlanQueries', () => ({ addPlannedExercises: jest.fn() }));

const SLUG_IDS: Record<string, string> = {
  'bb-bench-press': 'ex-bench',
  'db-lateral-raise': 'ex-raise',
  'db-bent-over-row': 'ex-row',
  'db-curl': 'ex-curl',
  'db-goblet-squat': 'ex-squat',
};

/** The built-ins' query: those of the slugs asked for that the database has. */
function builtinsAre(ids: Record<string, string>) {
  const is = jest.fn((_column: string, _value: null) =>
    Promise.resolve({
      data: Object.entries(ids).map(([slug, id]) => ({ id, slug })),
      error: null,
    }),
  );
  const query: { select: jest.Mock; in: jest.Mock; is: typeof is } = {
    select: jest.fn(() => query),
    in: jest.fn(() => query),
    is,
  };
  jest.mocked(supabase.from).mockReturnValue(query as never);
  return query;
}

beforeEach(() => {
  jest.mocked(createWorkoutSplit).mockReset().mockResolvedValue({ id: 'split-1', name: 'x' });
  let day = 0;
  jest
    .mocked(createWorkoutSplitDay)
    .mockReset()
    .mockImplementation(async (_split, name) => ({
      id: `day-${++day}`,
      name,
      orderIndex: day,
      muscleGroups: [],
    }));
  jest
    .mocked(setWorkoutSplitDayMuscleGroups)
    .mockReset()
    .mockResolvedValue(undefined as never);
  jest.mocked(addPlannedExercises).mockReset().mockResolvedValue(undefined);
  jest.mocked(deleteWorkoutSplit).mockReset().mockResolvedValue(undefined);
});

describe('activateProgram', () => {
  it("makes the variation a split of the person's own: each day, its muscles and its plan", async () => {
    const query = builtinsAre(SLUG_IDS);
    const variation = variationById(TEST_PROGRAM, 'three-balanced');

    await expect(activateProgram('user-1', TEST_PROGRAM, variation)).resolves.toEqual({
      id: 'split-1',
      name: 'x',
    });

    // Built-ins only, by slug.
    expect(query.is).toHaveBeenCalledWith('created_by', null);
    expect(createWorkoutSplit).toHaveBeenCalledWith('user-1', 'Test Split (3-Day, Balanced)');
    expect(jest.mocked(createWorkoutSplitDay).mock.calls).toEqual([
      ['split-1', 'Push', 1],
      ['split-1', 'Pull', 2],
      ['split-1', 'Legs', 3],
    ]);
    expect(setWorkoutSplitDayMuscleGroups).toHaveBeenCalledWith('day-1', [
      'chest',
      'shoulders',
      'triceps',
    ]);
    expect(addPlannedExercises).toHaveBeenCalledWith('day-1', [
      { exerciseId: 'ex-bench', targetSets: 3 },
      { exerciseId: 'ex-raise', targetSets: 3 },
    ]);
    expect(addPlannedExercises).toHaveBeenCalledWith('day-2', [
      { exerciseId: 'ex-row', targetSets: 4 },
      { exerciseId: 'ex-curl', targetSets: 2 },
    ]);
    expect(deleteWorkoutSplit).not.toHaveBeenCalled();
  });

  it('makes nothing when one of its exercises is not in the library', async () => {
    const { 'db-curl': _curl, ...rest } = SLUG_IDS;
    builtinsAre(rest);

    await expect(
      activateProgram('user-1', TEST_PROGRAM, variationById(TEST_PROGRAM, 'three-balanced')),
    ).rejects.toThrow("isn't available yet");
    expect(createWorkoutSplit).not.toHaveBeenCalled();
  });

  it('takes away a split half made when something fails', async () => {
    builtinsAre(SLUG_IDS);
    jest.mocked(addPlannedExercises).mockRejectedValueOnce(new Error('offline'));

    await expect(
      activateProgram('user-1', TEST_PROGRAM, variationById(TEST_PROGRAM, 'three-balanced')),
    ).rejects.toThrow('offline');
    expect(deleteWorkoutSplit).toHaveBeenCalledWith('split-1');
  });
});
