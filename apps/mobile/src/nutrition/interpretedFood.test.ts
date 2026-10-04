import type { FoodInterpretation, InterpretedComponent } from '../lib/api';
import { componentSourceLabel, libraryFoodInput, libraryFoodName } from './interpretedFood';

function component(overrides: Partial<InterpretedComponent>): InterpretedComponent {
  return {
    role: 'main',
    name: 'food',
    quantity: 1,
    unit: 'g',
    source: 'database',
    matchedName: 'Matched Food',
    assumption: null,
    calories: 100,
    proteinG: 5,
    carbsG: 10,
    fatG: 3,
    ...overrides,
  };
}

function interpretation(overrides: Partial<FoodInterpretation> = {}): FoodInterpretation {
  return {
    name: 'air fried potatoes',
    servingSize: 100,
    servingUnit: 'g',
    preparation: null,
    components: [component({ name: 'air fried potatoes', quantity: 100, unit: 'g' })],
    totals: { calories: 93, proteinG: 2.5, carbsG: 21.2, fatG: 0.1 },
    hasEstimate: false,
    ...overrides,
  };
}

describe('libraryFoodName', () => {
  it('uses the food name alone when there is nothing more to say', () => {
    expect(libraryFoodName(interpretation({ name: 'Banana' }))).toBe('Banana');
  });

  it('keeps the preparation so an explicit "no oil" is not lost', () => {
    expect(libraryFoodName(interpretation({ preparation: 'air fried, no oil' }))).toBe(
      'air fried potatoes (air fried, no oil)',
    );
  });

  it('does not repeat a preparation the name already says', () => {
    expect(
      libraryFoodName(interpretation({ name: 'Grilled chicken', preparation: 'Grilled' })),
    ).toBe('Grilled chicken');
  });

  it('names each added ingredient with its amount', () => {
    const name = libraryFoodName(
      interpretation({
        name: 'Scrambled eggs',
        components: [
          component({ role: 'main', name: 'Scrambled eggs' }),
          component({ role: 'ingredient', name: 'butter', quantity: 1, unit: 'tsp' }),
          component({ role: 'ingredient', name: 'olive oil', quantity: 2, unit: 'tbsp' }),
        ],
      }),
    );
    expect(name).toBe('Scrambled eggs with 1 tsp butter, 2 tbsp olive oil');
  });

  it('marks a food that includes an AI estimate', () => {
    expect(libraryFoodName(interpretation({ name: 'Dragon fruit bowl', hasEstimate: true }))).toBe(
      'Dragon fruit bowl (AI estimate)',
    );
  });
});

describe('libraryFoodInput', () => {
  it('saves the interpreted amount as the serving and the totals as the nutrition', () => {
    const input = libraryFoodInput(
      interpretation({
        preparation: 'air fried, no oil',
        totals: { calories: 93, proteinG: 2.5, carbsG: 21.2, fatG: 0.1 },
      }),
    );

    expect(input).toEqual({
      name: 'air fried potatoes (air fried, no oil)',
      servingSize: 100,
      servingUnit: 'g',
      calories: 93,
      proteinG: 2.5,
      carbsG: 21.2,
      fatG: 0.1,
    });
  });
});

describe('componentSourceLabel', () => {
  it('names the Progresso food a database figure came from', () => {
    expect(componentSourceLabel(component({ matchedName: 'Potato (baked)' }))).toBe(
      'From Progresso food data: Potato (baked)',
    );
  });

  it('says an AI estimate is not verified', () => {
    expect(componentSourceLabel(component({ source: 'ai_estimate', matchedName: null }))).toBe(
      'AI estimate, not verified',
    );
  });
});
