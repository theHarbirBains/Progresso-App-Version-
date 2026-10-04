// Tests for the nutrition-resolution modules. Pure logic only: no network, no database.

import { candidateFromUsda, measuresFromUsda, nutrientsFromUsda } from './usda-fdc.mapping';
import { resolveComponent, type ComponentInput } from './resolver';
import { scaleFor } from './quantity';
import { nameScore, brandScore, scoreCandidate, tokenize } from './scoring';
import type {
  FoodQuery,
  Licence,
  NutritionSource,
  SourceCandidate,
  SourceKind,
} from './source.interface';

const RETRIEVED = '2026-10-04T00:00:00.000Z';

function candidate(overrides: Partial<SourceCandidate> & { matchedName: string }): SourceCandidate {
  return {
    sourceKind: 'progresso_catalog',
    sourceId: overrides.matchedName,
    brand: null,
    barcode: null,
    basis: {
      kind: 'per_100g',
      nutrients: { calories: 93, proteinG: 2.5, carbsG: 21.2, fatG: 0.1 },
    },
    measures: [],
    dataVersion: 'test-1',
    retrievedAt: RETRIEVED,
    ...overrides,
  };
}

function source(
  kind: SourceKind,
  candidates: SourceCandidate[],
  licence: Licence = 'public_domain',
): NutritionSource {
  return {
    kind,
    licence,
    storable: licence !== 'live_only',
    search: jest.fn().mockResolvedValue(candidates),
    attribution: (c) => (licence === 'public_domain' ? `${c.sourceKind} ${c.dataVersion}` : null),
  };
}

function query(term: string, extra: Partial<FoodQuery> = {}): FoodQuery {
  return { term, brand: null, barcode: null, restaurant: null, ...extra };
}

function input(
  name: string,
  term: string,
  quantity: ComponentInput['quantity'],
  extra: Partial<FoodQuery> = {},
): ComponentInput {
  return { name, query: query(term, extra), quantity };
}

// Recorded from api.nal.usda.gov on 2026-10-04 (food 170112, SR Legacy), per 100 g.
const USDA_POTATO_FOOD = {
  fdcId: 170112,
  description: 'Potatoes, baked, flesh, with salt',
  dataType: 'SR Legacy',
  foodNutrients: [
    { nutrientId: 1008, value: 93 },
    { nutrientId: 1003, value: 1.96 },
    { nutrientId: 1004, value: 0.1 },
    { nutrientId: 1005, value: 21.55 },
  ],
};
const USDA_POTATO_PORTIONS = [
  {
    amount: 0.5,
    gramWeight: 61,
    measureUnit: { name: 'undetermined' },
    modifier: 'cup',
    portionDescription: null,
  },
  {
    amount: 1,
    gramWeight: 156,
    measureUnit: { name: 'undetermined' },
    modifier: 'potato (2-1/3" x 4-3/4")',
    portionDescription: null,
  },
];

describe('USDA mapping (recorded response)', () => {
  it('maps the four macros from the per-100 g nutrient IDs', () => {
    expect(nutrientsFromUsda(USDA_POTATO_FOOD.foodNutrients)).toEqual({
      calories: 93,
      proteinG: 1.96,
      carbsG: 21.55,
      fatG: 0.1,
    });
  });

  it('returns null when a macro is missing, rather than a fabricated zero', () => {
    expect(nutrientsFromUsda([{ nutrientId: 1008, value: 93 }])).toBeNull();
  });

  it('reads the household name from modifier, not from the "undetermined" measure name', () => {
    expect(measuresFromUsda(USDA_POTATO_PORTIONS)).toEqual([
      { unit: 'cup', amount: 0.5, grams: 61 },
      { unit: 'potato (2-1/3" x 4-3/4")', amount: 1, grams: 156 },
    ]);
  });

  it('drops a portion with no gram weight rather than guessing one', () => {
    expect(measuresFromUsda([{ amount: 1, gramWeight: 0, modifier: 'cup' }])).toEqual([]);
  });

  it('builds a per-100 g candidate with its measures and dataset version', () => {
    const built = candidateFromUsda(
      USDA_POTATO_FOOD,
      USDA_POTATO_PORTIONS,
      'SR Legacy 2019',
      RETRIEVED,
    );
    expect(built).toMatchObject({
      sourceKind: 'usda_fdc',
      sourceId: '170112',
      matchedName: 'Potatoes, baked, flesh, with salt',
      basis: { kind: 'per_100g' },
      dataVersion: 'SR Legacy 2019',
    });
    expect(built?.measures).toHaveLength(2);
  });
});

