import { InternalServerErrorException } from '@nestjs/common';
import type { SupabaseService } from '../supabase/supabase.service';
import type { FoodProvider, NormalizedFood } from './food-provider.interface';
import { FoodsService } from './foods.service';
import type { AnthropicNutritionProvider } from './providers/anthropic-nutrition.provider';
import type { InterpretFoodResponse } from './interpretation';

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

function mockNutritionProvider(): AnthropicNutritionProvider {
  return { estimate: jest.fn() } as unknown as AnthropicNutritionProvider;
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
  // Selected only for upsertExternalFoods' own re-ordering of a batch
  // upsert's returned rows -- must match normalizedOreo.providerFoodId
  // below for these fixtures to represent the same food.
  provider_food_id: '0066721016123',
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
    const service = new FoodsService(supabaseService, provider, mockNutritionProvider());

    const result = await service.search('   ', 0, 20);

    expect(result).toEqual({ foods: [], hasMore: false });
    expect(provider.searchFoods).not.toHaveBeenCalled();
  });

  it('returns local (cached/generic) results merged with freshly-cached external results, deduplicated', async () => {
    const { supabaseService, instances } = mockSupabaseSequence([
      { data: [localFoodRow], error: null }, // local search by name
      { data: [], error: null }, // local search by brand
      { data: [cachedExternalFoodRow], error: null }, // batch upsert of the external results
    ]);
    const provider = mockProvider({
      searchFoods: jest.fn().mockResolvedValue({ foods: [normalizedOreo], hasMore: false }),
    });
    const service = new FoodsService(supabaseService, provider, mockNutritionProvider());

    const result = await service.search('food', 0, 20);

    expect(result.foods.map((f) => f.id)).toEqual(['food-1', 'food-2']);
    expect(result.foods[1]).toMatchObject({
      name: 'Oreo Original',
      brand: 'Oreo',
      imageUrl: 'https://images.openfoodfacts.org/oreo-front.jpg',
      provider: 'open_food_facts',
      barcode: '0066721016123',
    });
    // The upsert call is the 3rd builder in the sequence; the batch upsert's
    // first argument is the whole page of rows, not one row.
    const upsertArgs: unknown[] = instances[2]!.calls.upsert?.[0] ?? [];
    const upsertRows = upsertArgs[0] as unknown[];
    expect(upsertRows[0]).toMatchObject({
      provider: 'open_food_facts',
      provider_food_id: '0066721016123',
      image_url: 'https://images.openfoodfacts.org/oreo-front.jpg',
    });
  });

  it('upserts on (provider, provider_food_id) so re-searching never creates a duplicate row', async () => {
    const { supabaseService, instances } = mockSupabaseSequence([
      { data: [], error: null },
      { data: [], error: null },
      { data: [cachedExternalFoodRow], error: null },
    ]);
    const provider = mockProvider({
      searchFoods: jest.fn().mockResolvedValue({ foods: [normalizedOreo], hasMore: false }),
    });
    const service = new FoodsService(supabaseService, provider, mockNutritionProvider());

    await service.search('oreo', 0, 20);

    const upsertBuilder = instances[2]!.builder as { upsert: jest.Mock };
    expect(upsertBuilder.upsert).toHaveBeenCalledWith(
      [expect.objectContaining({ provider_food_id: '0066721016123' })],
      { onConflict: 'provider,provider_food_id' },
    );
  });

  it("preserves the provider's own relevance order, even when the batch upsert returns rows in a different order", async () => {
    const normalizedChicken: NormalizedFood = {
      ...normalizedOreo,
      providerFoodId: 'chicken-id',
      barcode: null,
      name: 'Chicken Breast (cooked)',
      brand: null,
    };
    const chickenRow = {
      ...cachedExternalFoodRow,
      id: 'food-3',
      name: 'Chicken Breast (cooked)',
      brand: null,
      provider_food_id: 'chicken-id',
    };
    // Postgres/PostgREST gives no ordering guarantee for a multi-row
    // upsert's returned rows -- deliberately returned here in the OPPOSITE
    // order from the provider's own result (normalizedOreo first, then
    // normalizedChicken) to prove the service re-orders by input, not by
    // whatever order the database happened to hand back.
    const { supabaseService } = mockSupabaseSequence([
      { data: [], error: null },
      { data: [], error: null },
      { data: [chickenRow, cachedExternalFoodRow], error: null },
    ]);
    const provider = mockProvider({
      searchFoods: jest
        .fn()
        .mockResolvedValue({ foods: [normalizedOreo, normalizedChicken], hasMore: false }),
    });
    const service = new FoodsService(supabaseService, provider, mockNutritionProvider());

    const result = await service.search('food', 0, 20);

    expect(result.foods.map((f) => f.id)).toEqual(['food-2', 'food-3']);
  });

  it('only calls the external provider on the first page', async () => {
    const { supabaseService } = mockSupabaseSequence([
      { data: [], error: null },
      { data: [], error: null },
    ]);
    const provider = mockProvider();
    const service = new FoodsService(supabaseService, provider, mockNutritionProvider());

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
    const service = new FoodsService(supabaseService, provider, mockNutritionProvider());

    const result = await service.search('food', 0, 20);

    expect(result.foods.map((f) => f.id)).toEqual(['food-1']);
  });

  it('falls back to one upsert per food when the batch upsert itself fails, keeping whichever ones succeed', async () => {
    const normalizedChicken: NormalizedFood = {
      ...normalizedOreo,
      providerFoodId: 'chicken-id',
      barcode: null,
      name: 'Chicken Breast (cooked)',
      brand: null,
    };
    const { supabaseService, instances } = mockSupabaseSequence([
      { data: [], error: null }, // local search by name
      { data: [], error: null }, // local search by brand
      { data: null, error: { message: 'batch db error' } }, // the batch upsert itself
      { data: cachedExternalFoodRow, error: null }, // fallback: oreo succeeds
      { data: null, error: { message: 'db error' } }, // fallback: chicken fails
    ]);
    const provider = mockProvider({
      searchFoods: jest
        .fn()
        .mockResolvedValue({ foods: [normalizedOreo, normalizedChicken], hasMore: false }),
    });
    const service = new FoodsService(supabaseService, provider, mockNutritionProvider());

    const result = await service.search('food', 0, 20);

    expect(result.foods.map((f) => f.id)).toEqual(['food-2']);
    // Both fallback upserts go through the per-item path (a single object,
    // not the batch's array), unlike the batch upsert itself.
    expect(instances[3]!.calls.upsert?.[0]?.[0]).not.toBeInstanceOf(Array);
    expect(instances[4]!.calls.upsert?.[0]?.[0]).not.toBeInstanceOf(Array);
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
    const service = new FoodsService(supabaseService, provider, mockNutritionProvider());

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
    const service = new FoodsService(supabaseService, provider, mockNutritionProvider());

    const result = await service.search('food', 0, 10);

    expect(result.foods).toHaveLength(10);
    expect(result.hasMore).toBe(true);
  });

  it('throws when the local search query itself errors', async () => {
    const { supabaseService } = mockSupabaseSequence([{ data: null, error: { message: 'boom' } }]);
    const provider = mockProvider();
    const service = new FoodsService(supabaseService, provider, mockNutritionProvider());

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
    const service = new FoodsService(supabaseService, mockProvider(), mockNutritionProvider());

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
    const service = new FoodsService(supabaseService, mockProvider(), mockNutritionProvider());

    await service.getByBarcode('0066721016123', 'x,created_by.neq.null');

    expect(instances[0]!.calls.or?.[0]).toEqual(['created_by.is.null']);
  });

  it('returns a cached product without calling the provider, on a cache hit', async () => {
    const { supabaseService } = mockSupabaseSequence([
      { data: cachedExternalFoodRow, error: null }, // local barcode lookup
    ]);
    const provider = mockProvider();
    const service = new FoodsService(supabaseService, provider, mockNutritionProvider());

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
    const service = new FoodsService(supabaseService, provider, mockNutritionProvider());

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
    const service = new FoodsService(supabaseService, provider, mockNutritionProvider());

    const result = await service.getByBarcode('0000000000000', USER_ID);

    expect(result).toBeNull();
  });

  it('returns null (degrades gracefully) when the provider throws, rather than failing the request', async () => {
    const { supabaseService } = mockSupabaseSequence([{ data: null, error: null }]);
    const provider = mockProvider({
      getFoodByBarcode: jest.fn().mockRejectedValue(new Error('network down')),
    });
    const service = new FoodsService(supabaseService, provider, mockNutritionProvider());

    const result = await service.getByBarcode('0000000000000', USER_ID);

    expect(result).toBeNull();
  });

  it('returns null for a blank barcode without querying the database or the provider', async () => {
    const { supabaseService, from } = mockSupabaseSequence([]);
    const provider = mockProvider();
    const service = new FoodsService(supabaseService, provider, mockNutritionProvider());

    const result = await service.getByBarcode('   ', USER_ID);

    expect(result).toBeNull();
    expect(from).not.toHaveBeenCalled();
    expect(provider.getFoodByBarcode).not.toHaveBeenCalled();
  });

  it('throws when the local barcode lookup itself errors', async () => {
    const { supabaseService } = mockSupabaseSequence([{ data: null, error: { message: 'boom' } }]);
    const provider = mockProvider();
    const service = new FoodsService(supabaseService, provider, mockNutritionProvider());

    await expect(service.getByBarcode('123', USER_ID)).rejects.toBeInstanceOf(
      InternalServerErrorException,
    );
  });
});

