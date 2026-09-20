import { supabase } from '../lib/supabase';
import { createFood, fetchAllFoods, fetchFoods, updateFood } from './foodQueries';

jest.mock('../lib/supabase', () => ({ supabase: { from: jest.fn() } }));

const mockFrom = supabase.from as jest.Mock;

interface Result {
  data: unknown;
  error: { message: string } | null;
}

// Same chainable-and-thenable mock builder pattern used throughout this
// codebase (see workoutQueries.test.ts).
function createQueryBuilder(result: Result) {
  const calls: Record<string, unknown[][]> = {};
  const methods = [
    'select',
    'eq',
    'is',
    'ilike',
    'order',
    'range',
    'limit',
    'insert',
    'update',
  ] as const;
  const builder: Record<string, unknown> = {};
  for (const m of methods) {
    calls[m] = [];
    builder[m] = jest.fn((...args: unknown[]) => {
      calls[m].push(args);
      return builder;
    });
  }
  builder.single = jest.fn().mockResolvedValue(result);
  builder.then = (resolve: (v: Result) => unknown, reject: (e: unknown) => unknown) =>
    Promise.resolve(result).then(resolve, reject);
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

const dbRow = {
  id: 'food-1',
  name: 'Chicken Breast',
  brand: null,
  barcode: null,
  serving_size: '100.00',
  serving_unit: 'g',
  calories: '165.00',
  protein_g: '31.00',
  carbs_g: '0.00',
  fat_g: '3.60',
  is_active: true,
};

describe('fetchFoods', () => {
  it('scopes to the current user, active foods only, ordered by name', async () => {
    const { calls } = mockTable({ data: [dbRow], error: null });

    const result = await fetchFoods({ userId: 'user-1', search: '', page: 0, pageSize: 20 });

    expect(result.rows).toEqual([
      {
        id: 'food-1',
        name: 'Chicken Breast',
        brand: null,
        barcode: null,
        servingSize: 100,
        servingUnit: 'g',
        calories: 165,
        proteinG: 31,
        carbsG: 0,
        fatG: 3.6,
        isActive: true,
      },
    ]);
    expect(result.hasMore).toBe(false);
    expect(calls.eq).toEqual([
      ['created_by', 'user-1'],
      ['is_active', true],
    ]);
    expect(calls.ilike).toEqual([]);
  });

  it('applies a case-insensitive search filter when provided', async () => {
    const { calls } = mockTable({ data: [], error: null });

    await fetchFoods({ userId: 'user-1', search: '  chicken  ', page: 0, pageSize: 20 });

    expect(calls.ilike).toEqual([['name', '%chicken%']]);
  });

  it('reports hasMore when a full page is returned', async () => {
    const rows = Array.from({ length: 20 }, (_, i) => ({ ...dbRow, id: `food-${i}` }));
    mockTable({ data: rows, error: null });

    const result = await fetchFoods({ userId: 'user-1', search: '', page: 0, pageSize: 20 });

    expect(result.hasMore).toBe(true);
  });

  it('throws on a query error', async () => {
    mockTable({ data: null, error: { message: 'boom' } });

    await expect(
      fetchFoods({ userId: 'user-1', search: '', page: 0, pageSize: 20 }),
    ).rejects.toThrow('boom');
  });
});

describe('fetchAllFoods', () => {
  it('scopes to the current user, active foods only, ordered by name ascending by default', async () => {
    const { calls } = mockTable({ data: [dbRow], error: null });

    const result = await fetchAllFoods({ userId: 'user-1', search: '', ascending: true });

    expect(result).toEqual([
      {
        id: 'food-1',
        name: 'Chicken Breast',
        brand: null,
        barcode: null,
        servingSize: 100,
        servingUnit: 'g',
        calories: 165,
        proteinG: 31,
        carbsG: 0,
        fatG: 3.6,
        isActive: true,
      },
    ]);
    expect(calls.eq).toEqual([
      ['created_by', 'user-1'],
      ['is_active', true],
    ]);
    expect(calls.order).toEqual([['name', { ascending: true }]]);
    // No .range() call -- the whole set loads at once, unlike fetchFoods.
    expect(calls.range).toEqual([]);
  });

  it('orders descending when ascending is false', async () => {
    const { calls } = mockTable({ data: [], error: null });

    await fetchAllFoods({ userId: 'user-1', search: '', ascending: false });

    expect(calls.order).toEqual([['name', { ascending: false }]]);
  });

  it('applies a case-insensitive search filter when provided', async () => {
    const { calls } = mockTable({ data: [], error: null });

    await fetchAllFoods({ userId: 'user-1', search: '  apple  ', ascending: true });

    expect(calls.ilike).toEqual([['name', '%apple%']]);
  });

  it('returns every matching row, not just one page', async () => {
    const rows = Array.from({ length: 45 }, (_, i) => ({ ...dbRow, id: `food-${i}` }));
    mockTable({ data: rows, error: null });

    const result = await fetchAllFoods({ userId: 'user-1', search: '', ascending: true });

    expect(result).toHaveLength(45);
  });

  it('throws on a query error', async () => {
    mockTable({ data: null, error: { message: 'boom' } });

    await expect(fetchAllFoods({ userId: 'user-1', search: '', ascending: true })).rejects.toThrow(
      'boom',
    );
  });
});

describe('createFood', () => {
  it('inserts with created_by set to the current user, and null brand/barcode when omitted', async () => {
    const { builder } = mockTable({ data: dbRow, error: null });

    const result = await createFood('user-1', {
      name: 'Chicken Breast',
      servingSize: 100,
      servingUnit: 'g',
      calories: 165,
      proteinG: 31,
      carbsG: 0,
      fatG: 3.6,
    });

    expect(builder.insert).toHaveBeenCalledWith({
      created_by: 'user-1',
      name: 'Chicken Breast',
      brand: null,
      barcode: null,
      serving_size: 100,
      serving_unit: 'g',
      calories: 165,
      protein_g: 31,
      carbs_g: 0,
      fat_g: 3.6,
    });
    expect(result.id).toBe('food-1');
  });

  it('inserts the given optional brand and barcode', async () => {
    const { builder } = mockTable({
      data: { ...dbRow, brand: 'Kirkland', barcode: '012345678905' },
      error: null,
    });

    const result = await createFood('user-1', {
      name: 'Almonds',
      brand: 'Kirkland',
      barcode: '012345678905',
      servingSize: 28,
      servingUnit: 'g',
      calories: 160,
      proteinG: 6,
      carbsG: 6,
      fatG: 14,
    });

    expect(builder.insert).toHaveBeenCalledWith(
      expect.objectContaining({ brand: 'Kirkland', barcode: '012345678905' }),
    );
    expect(result.brand).toBe('Kirkland');
    expect(result.barcode).toBe('012345678905');
  });

  it('throws on a query error', async () => {
    mockTable({ data: null, error: { message: 'boom' } });

    await expect(
      createFood('user-1', {
        name: 'X',
        servingSize: 1,
        servingUnit: 'serving',
        calories: 0,
        proteinG: 0,
        carbsG: 0,
        fatG: 0,
      }),
    ).rejects.toThrow('boom');
  });
});

describe('updateFood', () => {
  it('only sends the provided fields', async () => {
    const { builder } = mockTable({ data: dbRow, error: null });

    await updateFood('food-1', { calories: 200 });

    expect(builder.update).toHaveBeenCalledWith({ calories: 200 });
    expect(builder.eq).toHaveBeenCalledWith('id', 'food-1');
  });

  it('can deactivate a food via isActive', async () => {
    const { builder } = mockTable({ data: { ...dbRow, is_active: false }, error: null });

    const result = await updateFood('food-1', { isActive: false });

    expect(builder.update).toHaveBeenCalledWith({ is_active: false });
    expect(result.isActive).toBe(false);
  });

  it('can update brand and barcode', async () => {
    const { builder } = mockTable({
      data: { ...dbRow, brand: 'Kirkland', barcode: '012345678905' },
      error: null,
    });

    const result = await updateFood('food-1', { brand: 'Kirkland', barcode: '012345678905' });

    expect(builder.update).toHaveBeenCalledWith({ brand: 'Kirkland', barcode: '012345678905' });
    expect(result.brand).toBe('Kirkland');
    expect(result.barcode).toBe('012345678905');
  });
});