describe('tokenize and scoring', () => {
  it('singularises plurals so "potatoes" matches "potato"', () => {
    expect(tokenize('Potatoes')).toEqual(['potato']);
    expect(tokenize('Berries')).toEqual(['berry']);
  });

  it('scores an exact name as 1', () => {
    expect(nameScore('potato', 'Potato')).toBe(1);
  });

  it('prefers the plain food over one with extra words the user did not ask for', () => {
    const plain = nameScore('potato', 'Potato (baked)');
    const sweet = nameScore('potato', 'Sweet Potato (baked)');
    expect(plain).toBeGreaterThan(sweet);
    expect(plain).toBeGreaterThan(0.85);
  });

  it('scores a named brand that does not match as zero', () => {
    expect(brandScore('Fairlife', 'Oreo')).toBe(0);
    expect(brandScore('Fairlife', 'Fairlife LLC')).toBe(1);
    expect(brandScore(null, 'Oreo')).toBe(1);
  });

  it('treats a matching barcode as conclusive', () => {
    const scored = scoreCandidate(
      { term: 'anything', brand: null, barcode: '012345', restaurant: null },
      candidate({ matchedName: 'Other', barcode: '012345' }),
    );
    expect(scored.score).toBe(1);
  });
});

describe('scaleFor', () => {
  it('scales grams against grams exactly', () => {
    const scale = scaleFor({ amount: 200, unit: 'g' }, candidate({ matchedName: 'x' }));
    expect(scale).toMatchObject({ ok: true, factor: 2, exact: false, via: 'same_family' });
  });

  it('marks the published amount as exact', () => {
    const scale = scaleFor({ amount: 100, unit: 'g' }, candidate({ matchedName: 'x' }));
    expect(scale).toMatchObject({ ok: true, factor: 1, exact: true });
  });

  it('converts a kilogram amount exactly', () => {
    const scale = scaleFor({ amount: 0.1, unit: 'kg' }, candidate({ matchedName: 'x' }));
    expect(scale).toMatchObject({ ok: true, factor: 1, exact: true });
  });

  it("uses the food's own published measure for a cup, and marks it verified only at the published amount", () => {
    const potato = candidateFromUsda(
      USDA_POTATO_FOOD,
      USDA_POTATO_PORTIONS,
      'SR Legacy 2019',
      RETRIEVED,
    )!;
    const half = scaleFor({ amount: 0.5, unit: 'cup' }, potato);
    expect(half).toMatchObject({ ok: true, via: 'measure', exact: true });
    expect(half.ok && half.grams).toBeCloseTo(61, 6);

    const one = scaleFor({ amount: 1, unit: 'cup' }, potato);
    expect(one).toMatchObject({ ok: true, via: 'measure', exact: false });
    expect(one.ok && one.grams).toBeCloseTo(122, 6);
  });

  it('scales a millilitre amount against a cup serving by volume, with no density needed', () => {
    const milk = candidate({
      matchedName: 'Fairlife 2% milk',
      basis: {
        kind: 'per_serving',
        size: 1,
        unit: 'cup',
        nutrients: { calories: 150, proteinG: 13, carbsG: 6, fatG: 4.5 },
      },
    });
    const scale = scaleFor({ amount: 250, unit: 'ml' }, milk);
    expect(scale).toMatchObject({ ok: true, via: 'same_family', exact: false });
    expect(scale.ok && scale.factor).toBeCloseTo(250 / 236.5882365, 9);
  });

  it('refuses a grams amount against a volume-only serving with no measure', () => {
    const milk = candidate({
      matchedName: 'Milk',
      basis: {
        kind: 'per_serving',
        size: 1,
        unit: 'cup',
        nutrients: { calories: 150, proteinG: 8, carbsG: 12, fatG: 8 },
      },
    });
    expect(scaleFor({ amount: 250, unit: 'g' }, milk)).toEqual({
      ok: false,
      reason: 'no_conversion',
    });
  });

  it('refuses a generic count, which names no size', () => {
    expect(scaleFor({ amount: 2, unit: 'item' }, candidate({ matchedName: 'x' }))).toEqual({
      ok: false,
      reason: 'ambiguous_count',
    });
  });

  it('refuses a non-positive amount', () => {
    expect(scaleFor({ amount: 0, unit: 'g' }, candidate({ matchedName: 'x' }))).toEqual({
      ok: false,
      reason: 'invalid_amount',
    });
  });
});