// The Progresso catalog as the service reads it. A name search returns rows whose name
// contains every word of the query (case-insensitive), like the word-by-word ilike queries.
// Brand and the USDA and Open Food Facts sources return nothing here.
function catalogRow(
  name: string,
  servingSize: number,
  servingUnit: string,
  calories: number,
  proteinG: number,
  carbsG: number,
  fatG: number,
) {
  return {
    id: `food-${name}`,
    name,
    brand: null,
    barcode: null,
    serving_size: String(servingSize),
    serving_unit: servingUnit,
    calories: String(calories),
    protein_g: String(proteinG),
    carbs_g: String(carbsG),
    fat_g: String(fatG),
  };
}

const CATALOG = [
  catalogRow('Potato (baked)', 100, 'g', 93, 2.5, 21.2, 0.1),
  catalogRow('Sweet Potato (baked)', 100, 'g', 90, 2, 20.7, 0.2),
  catalogRow('Whole Milk', 1, 'cup', 149, 7.7, 11.7, 8),
  catalogRow('Banana', 1, 'medium', 105, 1.3, 27, 0.4),
  catalogRow('Egg, Large', 1, 'large', 72, 6.3, 0.4, 4.8),
  catalogRow('Butter', 1, 'tbsp', 102, 0.1, 0, 11.5),
  catalogRow('Chicken Breast (cooked)', 100, 'g', 165, 31, 0, 3.6),
  catalogRow('Salmon (cooked)', 100, 'g', 208, 20, 0, 13),
  catalogRow('Peanut Butter', 2, 'tbsp', 188, 8, 6.9, 16),
  catalogRow('Whole Wheat Bread', 1, 'slice', 81, 4, 13.8, 1.1),
];

