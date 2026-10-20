import {
  groupTotals,
  itemAmountText,
  recipePerServing,
  recipeProvenance,
  type FoodGroupItem,
} from './foodGroups';
import type { FoodRow } from './foodQueries';

function food(overrides: Partial<FoodRow> = {}): FoodRow {
  return {
    id: 'food-oats',
    name: 'Oats',
    brand: null,
    barcode: null,
    imageUrl: null,
    servingSize: 40,
    servingUnit: 'g',
    calories: 150,
    proteinG: 5,
    carbsG: 27,
    fatG: 3,
    isActive: true,
    provenance: null,
    ...overrides,
  };
}

const oats: FoodGroupItem = { food: food(), quantity: 2, entered: { amount: 80, unit: 'g' } };
const milk: FoodGroupItem = {
  food: food({
    id: 'food-milk',
    name: 'Milk',
    servingSize: 250,
    servingUnit: 'ml',
    calories: 120,
    proteinG: 8,
    carbsG: 12,
    fatG: 4.5,
  }),
  quantity: 1,
  entered: null,
};

describe('groupTotals', () => {
  it("adds up every item's figures at its amount", () => {
    expect(groupTotals([oats, milk])).toEqual({
      calories: 420,
      proteinG: 18,
      carbsG: 66,
      fatG: 10.5,
    });
  });

  it('is nothing for no items', () => {
    expect(groupTotals([])).toEqual({ calories: 0, proteinG: 0, carbsG: 0, fatG: 0 });
  });
});

describe('recipePerServing', () => {
  it('divides the whole recipe by the servings it makes', () => {
    expect(recipePerServing([oats, milk], 2)).toEqual({
      calories: 210,
      proteinG: 9,
      carbsG: 33,
      fatG: 5.25,
    });
  });

  it('rounds to two decimals, like the food it is saved as', () => {
    expect(recipePerServing([milk], 3).calories).toBe(40);
    expect(recipePerServing([milk], 3).fatG).toBe(1.5);
    expect(recipePerServing([oats], 3).proteinG).toBe(3.33);
  });
});

describe('itemAmountText', () => {
  it('shows the amount as typed, or the servings', () => {
    expect(itemAmountText(oats)).toBe('80 g');
    expect(itemAmountText(milk)).toBe('1 serving');
    expect(itemAmountText({ ...milk, quantity: 1.5 })).toBe('1.5 servings');
  });

  it("counts pieces in the serving's own words", () => {
    const cookies = {
      food: food({ name: 'Oreo', servingSize: 34, servingLabel: '3 cookies (34 g)' }),
      quantity: 0.67,
      entered: { amount: 2, unit: 'pieces' as const },
    };
    expect(itemAmountText(cookies)).toBe('2 cookies');
  });
});

describe('recipeProvenance', () => {
  it('is calculated from its ingredients, each kept with its amount and figures', () => {
    const provenance = recipeProvenance([oats, milk]);

    expect(provenance).toMatchObject({
      confidence: 'calculated',
      sourceKind: 'user_entered',
      licence: 'none',
      assumptions: [],
    });
    expect(provenance.components).toEqual([
      {
        name: 'Oats',
        amount: '80 g',
        calories: 300,
        proteinG: 10,
        carbsG: 54,
        fatG: 6,
        confidence: null,
      },
      {
        name: 'Milk',
        amount: '1 serving',
        calories: 120,
        proteinG: 8,
        carbsG: 12,
        fatG: 4.5,
        confidence: null,
      },
    ]);
  });

  it('is an AI estimate when any ingredient is, and says so', () => {
    const estimated = {
      ...milk,
      food: {
        ...milk.food,
        provenance: {
          confidence: 'ai_estimate' as const,
          sourceKind: 'ai_estimate',
          sourceId: null,
          matchedName: null,
          dataVersion: null,
          retrievedAt: null,
          licence: 'none',
          attribution: null,
          assumptions: [],
          components: null,
        },
      },
    };

    const provenance = recipeProvenance([oats, estimated]);

    expect(provenance.confidence).toBe('ai_estimate');
    expect(provenance.assumptions).toEqual(['Some ingredients are AI estimates, not verified.']);
  });
});
