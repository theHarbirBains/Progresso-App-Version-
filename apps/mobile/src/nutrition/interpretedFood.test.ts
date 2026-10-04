import type {
  ComponentRequest,
  ComponentStatus,
  FoodInterpretation,
  ResolvedComponentFigures,
} from '../lib/api';
import {
  componentSourceLabel,
  libraryFoodInput,
  libraryFoodName,
  libraryProvenance,
  parseAmount,
  withComponentStatus,
} from './interpretedFood';

function request(
  index: number,
  role: 'main' | 'ingredient',
  name: string,
  quantity: ComponentRequest['quantity'],
): ComponentRequest {
  return { index, role, name, term: name, brand: null, barcode: null, quantity };
}

function figures(
  name: string,
  amount: number,
  unit: string,
  calories: number,
  confidence: ResolvedComponentFigures['provenance']['confidence'] = 'verified',
  matchedName: string | null = 'Potato (baked)',
): ResolvedComponentFigures {
  return {
    name,
    quantity: { amount, unit },
    grams: null,
    nutrients: { calories, proteinG: 2.5, carbsG: 21.2, fatG: 0.1 },
    provenance: {
      confidence,
      sourceKind: confidence === 'ai_estimate' ? 'ai_estimate' : 'progresso_catalog',
      sourceId: 'id-1',
      matchedName: confidence === 'ai_estimate' ? null : matchedName,
      brand: null,
      dataVersion: 'progresso-catalog',
      retrievedAt: '2026-10-04T00:00:00.000Z',
      licence: 'none',
      attribution: null,
      assumptions:
        confidence === 'ai_estimate'
          ? ['AI estimate: no food data matched this. Not verified.']
          : [],
    },
  };
}

function resolved(req: ComponentRequest, component: ResolvedComponentFigures): ComponentStatus {
  return { state: 'resolved', request: req, component };
}

const MAIN = request(0, 'main', 'air fried potatoes', { amount: 100, unit: 'g' });
const OIL = request(1, 'ingredient', 'olive oil', { amount: 1, unit: 'tsp' });

function interpretationWith(
  components: ComponentStatus[],
  overrides: Partial<FoodInterpretation> = {},
): FoodInterpretation {
  return {
    name: 'air fried potatoes',
    preparation: 'air fried, no oil',
    components,
    complete: false,
    servingSize: null,
    servingUnit: null,
    totals: null,
    hasEstimate: false,
    ...overrides,
  };
}

describe('withComponentStatus', () => {
  it('keeps totals hidden until every part has a figure, then adds them up', () => {
    const pending: ComponentStatus = {
      state: 'needs_quantity',
      request: OIL,
      matchedName: null,
      options: [],
      reason: 'no amount given',
    };
    const start = interpretationWith([
      resolved(MAIN, figures('air fried potatoes', 100, 'g', 93)),
      pending,
    ]);

    const partial = withComponentStatus(start, start.components[0]!);
    expect(partial.complete).toBe(false);
    expect(partial.totals).toBeNull();

    const done = withComponentStatus(
      partial,
      resolved(OIL, figures('olive oil', 1, 'tsp', 40, 'verified', 'Olive Oil')),
    );
    expect(done.complete).toBe(true);
    expect(done.totals).toEqual({ calories: 133, proteinG: 5, carbsG: 42.4, fatG: 0.2 });
    expect(done.servingSize).toBe(100);
    expect(done.servingUnit).toBe('g');
  });

  it('takes the serving from the main part once it has a figure, not before', () => {
    const start = interpretationWith([
      {
        state: 'needs_quantity',
        request: MAIN,
        matchedName: null,
        options: [],
        reason: 'no amount given',
      },
    ]);
    const next = withComponentStatus(
      start,
      resolved(MAIN, figures('air fried potatoes', 100, 'g', 93)),
    );

    expect(next.servingSize).toBe(100);
    expect(withComponentStatus(start, start.components[0]!).servingSize).toBeNull();
  });

  it('marks the whole food as an estimate when any part is an AI estimate', () => {
    const estimate: ComponentStatus = {
      state: 'ai_estimate',
      request: MAIN,
      component: figures('dragon fruit', 100, 'g', 60, 'ai_estimate'),
    };
    const next = withComponentStatus(
      interpretationWith([{ state: 'choose', request: MAIN, choices: [] }]),
      estimate,
    );

    expect(next.hasEstimate).toBe(true);
    expect(next.complete).toBe(true);
  });
});

