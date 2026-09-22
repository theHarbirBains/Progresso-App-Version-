import { InternalServerErrorException } from '@nestjs/common';
import type { SupabaseService } from '../supabase/supabase.service';
import type { FoodProvider, NormalizedFood } from './food-provider.interface';
import { FoodsService } from './foods.service';

interface Result {
  data: unknown;
  error: { message: string } | null;
}

// Same chainable-and-thenable mock builder pattern used on the mobile side
// (see foodQueries.test.ts) -- every method returns the same builder, and
// the builder itself is thenable so `await` at any point in the chain
// resolves to the configured result.
function createQueryBuilder(result: Result) {
  const calls: Record<string, unknown[][]> = {};
  const methods = [
    'select',
    'is',
    'eq',
    'ilike',
    'or',
    'order',
    'limit',
    'upsert',
    'maybeSingle',
  ] as const;
  const builder: Record<string, unknown> = {};
  for (const m of methods) {
    calls[m] = [];
    builder[m] = jest.fn((...args: unknown[]) => {
      calls[m]!.push(args);
      if (m === 'maybeSingle') return Promise.resolve(result);
      return builder;
    });
  }
  builder.then = (resolve: (v: Result) => unknown, reject: (e: unknown) => unknown) =>
    Promise.resolve(result).then(resolve, reject);
  return { builder, calls };
}

/** Queues a fresh builder per call to `.from()`, in order -- FoodsService issues several separate queries per search() (name/brand local searches, one upsert per cached external food). */
function mockSupabaseSequence(results: Result[]) {
  const instances = results.map((r) => createQueryBuilder(r));
  const from = jest.fn();
  let i = 0;
  from.mockImplementation(() => {
    const next = instances[Math.min(i, instances.length - 1)];
    i += 1;
    return next!.builder;
  });
  const supabaseService = { getClient: () => ({ from }) } as unknown as SupabaseService;
  return { supabaseService, from, instances };
}

function mockProvider(overrides: Partial<FoodProvider> = {}): FoodProvider {
  return {
    name: 'open_food_facts',
    searchFoods: jest.fn().mockResolvedValue({ foods: [], hasMore: false }),
    getFood: jest.fn().mockResolvedValue(null),
    getFoodByBarcode: jest.fn().mockResolvedValue(null),
    ...overrides,
  };
}

const localFoodRow = {
  id: 'food-1',
  name: 'Chicken Breast (cooked)',
  brand: null,
  image_url: null,
  serving_size: '100.00',
  serving_unit: 'g',
  calories: '165.00',
  protein_g: '31.00',
  carbs_g: '0.00',
  fat_g: '3.60',
  provider: null,
  barcode: null,
};

const cachedExternalFoodRow = {
  id: 'food-2',
  name: 'Oreo Original',
  brand: 'Oreo',
  image_url: 'https://images.openfoodfacts.org/oreo-front.jpg',
  serving_size: '34.00',
  serving_unit: 'g',
  calories: '160.00',
  protein_g: '1.60',
  carbs_g: '25.00',
  fat_g: '7.00',
  provider: 'open_food_facts',
  barcode: '0066721016123',
};

const normalizedOreo: NormalizedFood = {
  provider: 'open_food_facts',
  providerFoodId: '0066721016123',
  barcode: '0066721016123',
  name: 'Oreo Original',
  brand: 'Oreo',
  imageUrl: 'https://images.openfoodfacts.org/oreo-front.jpg',
  servingSize: 34,
  servingUnit: 'g',
  calories: 160,
  proteinG: 1.6,
  carbsG: 25,
  fatG: 7,
};

