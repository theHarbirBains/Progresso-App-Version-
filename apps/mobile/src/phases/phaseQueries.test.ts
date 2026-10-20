import { supabase } from '../lib/supabase';
import { createPhase, endPhase, fetchPhases } from './phaseQueries';

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
  for (const m of ['select', 'eq', 'order', 'insert', 'update', 'delete'] as const) {
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
  id: 'p1',
  kind: 'cut',
  name: null,
  start_date: '2026-10-01',
  end_date: null,
  start_weight_kg: '90.00',
  target_weight_kg: null,
  calories: 1900,
  protein_g: '180.00',
  carbs_g: null,
  fat_g: null,
  notes: null,
};

describe('phaseQueries', () => {
  it("reads the person's phases, newest first", async () => {
    const { calls } = mockTable({ data: [row], error: null });

    const [phase] = await fetchPhases('user-1');

    expect(mockFrom).toHaveBeenCalledWith('training_phases');
    expect(calls.eq).toEqual([['user_id', 'user-1']]);
    expect(calls.order).toEqual([['start_date', { ascending: false }]]);
    expect(phase).toMatchObject({
      kind: 'cut',
      startDate: '2026-10-01',
      endDate: null,
      startWeightKg: 90,
      targets: { calories: 1900, proteinG: 180, carbsG: null, fatG: null },
    });
  });

  it('starts a phase with its targets', async () => {
    const { calls } = mockTable({ data: row, error: null });

    await createPhase('user-1', {
      kind: 'cut',
      name: '  ',
      startDate: '2026-10-01',
      endDate: null,
      startWeightKg: 90,
      targetWeightKg: null,
      targets: { calories: 1900, proteinG: 180, carbsG: null, fatG: null },
      notes: null,
    });

    expect(calls.insert[0]![0]).toEqual({
      user_id: 'user-1',
      kind: 'cut',
      name: null,
      start_date: '2026-10-01',
      end_date: null,
      start_weight_kg: 90,
      target_weight_kg: null,
      calories: 1900,
      protein_g: 180,
      carbs_g: null,
      fat_g: null,
      notes: null,
    });
  });

  it('puts the database refusing an overlap into plain words', async () => {
    mockTable({ data: null, error: { message: 'phases cannot overlap' } });

    await expect(endPhase('p1', '2026-10-20')).rejects.toThrow("Phases can't share days");
  });
});