function catalogSupabase(rows: unknown[]) {
  const from = jest.fn(() => {
    const terms: string[] = [];
    let column = '';
    const builder: Record<string, unknown> = {};
    for (const m of ['select', 'is', 'eq', 'order', 'limit']) {
      builder[m] = jest.fn(() => builder);
    }
    builder.ilike = jest.fn((col: string, pattern: string) => {
      column = col;
      terms.push(pattern.slice(1, -1).toLowerCase());
      return builder;
    });
    builder.then = (resolve: (v: Result) => unknown, reject: (e: unknown) => unknown) => {
      const data =
        column === 'name'
          ? rows.filter((row) => {
              const name = (row as { name: string }).name.toLowerCase();
              return terms.every((term) => name.includes(term));
            })
          : [];
      return Promise.resolve({ data, error: null }).then(resolve, reject);
    };
    return builder;
  });
  return { getClient: () => ({ from }) } as unknown as SupabaseService;
}

function parsedComponent(
  name: string,
  searchTerm: string,
  quantity: number | null,
  unit: string | null,
  brand: string | null = null,
) {
  return { name, searchTerm, quantity, unit, brand };
}

const DEFAULT_ESTIMATE = {
  name: 'estimated',
  servingSize: 1,
  servingUnit: 'serving',
  calories: 100,
  proteinG: 5,
  carbsG: 10,
  fatG: 3,
};