describe('resolveComponent', () => {
  it('resolves an exact catalog match with verified provenance at the published amount', async () => {
    const catalog = source('progresso_catalog', [candidate({ matchedName: 'Potato (baked)' })]);
    const outcome = await resolveComponent(
      input('air fried potatoes', 'potato', { amount: 100, unit: 'g' }),
      [catalog],
    );

    expect(outcome).toMatchObject({
      status: 'resolved',
      component: {
        grams: 100,
        nutrients: { calories: 93, proteinG: 2.5, carbsG: 21.2, fatG: 0.1 },
        provenance: {
          confidence: 'verified',
          sourceKind: 'progresso_catalog',
          matchedName: 'Potato (baked)',
        },
      },
    });
  });

  it('marks a scaled amount as calculated, never verified', async () => {
    const catalog = source('progresso_catalog', [
      candidate({
        matchedName: 'Chicken Breast (cooked)',
        basis: {
          kind: 'per_100g',
          nutrients: { calories: 165, proteinG: 31, carbsG: 0, fatG: 3.6 },
        },
      }),
    ]);
    const outcome = await resolveComponent(
      input('chicken breast', 'chicken breast', { amount: 200, unit: 'g' }),
      [catalog],
    );

    expect(outcome).toMatchObject({
      status: 'resolved',
      component: {
        nutrients: { calories: 330, proteinG: 62, fatG: 7.2 },
        provenance: { confidence: 'calculated' },
      },
    });
  });

  it("asks for a quantity rather than assuming one, and offers the source's own amounts", async () => {
    const usda = source('usda_fdc', [
      candidateFromUsda(USDA_POTATO_FOOD, USDA_POTATO_PORTIONS, 'SR Legacy 2019', RETRIEVED)!,
    ]);
    const outcome = await resolveComponent(input('baked potato', 'baked potato', null), [usda]);

    expect(outcome).toMatchObject({ status: 'needs_quantity', reason: 'no amount given' });
    if (outcome.status !== 'needs_quantity') throw new Error('expected needs_quantity');
    expect(outcome.options.map((o) => o.label)).toEqual([
      '100 g',
      '0.5 cup',
      '1 potato (2-1/3" x 4-3/4")',
    ]);
  });

  it('asks for a quantity when the amount is in a unit the food cannot convert', async () => {
    const catalog = source('progresso_catalog', [candidate({ matchedName: 'Potato (baked)' })]);
    const outcome = await resolveComponent(input('potato', 'potato', { amount: 1, unit: 'cup' }), [
      catalog,
    ]);

    expect(outcome).toMatchObject({ status: 'needs_quantity' });
  });

  it('asks for a quantity when the amount is a generic count', async () => {
    const catalog = source('progresso_catalog', [candidate({ matchedName: 'Egg, Large' })]);
    const outcome = await resolveComponent(input('eggs', 'egg', { amount: 2, unit: 'item' }), [
      catalog,
    ]);

    expect(outcome).toMatchObject({
      status: 'needs_quantity',
      reason: '"item" doesn\'t name a size',
    });
  });

  it('gives the user the choice between close branded matches instead of picking one', async () => {
    const branded = source(
      'open_food_facts',
      [
        candidate({
          sourceKind: 'open_food_facts',
          sourceId: '1',
          matchedName: 'Oreo Original',
          brand: 'Mondelez',
        }),
        candidate({
          sourceKind: 'open_food_facts',
          sourceId: '2',
          matchedName: 'Oreo Original',
          brand: 'Mondelez Canada',
        }),
      ],
      'odbl',
    );
    const outcome = await resolveComponent(input('Oreo', 'oreo', { amount: 1, unit: 'item' }), [
      branded,
    ]);

    expect(outcome).toMatchObject({ status: 'choose' });
    if (outcome.status !== 'choose') throw new Error('expected choose');
    expect(outcome.choices).toHaveLength(2);
  });

  it('never resolves a named brand to a different product', async () => {
    const other = source(
      'open_food_facts',
      [
        candidate({
          sourceKind: 'open_food_facts',
          sourceId: '9',
          matchedName: 'Chips Ahoy',
          brand: 'Nabisco',
        }),
      ],
      'odbl',
    );
    const outcome = await resolveComponent(
      input('Fairlife milk', 'milk', { amount: 250, unit: 'ml' }, { brand: 'Fairlife' }),
      [other],
    );

    expect(outcome.status).not.toBe('resolved');
  });

  it('prefers the catalog over a later source when both match unambiguously', async () => {
    const catalog = source('progresso_catalog', [candidate({ matchedName: 'Banana' })]);
    const usda = source('usda_fdc', [
      candidate({ sourceKind: 'usda_fdc', sourceId: '999', matchedName: 'Banana, raw' }),
    ]);
    const outcome = await resolveComponent(input('banana', 'banana', { amount: 100, unit: 'g' }), [
      catalog,
      usda,
    ]);

    expect(outcome).toMatchObject({
      status: 'resolved',
      component: { provenance: { sourceKind: 'progresso_catalog' } },
    });
  });

  it('falls through to USDA when the catalog has nothing for the request', async () => {
    const catalog = source('progresso_catalog', []);
    const usda = source('usda_fdc', [
      candidateFromUsda(USDA_POTATO_FOOD, USDA_POTATO_PORTIONS, 'SR Legacy 2019', RETRIEVED)!,
    ]);
    const outcome = await resolveComponent(
      input('baked potato', 'baked potato', { amount: 100, unit: 'g' }),
      [catalog, usda],
    );

    expect(outcome).toMatchObject({
      status: 'resolved',
      component: {
        provenance: {
          confidence: 'verified',
          sourceKind: 'usda_fdc',
          sourceId: '170112',
          attribution: 'usda_fdc SR Legacy 2019',
          licence: 'public_domain',
        },
      },
    });
  });

  it('records the USDA measure used for a household amount as an assumption the user can see', async () => {
    const usda = source('usda_fdc', [
      candidateFromUsda(USDA_POTATO_FOOD, USDA_POTATO_PORTIONS, 'SR Legacy 2019', RETRIEVED)!,
    ]);
    const outcome = await resolveComponent(
      input('mashed potato', 'baked potato', { amount: 1, unit: 'cup' }),
      [usda],
    );

    expect(outcome).toMatchObject({
      status: 'resolved',
      component: { provenance: { confidence: 'calculated' } },
    });
    if (outcome.status !== 'resolved') throw new Error('expected resolved');
    expect(outcome.component.provenance.assumptions[0]).toMatch(/cup/);
  });

  it('skips a source that throws, and still returns from the next one', async () => {
    const broken: NutritionSource = {
      kind: 'open_food_facts',
      licence: 'odbl',
      storable: true,
      search: jest.fn().mockRejectedValue(new Error('timeout')),
      attribution: () => null,
    };
    const usda = source('usda_fdc', [
      candidateFromUsda(USDA_POTATO_FOOD, USDA_POTATO_PORTIONS, 'SR Legacy 2019', RETRIEVED)!,
    ]);
    const outcome = await resolveComponent(
      input('baked potato', 'baked potato', { amount: 100, unit: 'g' }),
      [broken, usda],
    );

    expect(outcome.status).toBe('resolved');
  });

  it('marks a live-only source as not storable through its licence', async () => {
    const live = source(
      'open_food_facts',
      [candidate({ sourceKind: 'open_food_facts', sourceId: '5', matchedName: 'Granola Bar' })],
      'live_only',
    );
    const outcome = await resolveComponent(
      input('granola bar', 'granola bar', { amount: 100, unit: 'g' }),
      [live],
    );

    expect(outcome).toMatchObject({
      status: 'resolved',
      component: { provenance: { licence: 'live_only' } },
    });
  });

  it('reports not_found when no source has anything, so the caller can decide the next step', async () => {
    const empty = source('usda_fdc', []);
    await expect(
      resolveComponent(input('dragon fruit', 'dragon fruit', { amount: 100, unit: 'g' }), [empty]),
    ).resolves.toEqual({
      status: 'not_found',
      name: 'dragon fruit',
    });
  });
});

