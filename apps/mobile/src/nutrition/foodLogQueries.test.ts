import { supabase } from '../lib/supabase';
import {
  deleteFoodLog,
  fetchTodaysFoodLogs,
  getLocalDayRange,
  logFood,
  updateFoodLogQuantity,
  type FoodLogRow,
} from './foodLogQueries';

jest.mock('../lib/supabase', () => ({ supabase: { from: jest.fn() } }));

const mockFrom = supabase.from as jest.Mock;

interface Result {
  data: unknown;
  error: { message: string } | null;
}

function createQueryBuilder(result: Result) {
  const calls: Record<string, unknown[][]> = {};
  const methods = ['select', 'eq', 'gte', 'lt', 'order', 'insert', 'update', 'delete'] as const;
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
      },
    ]);
    expect(calls.eq).toEqual([['user_id', 'user-1']]);
    const { start, end } = getLocalDayRange(now);
    expect(calls.gte).toEqual([['logged_at', start.toISOString()]]);
    expect(calls.lt).toEqual([['logged_at', end.toISOString()]]);
  });

  it('throws on a query error', async () => {
    mockTable({ data: null, error: { message: 'boom' } });

    await expect(fetchTodaysFoodLogs('user-1')).rejects.toThrow('boom');
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

    await logFood('user-1', food, 1);

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

    await logFood('user-1', food, 2);

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
