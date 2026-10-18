import { fromServings, gramsPerServing, servingPieces, toServings } from './logQuantity';

describe('gramsPerServing', () => {
  it('weighs a serving given in grams, kilograms or ounces', () => {
    expect(gramsPerServing({ servingSize: 100, servingUnit: 'g' })).toBe(100);
    expect(gramsPerServing({ servingSize: 0.5, servingUnit: 'kg' })).toBe(500);
    expect(gramsPerServing({ servingSize: 1, servingUnit: 'oz' })).toBeCloseTo(28.35, 2);
  });

  it('reads the unit regardless of case or stray spaces', () => {
    expect(gramsPerServing({ servingSize: 30, servingUnit: ' G ' })).toBe(30);
  });

  it('has no weight for a serving that is not one, including fluid ounces', () => {
    for (const servingUnit of ['serving', 'cup', 'slice', 'ml', 'fl oz']) {
      expect(gramsPerServing({ servingSize: 1, servingUnit })).toBeNull();
    }
  });
});

describe('toServings', () => {
  it('turns grams into servings: 250 g of a 100 g serving is 2.5 servings', () => {
    expect(toServings(250, 'g', 100)).toBe(2.5);
  });

  it('turns ounces into servings', () => {
    expect(toServings(4, 'oz', 113.4)).toBe(1);
  });

  it('rounds to the two decimals a log stores', () => {
    expect(toServings(100, 'g', 30)).toBe(3.33);
    expect(toServings(1.555, 'servings', 100)).toBe(1.56);
  });

  it('keeps an amount typed in servings as servings', () => {
    expect(toServings(2, 'servings', 100)).toBe(2);
    expect(toServings(2, 'servings', null)).toBe(2);
  });

  it('gives no number for an amount that is not one', () => {
    expect(toServings(Number('abc'), 'g', 100)).toBeNaN();
  });
});

describe('fromServings', () => {
  it('shows servings as grams or ounces, so switching units keeps the amount', () => {
    expect(fromServings(1, 'g', 182)).toBe('182');
    expect(fromServings(2.5, 'g', 100)).toBe('250');
    expect(fromServings(1, 'oz', 28.349523125)).toBe('1');
    expect(fromServings(1.5, 'servings', 100)).toBe('1.5');
  });

  it('comes back to the same servings after a round trip', () => {
    const grams = Number(fromServings(1, 'oz', 182));
    expect(toServings(grams, 'oz', 182)).toBe(1);
  });
});

describe('servingPieces', () => {
  it('reads the pieces a serving is worded in, counted from the front or in brackets', () => {
    expect(servingPieces('3 cookies (34 g)')).toEqual({
      perServing: 3,
      singular: 'cookie',
      plural: 'cookies',
    });
    expect(servingPieces('34 g (3 Cookies)')).toEqual({
      perServing: 3,
      singular: 'cookie',
      plural: 'cookies',
    });
    expect(servingPieces('3 cookies 34 g')).toMatchObject({ perServing: 3, plural: 'cookies' });
  });

  it('words one piece in the singular and plural: "1 package (85 g)"', () => {
    expect(servingPieces('1 package (85 g)')).toEqual({
      perServing: 1,
      singular: 'package',
      plural: 'packages',
    });
    expect(servingPieces('1 pouch, 40 g')).toMatchObject({ plural: 'pouches' });
    expect(servingPieces('1 patty (113 g)')).toMatchObject({ plural: 'patties' });
    expect(servingPieces('2 patties (226 g)')).toMatchObject({ singular: 'patty' });
    expect(servingPieces('2 brownies (60 g)')).toMatchObject({ singular: 'brownie' });
    expect(servingPieces('1/2 package (42.5 g)')).toMatchObject({
      perServing: 0.5,
      plural: 'packages',
    });
  });

  it('finds no pieces in a plain weight or volume, a serving, or no wording at all', () => {
    for (const label of ['30 g', '250 ml', '1 serving (30 g)', '100g', '', null, undefined]) {
      expect(servingPieces(label)).toBeNull();
    }
  });
});

describe('pieces as servings', () => {
  it('turns pieces into servings and back: 2 cookies of a 3-cookie serving', () => {
    expect(toServings(2, 'pieces', 34, 3)).toBe(0.67);
    expect(toServings(6, 'pieces', 34, 3)).toBe(2);
    expect(fromServings(1, 'pieces', 34, 3)).toBe('3');
    expect(fromServings(0.5, 'pieces', null, 1)).toBe('0.5');
  });
});
