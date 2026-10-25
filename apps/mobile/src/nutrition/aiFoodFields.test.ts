import {
  AI_FOOD_UNITS,
  aiFoodDescription,
  defaultUnitFor,
  parseAmount,
  unitsFor,
} from './aiFoodFields';

describe('aiFoodDescription', () => {
  it('reads as one description: how much of what, then how it was made', () => {
    expect(
      aiFoodDescription({
        amount: '150',
        unit: 'g',
        food: ' chicken breast ',
        preparation: ' air fried with 1 tsp olive oil ',
      }),
    ).toBe('150 g of chicken breast, air fried with 1 tsp olive oil');
  });

  it('names one of a unit, or several', () => {
    const base = { food: 'toast', preparation: '' };
    expect(aiFoodDescription({ ...base, amount: '1', unit: 'slice' })).toBe('1 slice of toast');
    expect(aiFoodDescription({ ...base, amount: '2', unit: 'slice' })).toBe('2 slices of toast');
    expect(aiFoodDescription({ ...base, amount: '1,5', unit: 'cup' })).toBe('1.5 cups of toast');
  });

  it('leaves out an amount that is blank or not a number, and a blank preparation', () => {
    expect(aiFoodDescription({ amount: '', unit: 'g', food: 'Gala apple', preparation: '' })).toBe(
      'Gala apple',
    );
    expect(
      aiFoodDescription({ amount: 'abc', unit: 'g', food: 'Gala apple', preparation: '  ' }),
    ).toBe('Gala apple');
  });
});

describe('parseAmount', () => {
  it('reads a number above zero, null for blank, and NaN for anything else', () => {
    expect(parseAmount('150')).toBe(150);
    expect(parseAmount('0,5')).toBe(0.5);
    expect(parseAmount('  ')).toBeNull();
    expect(parseAmount('0')).toBeNaN();
    expect(parseAmount('-1')).toBeNaN();
    expect(parseAmount('lots')).toBeNaN();
  });
});

describe('units for a food', () => {
  it('offers every unit asked for, whatever the food', () => {
    const wanted = ['g', 'kg', 'oz', 'lb', 'ml', 'l', 'piece', 'cup', 'tbsp', 'tsp', 'slice'];
    for (const food of ['milk', 'toast', 'egg', 'rice', '']) {
      const offered = unitsFor(food).map((unit) => unit.value);
      expect(offered).toEqual(expect.arrayContaining([...wanted, 'serving']));
      expect(offered).toHaveLength(AI_FOOD_UNITS.length);
    }
  });

  it('puts the units a food is usually measured in first', () => {
    expect(defaultUnitFor('Fairlife 2% milk')).toBe('ml');
    expect(defaultUnitFor('orange juice')).toBe('ml');
    expect(defaultUnitFor('sourdough bread')).toBe('slice');
    expect(defaultUnitFor('Gala apple')).toBe('piece');
    expect(defaultUnitFor('scrambled eggs')).toBe('piece');
    expect(defaultUnitFor('chicken breast')).toBe('g');
    expect(defaultUnitFor('')).toBe('g');
  });

  it('matches whole words only', () => {
    // "steak" is not "tea".
    expect(defaultUnitFor('steak')).toBe('g');
  });
});