function interpreter(parsed: unknown) {
  const nutritionProvider = {
    parse: jest.fn().mockResolvedValue(parsed),
    estimate: jest.fn().mockResolvedValue(DEFAULT_ESTIMATE),
  };
  const service = new FoodsService(
    catalogSupabase(CATALOG),
    mockProvider(),
    nutritionProvider as unknown as AnthropicNutritionProvider,
  );
  return { service, nutritionProvider };
}

type Interpretation = Extract<InterpretFoodResponse, { status: 'ok' }>['interpretation'];

function interpretation(result: InterpretFoodResponse): Interpretation {
  if (result.status !== 'ok') throw new Error(`expected an interpretation, got ${result.status}`);
  return result.interpretation;
}

describe('FoodsService.interpretDescription', () => {
  it('resolves a grams query from the catalog, as verified, with the catalog caveat', async () => {
    const { service, nutritionProvider } = interpreter({
      clarification: null,
      preparation: 'air fried, no oil',
      main: parsedComponent('air fried potatoes', 'baked potato', 100, 'grams'),
      addedIngredients: [],
    });

    const result = interpretation(
      await service.interpretDescription('100 grams of air fried potatoes with no oil'),
    );

    expect(nutritionProvider.estimate).not.toHaveBeenCalled();
    expect(result.complete).toBe(true);
    expect(result.servingSize).toBe(100);
    expect(result.servingUnit).toBe('g');
    expect(result.preparation).toBe('air fried, no oil');
    const main = result.components[0]!;
    expect(main).toMatchObject({ state: 'resolved' });
    if (main.state !== 'resolved') throw new Error('expected resolved');
    expect(main.component.nutrients).toEqual({
      calories: 93,
      proteinG: 2.5,
      carbsG: 21.2,
      fatG: 0.1,
    });
    expect(main.component.provenance).toMatchObject({
      confidence: 'verified',
      sourceKind: 'progresso_catalog',
      matchedName: 'Potato (baked)',
    });
    expect(main.component.provenance.assumptions[0]).toMatch(/original source/);
    expect(result.totals).toEqual({ calories: 93, proteinG: 2.5, carbsG: 21.2, fatG: 0.1 });
    expect(result.hasEstimate).toBe(false);
  });

  it('asks which food when a bare word matches more than one close candidate', async () => {
    const { service } = interpreter({
      clarification: null,
      preparation: null,
      main: parsedComponent('potato', 'potato', 100, 'g'),
      addedIngredients: [],
    });

    const result = interpretation(await service.interpretDescription('100 g potato'));

    expect(result.complete).toBe(false);
    expect(result.components[0]).toMatchObject({ state: 'choose' });
    const choose = result.components[0]!;
    if (choose.state !== 'choose') throw new Error('expected choose');
    expect(choose.choices.map((c) => c.matchedName)).toEqual([
      'Potato (baked)',
      'Sweet Potato (baked)',
    ]);
  });

  it('resolves a specific phrase unambiguously', async () => {
    const { service } = interpreter({
      clarification: null,
      preparation: null,
      main: parsedComponent('baked potato', 'baked potato', 100, 'g'),
      addedIngredients: [],
    });

    const result = interpretation(await service.interpretDescription('100 g baked potato'));

    expect(result.components[0]).toMatchObject({ state: 'resolved' });
  });

  it('converts a millilitre query against a cup serving, as calculated', async () => {
    const { service } = interpreter({
      clarification: null,
      preparation: null,
      main: parsedComponent('2% milk', 'milk', 250, 'ml'),
      addedIngredients: [],
    });

    const result = interpretation(await service.interpretDescription('250 ml 2% milk'));

    const main = result.components[0]!;
    if (main.state !== 'resolved') throw new Error('expected resolved');
    expect(main.component.nutrients.calories).toBe(157);
    expect(main.component.provenance).toMatchObject({
      confidence: 'calculated',
      matchedName: 'Whole Milk',
    });
  });

  it('matches a medium banana exactly, as verified', async () => {
    const { service } = interpreter({
      clarification: null,
      preparation: null,
      main: parsedComponent('banana', 'banana', 1, 'medium'),
      addedIngredients: [],
    });

    const result = interpretation(await service.interpretDescription('one medium banana'));

    const main = result.components[0]!;
    if (main.state !== 'resolved') throw new Error('expected resolved');
    expect(main.component.nutrients.calories).toBe(105);
    expect(main.component.provenance.confidence).toBe('verified');
  });

  it('scales a multi-serving grams query, as calculated', async () => {
    const { service } = interpreter({
      clarification: null,
      preparation: 'grilled',
      main: parsedComponent('chicken breast', 'chicken breast', 200, 'g'),
      addedIngredients: [],
    });

    const result = interpretation(
      await service.interpretDescription('200g grilled chicken breast'),
    );

    const main = result.components[0]!;
    if (main.state !== 'resolved') throw new Error('expected resolved');
    expect(main.component.nutrients).toEqual({ calories: 330, proteinG: 62, carbsG: 0, fatG: 7.2 });
    expect(main.component.provenance.confidence).toBe('calculated');
  });

  it('resolves explicitly mentioned butter as its own component, and totals the meal once complete', async () => {
    const { service } = interpreter({
      clarification: null,
      preparation: 'scrambled',
      main: parsedComponent('eggs', 'egg', 2, 'large'),
      addedIngredients: [parsedComponent('butter', 'butter', 1, 'tsp')],
    });

    const result = interpretation(
      await service.interpretDescription('2 large scrambled eggs cooked with 1 tsp butter'),
    );

    expect(result.components).toHaveLength(2);
    expect(result.components[1]).toMatchObject({
      state: 'resolved',
      request: { role: 'ingredient' },
    });
    const butter = result.components[1]!;
    if (butter.state !== 'resolved') throw new Error('expected resolved');
    expect(butter.component.nutrients.calories).toBe(34);
    expect(result.complete).toBe(true);
    expect(result.totals?.calories).toBe(144 + 34);
  });

  it('asks for the count of a generic "2 items" rather than assuming a size', async () => {
    const { service } = interpreter({
      clarification: null,
      preparation: 'scrambled',
      main: parsedComponent('eggs', 'egg', 2, 'item'),
      addedIngredients: [],
    });

    const result = interpretation(await service.interpretDescription('2 scrambled eggs'));

    expect(result.complete).toBe(false);
    expect(result.totals).toBeNull();
    expect(result.servingSize).toBeNull();
    expect(result.components[0]).toMatchObject({
      state: 'needs_quantity',
      reason: '"item" doesn\'t name a size',
    });
  });

  it('asks for an amount when the description has none, instead of assuming one', async () => {
    const { service } = interpreter({
      clarification: null,
      preparation: null,
      main: parsedComponent('banana', 'banana', null, null),
      addedIngredients: [],
    });

    const result = interpretation(await service.interpretDescription('banana'));

    expect(result.components[0]).toMatchObject({
      state: 'needs_quantity',
      reason: 'no amount given',
    });
    expect(result.complete).toBe(false);
  });

  it('asks rather than converting mass into volume for a food with only a mass figure', async () => {
    const { service } = interpreter({
      clarification: null,
      preparation: null,
      main: parsedComponent('salmon', 'salmon', 150, 'ml'),
      addedIngredients: [],
    });

    const result = interpretation(await service.interpretDescription('150 ml salmon'));

    expect(result.components[0]).toMatchObject({ state: 'needs_quantity' });
  });

  it('gives a labelled AI estimate only when nothing matches and the amount is known', async () => {
    const { service, nutritionProvider } = interpreter({
      clarification: null,
      preparation: null,
      main: parsedComponent('dragon fruit', 'dragon fruit', 100, 'g'),
      addedIngredients: [],
    });

    const result = interpretation(await service.interpretDescription('100 g dragon fruit'));

    expect(nutritionProvider.estimate).toHaveBeenCalledWith('100 g of dragon fruit');
    const main = result.components[0]!;
    if (main.state !== 'ai_estimate') throw new Error('expected ai_estimate');
    expect(main.component.provenance).toMatchObject({
      confidence: 'ai_estimate',
      sourceKind: 'ai_estimate',
      licence: 'none',
    });
    expect(main.component.provenance.assumptions[0]).toMatch(/Not verified/);
    expect(result.hasEstimate).toBe(true);
    expect(result.complete).toBe(true);
  });

  it('asks for an amount, without estimating, when nothing matches and no amount was given', async () => {
    const { service, nutritionProvider } = interpreter({
      clarification: null,
      preparation: null,
      main: parsedComponent('dragon fruit', 'dragon fruit', null, null),
      addedIngredients: [],
    });

    const result = interpretation(await service.interpretDescription('dragon fruit'));

    expect(nutritionProvider.estimate).not.toHaveBeenCalled();
    expect(result.components[0]).toMatchObject({ state: 'needs_quantity' });
  });

  it('returns a clarification and never estimates when the food itself is unclear', async () => {
    const { service, nutritionProvider } = interpreter({
      clarification: 'What food was it?',
      preparation: null,
      main: null,
      addedIngredients: [],
    });

    const result = await service.interpretDescription('some stuff');

    expect(result).toEqual({ status: 'clarification', question: 'What food was it?' });
    expect(nutritionProvider.estimate).not.toHaveBeenCalled();
  });

  it('resolves one pending component from the candidate the user picked', async () => {
    const { service } = interpreter({
      clarification: null,
      preparation: null,
      main: null,
      addedIngredients: [],
    });

    const status = await service.resolveComponent(
      {
        index: 0,
        role: 'main',
        name: 'potato',
        term: 'potato',
        brand: null,
        barcode: null,
        quantity: { amount: 100, unit: 'g' },
      },
      { sourceKind: 'progresso_catalog', sourceId: 'food-Potato (baked)' },
    );

    expect(status).toMatchObject({ state: 'resolved' });
    if (status.state !== 'resolved') throw new Error('expected resolved');
    expect(status.component.provenance.matchedName).toBe('Potato (baked)');
  });

  it('reports a pick that is no longer offered as not found, without estimating', async () => {
    const { service, nutritionProvider } = interpreter({
      clarification: null,
      preparation: null,
      main: null,
      addedIngredients: [],
    });

    const status = await service.resolveComponent(
      {
        index: 0,
        role: 'main',
        name: 'potato',
        term: 'potato',
        brand: null,
        barcode: null,
        quantity: { amount: 100, unit: 'g' },
      },
      { sourceKind: 'progresso_catalog', sourceId: 'gone' },
    );

    expect(status).toMatchObject({ state: 'not_found' });
    expect(nutritionProvider.estimate).not.toHaveBeenCalled();
  });

  it('propagates a failure from the AI parser rather than swallowing it', async () => {
    const nutritionProvider = {
      parse: jest.fn().mockRejectedValue(new Error('provider down')),
      estimate: jest.fn(),
    };
    const service = new FoodsService(
      catalogSupabase(CATALOG),
      mockProvider(),
      nutritionProvider as unknown as AnthropicNutritionProvider,
    );

    await expect(service.interpretDescription('anything')).rejects.toThrow('provider down');
  });
});
