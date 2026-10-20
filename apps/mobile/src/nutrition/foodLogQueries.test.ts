import { supabase } from '../lib/supabase';
import {
  deleteFoodLog,
  fetchFoodLogsForMonth,
  fetchTodaysFoodLogs,
  getLocalDayRange,
  logFood,
  updateFoodLogQuantity,
  type FoodLogRow,
  copyFoodLogs,
  fetchFoodLogsForDay,
} from './foodLogQueries';

jest.mock('../lib/supabase', () => ({ supabase: { from: jest.fn() } }));

const mockFrom = supabase.from as jest.Mock;

interface Result {
  data: unknown;
  error: { message: string } | null;
}

function createQueryBuilder(result: Result) {
  const calls: Record<string, unknown[][]> = {};
  const methods = [
    'select',
    'eq',
    'in',
    'gte',
    'lt',
    'order',
    'insert',
    'update',
    'delete',
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
  id: 'log-1',
  food_id: 'food-1',
  food_name_snapshot: 'Chicken Breast',
  serving_size: '100.00',
  serving_unit: 'g',
  quantity: '1.00',
  calories: '165.00',
  protein_g: '31.00',
  carbs_g: '0.00',
  fat_g: '3.60',
  logged_at: '2026-01-01T12:00:00Z',
};

const domainRow: FoodLogRow = {
  id: 'log-1',
  foodId: 'food-1',
  foodNameSnapshot: 'Chicken Breast',
  servingSize: 100,
  servingUnit: 'g',
  quantity: 2,
  calories: 400,
  proteinG: 40,
  carbsG: 20,
  fatG: 10,
  loggedAt: '2026-01-01T12:00:00Z',
  mealType: null,
};

describe('getLocalDayRange', () => {
  it('returns a 24-hour window starting at local midnight', () => {
    const now = new Date(2026, 1, 15, 14, 30, 0); // Feb 15 2026, 2:30pm local
    const { start, end } = getLocalDayRange(now);

    expect(start.getFullYear()).toBe(2026);
    expect(start.getMonth()).toBe(1);
    expect(start.getDate()).toBe(15);
    expect(start.getHours()).toBe(0);
    expect(start.getMinutes()).toBe(0);
    expect(start.getSeconds()).toBe(0);
    expect(start.getMilliseconds()).toBe(0);

    expect(end.getDate()).toBe(16);
    expect(end.getHours()).toBe(0);

    expect(end.getTime() - start.getTime()).toBe(24 * 60 * 60 * 1000);
  });

  it('a moment just before local midnight still falls inside the same day', () => {
    const justBeforeMidnight = new Date(2026, 1, 15, 23, 59, 59, 999);
    const { start, end } = getLocalDayRange(justBeforeMidnight);

    expect(justBeforeMidnight.getTime()).toBeGreaterThanOrEqual(start.getTime());
    expect(justBeforeMidnight.getTime()).toBeLessThan(end.getTime());
  });

  it('a moment just after local midnight falls in the next day, not the previous one', () => {
    const justAfterMidnight = new Date(2026, 1, 16, 0, 0, 0, 1);
    const { start: prevStart, end: prevEnd } = getLocalDayRange(new Date(2026, 1, 15, 12, 0, 0));

    expect(justAfterMidnight.getTime()).toBeGreaterThanOrEqual(prevEnd.getTime());
    expect(justAfterMidnight.getTime()).not.toBeLessThan(prevStart.getTime());
  });
});

describe('fetchTodaysFoodLogs', () => {
  it('queries by user and the local-day logged_at range, chronological', async () => {
    const { calls } = mockTable({ data: [dbRow], error: null });
    const now = new Date(2026, 1, 15, 12, 0, 0);

    const result = await fetchTodaysFoodLogs('user-1', now);

    expect(result).toEqual([
      {
        id: 'log-1',
        foodId: 'food-1',
        foodNameSnapshot: 'Chicken Breast',
        servingSize: 100,
        servingUnit: 'g',
        quantity: 1,
        calories: 165,
        proteinG: 31,
        carbsG: 0,
        fatG: 3.6,
        loggedAt: '2026-01-01T12:00:00Z',
        enteredAmount: null,
        enteredUnit: null,
        servingLabel: null,
      },
    ]);
    expect(calls.eq).toEqual([['user_id', 'user-1']]);
    const { start, end } = getLocalDayRange(now);
    expect(calls.gte).toEqual([['logged_at', start.toISOString()]]);
    expect(calls.lt).toEqual([['logged_at', end.toISOString()]]);
  });

  it("also reads each food's photo through the food link, for both an object and an array embed", async () => {
    const { calls } = mockTable({
      data: [
        { ...dbRow, foods: { image_url: 'https://images.example/a.jpg' } },
        { ...dbRow, id: 'log-2', foods: [{ image_url: 'https://images.example/b.jpg' }] },
        { ...dbRow, id: 'log-3', foods: null },
      ],
      error: null,
    });

    const result = await fetchTodaysFoodLogs('user-1', new Date(2026, 1, 15, 12, 0, 0));

    expect(calls.select?.[0]?.[0]).toContain('foods(image_url)');
    expect(result.map((log) => log.imageUrl)).toEqual([
      'https://images.example/a.jpg',
      'https://images.example/b.jpg',
      null,
    ]);
  });

  it('throws on a query error', async () => {
    mockTable({ data: null, error: { message: 'boom' } });

    await expect(fetchTodaysFoodLogs('user-1')).rejects.toThrow('boom');
  });
});

describe('fetchFoodLogsForMonth', () => {
  it('queries by user and local-month logged_at boundaries, chronological', async () => {
    const { calls } = mockTable({ data: [dbRow], error: null });

    const result = await fetchFoodLogsForMonth('user-1', 2026, 2);

    expect(result).toEqual([
      {
        id: 'log-1',
        foodId: 'food-1',
        foodNameSnapshot: 'Chicken Breast',
        servingSize: 100,
        servingUnit: 'g',
        quantity: 1,
        calories: 165,
        proteinG: 31,
        carbsG: 0,
        fatG: 3.6,
        loggedAt: '2026-01-01T12:00:00Z',
        enteredAmount: null,
        enteredUnit: null,
        servingLabel: null,
      },
    ]);
    expect(calls.eq).toEqual([['user_id', 'user-1']]);
    expect(calls.gte).toEqual([['logged_at', new Date(2026, 1, 1).toISOString()]]);
    expect(calls.lt).toEqual([['logged_at', new Date(2026, 2, 1).toISOString()]]);
    expect(calls.order).toEqual([['logged_at', { ascending: true }]]);
  });

  it("also reads each food's photo through the food link", async () => {
    const { calls } = mockTable({
      data: [{ ...dbRow, foods: { image_url: 'https://images.example/a.jpg' } }],
      error: null,
    });

    const result = await fetchFoodLogsForMonth('user-1', 2026, 2);

    expect(calls.select?.[0]?.[0]).toContain('foods(image_url)');
    expect(result[0]?.imageUrl).toBe('https://images.example/a.jpg');
  });

  it('throws on a query error', async () => {
    mockTable({ data: null, error: { message: 'boom' } });

    await expect(fetchFoodLogsForMonth('user-1', 2026, 2)).rejects.toThrow('boom');
  });
});

describe('logFood', () => {
  it('computes the snapshot totals from the food and quantity, and inserts them', async () => {
    const { builder } = mockTable({ data: dbRow, error: null });
    const food = {
      id: 'food-1',
      name: 'Chicken Breast',
      servingSize: 100,
      servingUnit: 'g',
      calories: 165,
      proteinG: 31,
      carbsG: 0,
      fatG: 3.6,
    };

    await logFood('user-1', food, 1, 'lunch');

    expect(builder.insert).toHaveBeenCalledWith({
      user_id: 'user-1',
      food_id: 'food-1',
      food_name_snapshot: 'Chicken Breast',
      serving_size: 100,
      serving_unit: 'g',
      quantity: 1,
      calories: 165,
      protein_g: 31,
      carbs_g: 0,
      fat_g: 3.6,
      meal_type: 'lunch',
      // Logged without an amount as typed, from a food with no serving wording.
      entered_amount: null,
      entered_unit: null,
      serving_label: null,
      // No provenance on this food, so the log records none either.
      nutrition_confidence: null,
      nutrition_source_kind: null,
      nutrition_source_id: null,
      nutrition_matched_name: null,
      nutrition_data_version: null,
      nutrition_retrieved_at: null,
      nutrition_licence: null,
      nutrition_attribution: null,
      nutrition_assumptions: [],
      nutrition_components: null,
    });
  });

  it('scales totals for a quantity other than 1', async () => {
    const { builder } = mockTable({ data: dbRow, error: null });
    const food = {
      id: 'food-1',
      name: 'Chicken Breast',
      servingSize: 100,
      servingUnit: 'g',
      calories: 165,
      proteinG: 31,
      carbsG: 0,
      fatG: 3.6,
    };

    await logFood('user-1', food, 2, 'dinner');

    expect(builder.insert).toHaveBeenCalledWith(
      expect.objectContaining({ quantity: 2, calories: 330, protein_g: 62 }),
    );
  });
});

describe('updateFoodLogQuantity', () => {
  it('recomputes from the existing log snapshot, never from a live foods row', async () => {
    const { builder } = mockTable({ data: dbRow, error: null });

    await updateFoodLogQuantity(domainRow, 3);

    // domainRow is logged at quantity 2 with calories 400 -- scaling to 3
    // must give 600, using only domainRow's own fields.
    expect(builder.update).toHaveBeenCalledWith({
      quantity: 3,
      calories: 600,
      protein_g: 60,
      carbs_g: 30,
      fat_g: 15,
    });
    expect(builder.eq).toHaveBeenCalledWith('id', 'log-1');
  });

  it('throws on a query error', async () => {
    mockTable({ data: null, error: { message: 'boom' } });

    await expect(updateFoodLogQuantity(domainRow, 3)).rejects.toThrow('boom');
  });
});

describe('deleteFoodLog', () => {
  it('deletes by id', async () => {
    const { builder } = mockTable({ data: null, error: null });

    await deleteFoodLog('log-1');

    expect(builder.delete).toHaveBeenCalled();
    expect(builder.eq).toHaveBeenCalledWith('id', 'log-1');
  });

  it('throws on a query error', async () => {
    mockTable({ data: null, error: { message: 'boom' } });

    await expect(deleteFoodLog('log-1')).rejects.toThrow('boom');
  });
});

describe('the amount as typed', () => {
  it('logs the amount and unit typed, and the serving wording, beside the servings', async () => {
    const { builder } = mockTable({ data: dbRow, error: null });

    await logFood(
      'user-1',
      {
        id: 'food-oreo',
        name: 'Oreo',
        servingSize: 34,
        servingUnit: 'g',
        servingLabel: '3 cookies (34 g)',
        calories: 160,
        proteinG: 1.6,
        carbsG: 25,
        fatG: 7,
      },
      0.67,
      'snack',
      { amount: 2, unit: 'pieces' },
    );

    expect(builder.insert).toHaveBeenCalledWith(
      expect.objectContaining({
        quantity: 0.67,
        entered_amount: 2,
        entered_unit: 'pieces',
        serving_label: '3 cookies (34 g)',
      }),
    );
  });

  it('reads the amount as typed back', async () => {
    mockTable({
      data: [{ ...dbRow, entered_amount: '150.00', entered_unit: 'g', serving_label: null }],
      error: null,
    });

    const [log] = await fetchTodaysFoodLogs('user-1');

    expect(log).toMatchObject({ enteredAmount: 150, enteredUnit: 'g', servingLabel: null });
  });

  it('saves a new amount as typed with the new servings', async () => {
    const { builder } = mockTable({ data: dbRow, error: null });

    await updateFoodLogQuantity(domainRow, 3, { amount: 300, unit: 'g' });

    expect(builder.update).toHaveBeenCalledWith(
      expect.objectContaining({ quantity: 3, entered_amount: 300, entered_unit: 'g' }),
    );
  });
});

describe('fetchFoodLogsForDay', () => {
  it('reads one local calendar day', async () => {
    const { calls } = mockTable({ data: [dbRow], error: null });
    const day = new Date(2026, 9, 19, 15, 0);

    await fetchFoodLogsForDay('user-1', day);

    const { start, end } = getLocalDayRange(day);
    expect(calls.gte).toEqual([['logged_at', start.toISOString()]]);
    expect(calls.lt).toEqual([['logged_at', end.toISOString()]]);
  });
});

describe('copyFoodLogs', () => {
  it('logs exactly what was logged before, now, in the order given', async () => {
    const source = (id: string, name: string) => ({
      id,
      food_id: `food-${id}`,
      food_name_snapshot: name,
      serving_size: '1.00',
      serving_unit: 'serving',
      quantity: '2.00',
      calories: '300.00',
      protein_g: '20.00',
      carbs_g: '30.00',
      fat_g: '10.00',
      meal_type: 'breakfast',
      entered_amount: '2.00',
      entered_unit: 'servings',
      serving_label: null,
      nutrition_confidence: 'verified',
    });
    const read = createQueryBuilder({
      data: [source('b', 'Toast'), source('a', 'Eggs')],
      error: null,
    });
    const write = createQueryBuilder({
      data: [
        { ...dbRow, id: 'new-1', logged_at: '2026-10-20T08:00:00.000Z' },
        { ...dbRow, id: 'new-2', logged_at: '2026-10-20T08:00:00.001Z' },
      ],
      error: null,
    });
    mockFrom.mockImplementationOnce(() => read.builder).mockImplementationOnce(() => write.builder);

    const copies = await copyFoodLogs('user-1', ['a', 'b']);

    expect(read.calls.eq).toEqual([['user_id', 'user-1']]);
    expect(read.calls.in).toEqual([['id', ['a', 'b']]]);
    const inserted = write.calls.insert[0]![0] as Record<string, unknown>[];
    expect(inserted.map((row) => row.food_name_snapshot)).toEqual(['Eggs', 'Toast']);
    expect(inserted[0]).toMatchObject({
      user_id: 'user-1',
      quantity: '2.00',
      calories: '300.00',
      entered_unit: 'servings',
      nutrition_confidence: 'verified',
    });
    expect(inserted[0]).not.toHaveProperty('id');
    // Now, a millisecond apart, so they keep their order.
    expect(Date.parse(inserted[1]!.logged_at as string)).toBe(
      Date.parse(inserted[0]!.logged_at as string) + 1,
    );
    expect(copies.map((log) => log.id)).toEqual(['new-1', 'new-2']);
  });

  it('does nothing for no logs', async () => {
    await expect(copyFoodLogs('user-1', [])).resolves.toEqual([]);
    expect(mockFrom).not.toHaveBeenCalled();
  });
});