describe('libraryFoodName', () => {
  it('keeps the preparation and names added ingredients, without an estimate marker', () => {
    const interpretation = interpretationWith(
      [
        resolved(MAIN, figures('air fried potatoes', 100, 'g', 93)),
        resolved(OIL, figures('olive oil', 1, 'tsp', 40, 'verified', 'Olive Oil')),
      ],
      { complete: true, hasEstimate: false },
    );

    expect(libraryFoodName(interpretation)).toBe(
      'air fried potatoes (air fried, no oil) with 1 tsp olive oil',
    );
  });

  it('does not repeat a preparation the name already says', () => {
    expect(
      libraryFoodName(interpretationWith([], { name: 'Grilled chicken', preparation: 'grilled' })),
    ).toBe('Grilled chicken');
  });
});

describe('libraryProvenance', () => {
  it('stores one figured part as its own provenance', () => {
    const interpretation = interpretationWith(
      [resolved(MAIN, figures('air fried potatoes', 100, 'g', 93))],
      { complete: true },
    );
    expect(libraryProvenance(interpretation)).toMatchObject({
      confidence: 'verified',
      sourceKind: 'progresso_catalog',
      matchedName: 'Potato (baked)',
      components: null,
    });
  });

  it('calculates a multi-part food from its parts, keeping each part', () => {
    const interpretation = interpretationWith(
      [
        resolved(MAIN, figures('air fried potatoes', 100, 'g', 93)),
        resolved(OIL, figures('olive oil', 1, 'tsp', 40, 'verified', 'Olive Oil')),
      ],
      { complete: true },
    );
    const provenance = libraryProvenance(interpretation);

    expect(provenance).toMatchObject({ confidence: 'calculated', sourceKind: null });
    expect(provenance.components).toHaveLength(2);
  });

  it('marks a food with any AI estimate as an AI estimate, and never as verified', () => {
    const estimate: ComponentStatus = {
      state: 'ai_estimate',
      request: OIL,
      component: figures('olive oil', 1, 'tsp', 40, 'ai_estimate'),
    };
    const interpretation = interpretationWith(
      [resolved(MAIN, figures('air fried potatoes', 100, 'g', 93)), estimate],
      { complete: true },
    );

    expect(libraryProvenance(interpretation).confidence).toBe('ai_estimate');
  });
});

describe('libraryFoodInput', () => {
  it('saves the serving the user gave, the totals, and the provenance', () => {
    const interpretation = interpretationWith(
      [resolved(MAIN, figures('air fried potatoes', 100, 'g', 93))],
      {
        complete: true,
        servingSize: 100,
        servingUnit: 'g',
        totals: { calories: 93, proteinG: 2.5, carbsG: 21.2, fatG: 0.1 },
      },
    );

    expect(libraryFoodInput(interpretation)).toMatchObject({
      name: 'air fried potatoes (air fried, no oil)',
      servingSize: 100,
      servingUnit: 'g',
      calories: 93,
      provenance: { confidence: 'verified' },
    });
  });

  it('refuses to build an entry from an incomplete interpretation', () => {
    expect(() => libraryFoodInput(interpretationWith([], { complete: false }))).toThrow(
      /every component/i,
    );
  });
});

describe('componentSourceLabel', () => {
  it('names the Progresso food a verified figure came from', () => {
    expect(componentSourceLabel(resolved(MAIN, figures('air fried potatoes', 100, 'g', 93)))).toBe(
      'From Progresso food data: Potato (baked) (verified)',
    );
  });

  it('marks a scaled figure as calculated', () => {
    expect(
      componentSourceLabel(
        resolved(MAIN, figures('chicken', 200, 'g', 330, 'calculated', 'Chicken Breast')),
      ),
    ).toBe('From Progresso food data: Chicken Breast (calculated)');
  });

  it('says an AI estimate is not verified', () => {
    expect(
      componentSourceLabel({
        state: 'ai_estimate',
        request: MAIN,
        component: figures('x', 1, 'item', 1, 'ai_estimate'),
      }),
    ).toBe('AI estimate, not verified');
  });
});

describe('parseAmount', () => {
  it('reads a number and a unit', () => {
    expect(parseAmount('2 large')).toEqual({ amount: 2, unit: 'large' });
    expect(parseAmount(' 150 g ')).toEqual({ amount: 150, unit: 'g' });
    expect(parseAmount('1.5 cup')).toEqual({ amount: 1.5, unit: 'cup' });
  });

  it('refuses a bare number, zero, or nothing', () => {
    expect(parseAmount('2')).toBeNull();
    expect(parseAmount('0 g')).toBeNull();
    expect(parseAmount('')).toBeNull();
  });
});
