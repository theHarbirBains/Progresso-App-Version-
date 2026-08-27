import { supabase } from '../lib/supabase';
import { fetchNutritionGoals, saveNutritionGoals } from './nutritionGoalQueries';

jest.mock('../lib/supabase', () => ({ supabase: { from: jest.fn() } }));

const mockFrom = supabase.from as jest.Mock;

interface Result {
  data: unknown;
  error: { message: string } | null;
}

function createQueryBuilder(result: Result) {
  const calls: Record<string, unknown[][]> = {};
  const methods = ['select', 'eq', 'upsert'] as const;
  const builder: Record<string, unknown> = {};
  for (const m of methods) {
    calls[m] = [];
    builder[m] = jest.fn((...args: unknown[]) => {
      calls[m].push(args);
      return builder;
    });
  }
  builder.maybeSingle = jest.fn().mockResolvedValue(result);
  builder.single = jest.fn().mockResolvedValue(result);
  return { builder, calls };
}

function mockTable(result: Result) {
  const { builder, calls } = createQueryBuilder(result);
  mockFrom.mockImplementation(() => builder);
  return { builder, calls };
}

beforeEach(() => {
  mockFrom.mockReset();
});

describe('fetchNutritionGoals', () => {
  it('maps a row with all targets set', async () => {
    mockTable({
      data: { calories: 2000, protein_g: '180.00', carbs_g: '200.00', fat_g: '60.00' },
      error: null,
    });

    const result = await fetchNutritionGoals('user-1');

    expect(result).toEqual({ calories: 2000, proteinG: 180, carbsG: 200, fatG: 60 });
  });

  it('returns all-null when the user has no goals row yet', async () => {
    mockTable({ data: null, error: null });

    await expect(fetchNutritionGoals('user-1')).resolves.toEqual({
      calories: null,
      proteinG: null,
      carbsG: null,
      fatG: null,
    });
  });

  it('preserves independently-null fields on a partially-set row', async () => {
    mockTable({
      data: { calories: 2000, protein_g: null, carbs_g: null, fat_g: null },
      error: null,
    });

    await expect(fetchNutritionGoals('user-1')).resolves.toEqual({
      calories: 2000,
      proteinG: null,
      carbsG: null,
      fatG: null,
    });
  });

  it('throws on a query error', async () => {
    mockTable({ data: null, error: { message: 'boom' } });

    await expect(fetchNutritionGoals('user-1')).rejects.toThrow('boom');
  });
});

describe('saveNutritionGoals', () => {
  it('upserts on user_id with all four fields, including nulls to clear them', async () => {
    const { builder } = mockTable({
      data: { calories: 2000, protein_g: null, carbs_g: null, fat_g: null },
      error: null,
    });

    await saveNutritionGoals('user-1', {
      calories: 2000,
      proteinG: null,
      carbsG: null,
      fatG: null,
    });

    expect(builder.upsert).toHaveBeenCalledWith(
      {
        user_id: 'user-1',
        calories: 2000,
        protein_g: null,
        carbs_g: null,
        fat_g: null,
      },
      { onConflict: 'user_id' },
    );
  });

  it('throws on a query error', async () => {
    mockTable({ data: null, error: { message: 'boom' } });

    await expect(
      saveNutritionGoals('user-1', { calories: null, proteinG: null, carbsG: null, fatG: null }),
    ).rejects.toThrow('boom');
  });
});