describe('FoodsService', () => {
  it('returns an empty result for a blank query without touching the database or the provider', async () => {
    const { supabaseService } = mockSupabaseSequence([]);
    const provider = mockProvider();
    const service = new FoodsService(supabaseService, provider);

    const result = await service.search('   ', 0, 20);

    expect(result).toEqual({ foods: [], hasMore: false });
    expect(provider.searchFoods).not.toHaveBeenCalled();
  });

  it('returns local (cached/generic) results merged with freshly-cached external results, deduplicated', async () => {
    const { supabaseService, instances } = mockSupabaseSequence([
      { data: [localFoodRow], error: null }, // local search by name
      { data: [], error: null }, // local search by brand
      { data: cachedExternalFoodRow, error: null }, // upsert of the external result
    ]);
    const provider = mockProvider({
      searchFoods: jest.fn().mockResolvedValue({ foods: [normalizedOreo], hasMore: false }),
    });
    const service = new FoodsService(supabaseService, provider);

    const result = await service.search('food', 0, 20);

    expect(result.foods.map((f) => f.id)).toEqual(['food-1', 'food-2']);
    expect(result.foods[1]).toMatchObject({
      name: 'Oreo Original',
      brand: 'Oreo',
      imageUrl: 'https://images.openfoodfacts.org/oreo-front.jpg',
      provider: 'open_food_facts',
      barcode: '0066721016123',
    });
    // The upsert call is the 3rd builder in the sequence.
    const upsertArgs: unknown[] = instances[2]!.calls.upsert?.[0] ?? [];
    expect(upsertArgs[0]).toMatchObject({
      provider: 'open_food_facts',
      provider_food_id: '0066721016123',
      image_url: 'https://images.openfoodfacts.org/oreo-front.jpg',
    });
  });

  it('upserts on (provider, provider_food_id) so re-searching never creates a duplicate row', async () => {
    const { supabaseService, instances } = mockSupabaseSequence([
      { data: [], error: null },
      { data: [], error: null },
      { data: cachedExternalFoodRow, error: null },
    ]);
    const provider = mockProvider({
      searchFoods: jest.fn().mockResolvedValue({ foods: [normalizedOreo], hasMore: false }),
    });
    const service = new FoodsService(supabaseService, provider);

    await service.search('oreo', 0, 20);

    const upsertBuilder = instances[2]!.builder as { upsert: jest.Mock };
    expect(upsertBuilder.upsert).toHaveBeenCalledWith(
      expect.objectContaining({ provider_food_id: '0066721016123' }),
      { onConflict: 'provider,provider_food_id' },
    );
  });

  it('only calls the external provider on the first page', async () => {
    const { supabaseService } = mockSupabaseSequence([
      { data: [], error: null },
      { data: [], error: null },
    ]);
    const provider = mockProvider();
    const service = new FoodsService(supabaseService, provider);

    await service.search('food', 1, 20);

    expect(provider.searchFoods).not.toHaveBeenCalled();
  });

  it('degrades to local-only results when the external provider throws', async () => {
    const { supabaseService } = mockSupabaseSequence([
      { data: [localFoodRow], error: null },
      { data: [], error: null },
    ]);
    const provider = mockProvider({
      searchFoods: jest.fn().mockRejectedValue(new Error('provider down')),
    });
    const service = new FoodsService(supabaseService, provider);

    const result = await service.search('food', 0, 20);

    expect(result.foods.map((f) => f.id)).toEqual(['food-1']);
  });

  it('skips caching a food whose upsert fails, without failing the whole search', async () => {
    const { supabaseService } = mockSupabaseSequence([
      { data: [], error: null },
      { data: [], error: null },
      { data: null, error: { message: 'db error' } },
    ]);
    const provider = mockProvider({
      searchFoods: jest.fn().mockResolvedValue({ foods: [normalizedOreo], hasMore: false }),
    });
    const service = new FoodsService(supabaseService, provider);

    const result = await service.search('oreo', 0, 20);

    expect(result.foods).toEqual([]);
  });

  it('caps merged results to pageSize', async () => {
    const rows = Array.from({ length: 15 }, (_, i) => ({ ...localFoodRow, id: `food-${i}` }));
    const { supabaseService } = mockSupabaseSequence([
      { data: rows, error: null },
      { data: [], error: null },
    ]);
    const provider = mockProvider();
    const service = new FoodsService(supabaseService, provider);

    const result = await service.search('food', 0, 10);

    expect(result.foods).toHaveLength(10);
    expect(result.hasMore).toBe(true);
  });

  it('throws when the local search query itself errors', async () => {
    const { supabaseService } = mockSupabaseSequence([{ data: null, error: { message: 'boom' } }]);
    const provider = mockProvider();
    const service = new FoodsService(supabaseService, provider);

    await expect(service.search('food', 0, 20)).rejects.toBeInstanceOf(
      InternalServerErrorException,
    );
  });
});

const USER_ID = '11111111-1111-4111-8111-111111111111';