describe('resolveComponent source priority', () => {
  it('does not let a weaker source override a strong but ambiguous higher-priority set', async () => {
    const catalog = source('progresso_catalog', [
      candidate({ matchedName: 'Potato (baked)' }),
      candidate({ matchedName: 'Potato (boiled)' }),
    ]);
    const usda = source('usda_fdc', [
      candidate({ sourceKind: 'usda_fdc', sourceId: '1', matchedName: 'Potato Chips' }),
    ]);
    const outcome = await resolveComponent(input('potato', 'potato', { amount: 100, unit: 'g' }), [
      catalog,
      usda,
    ]);

    expect(outcome.status).toBe('choose');
    expect(usda.search).not.toHaveBeenCalled();
  });

  it('falls through to a later source that can express the amount, when an earlier one cannot', async () => {
    const catalog = source('progresso_catalog', [
      candidate({ matchedName: 'White Rice (cooked)' }),
    ]);
    const usda = source('usda_fdc', [
      candidate({
        sourceKind: 'usda_fdc',
        sourceId: '2',
        matchedName: 'Rice, white, cooked',
        measures: [{ unit: 'cup', amount: 1, grams: 158 }],
      }),
    ]);
    const outcome = await resolveComponent(
      input('white rice', 'white rice', { amount: 1, unit: 'cup' }),
      [catalog, usda],
    );

    expect(outcome).toMatchObject({
      status: 'resolved',
      component: { provenance: { sourceKind: 'usda_fdc' } },
    });
  });
});