describe('FoodsService.getByBarcode', () => {
  it("scopes the local lookup to the shared catalog plus the caller's own custom foods, own first", async () => {
    const { supabaseService, instances } = mockSupabaseSequence([
      { data: cachedExternalFoodRow, error: null },
    ]);
    const service = new FoodsService(supabaseService, mockProvider());

    await service.getByBarcode('0066721016123', USER_ID);

    expect(instances[0]!.calls.or?.[0]).toEqual([`created_by.is.null,created_by.eq.${USER_ID}`]);
    expect(instances[0]!.calls.order?.[0]).toEqual([
      'created_by',
      { ascending: true, nullsFirst: false },
    ]);
  });

  it('falls back to the shared catalog only if the user id is not a plain UUID', async () => {
    const { supabaseService, instances } = mockSupabaseSequence([
      { data: cachedExternalFoodRow, error: null },
    ]);
    const service = new FoodsService(supabaseService, mockProvider());

    await service.getByBarcode('0066721016123', 'x,created_by.neq.null');

    expect(instances[0]!.calls.or?.[0]).toEqual(['created_by.is.null']);
  });

  it('returns a cached product without calling the provider, on a cache hit', async () => {
    const { supabaseService } = mockSupabaseSequence([
      { data: cachedExternalFoodRow, error: null }, // local barcode lookup
    ]);
    const provider = mockProvider();
    const service = new FoodsService(supabaseService, provider);

    const result = await service.getByBarcode('0066721016123', USER_ID);

    expect(result).toMatchObject({ id: 'food-2', name: 'Oreo Original', barcode: '0066721016123' });
    expect(provider.getFoodByBarcode).not.toHaveBeenCalled();
  });

  it('falls back to the provider on a cache miss, and caches the result', async () => {
    const { supabaseService, instances } = mockSupabaseSequence([
      { data: null, error: null }, // local barcode lookup -- miss
      { data: cachedExternalFoodRow, error: null }, // upsert of the provider result
    ]);
    const provider = mockProvider({
      getFoodByBarcode: jest.fn().mockResolvedValue(normalizedOreo),
    });
    const service = new FoodsService(supabaseService, provider);

    const result = await service.getByBarcode('0066721016123', USER_ID);

    expect(provider.getFoodByBarcode).toHaveBeenCalledWith('0066721016123');
    expect(result).toMatchObject({ name: 'Oreo Original', provider: 'open_food_facts' });
    const upsertArgs: unknown[] = instances[1]!.calls.upsert?.[0] ?? [];
    expect(upsertArgs[0]).toMatchObject({
      provider: 'open_food_facts',
      provider_food_id: '0066721016123',
      barcode: '0066721016123',
    });
  });

  it('returns null (never throws) when the product genuinely is not found anywhere', async () => {
    const { supabaseService } = mockSupabaseSequence([{ data: null, error: null }]);
    const provider = mockProvider({ getFoodByBarcode: jest.fn().mockResolvedValue(null) });
    const service = new FoodsService(supabaseService, provider);

    const result = await service.getByBarcode('0000000000000', USER_ID);

    expect(result).toBeNull();
  });

  it('returns null (degrades gracefully) when the provider throws, rather than failing the request', async () => {
    const { supabaseService } = mockSupabaseSequence([{ data: null, error: null }]);
    const provider = mockProvider({
      getFoodByBarcode: jest.fn().mockRejectedValue(new Error('network down')),
    });
    const service = new FoodsService(supabaseService, provider);

    const result = await service.getByBarcode('0000000000000', USER_ID);

    expect(result).toBeNull();
  });

  it('returns null for a blank barcode without querying the database or the provider', async () => {
    const { supabaseService, from } = mockSupabaseSequence([]);
    const provider = mockProvider();
    const service = new FoodsService(supabaseService, provider);

    const result = await service.getByBarcode('   ', USER_ID);

    expect(result).toBeNull();
    expect(from).not.toHaveBeenCalled();
    expect(provider.getFoodByBarcode).not.toHaveBeenCalled();
  });

  it('throws when the local barcode lookup itself errors', async () => {
    const { supabaseService } = mockSupabaseSequence([{ data: null, error: { message: 'boom' } }]);
    const provider = mockProvider();
    const service = new FoodsService(supabaseService, provider);

    await expect(service.getByBarcode('123', USER_ID)).rejects.toBeInstanceOf(
      InternalServerErrorException,
    );
  });
});
