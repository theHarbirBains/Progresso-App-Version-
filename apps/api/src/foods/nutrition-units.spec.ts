import {
  catalogScale,
  convertQuantity,
  isGenericCountUnit,
  normalizeUnit,
  unitGroup,
} from './nutrition-units';

describe('normalizeUnit', () => {
  it('maps what people type onto the stored short forms', () => {
    expect(normalizeUnit('grams')).toBe('g');
    expect(normalizeUnit('Millilitres')).toBe('ml');
    expect(normalizeUnit('tablespoon')).toBe('tbsp');
    expect(normalizeUnit('fluid ounce')).toBe('fl oz');
    expect(normalizeUnit('  Half Cup ')).toBe('1/2 cup');
  });

  it('leaves a count unit as its trimmed lower-case text', () => {
    expect(normalizeUnit(' Medium ')).toBe('medium');
  });
});

describe('unitGroup', () => {
  it('classifies mass, volume and count units', () => {
    expect(unitGroup('oz')).toBe('mass');
    expect(unitGroup('cup')).toBe('volume');
    expect(unitGroup('slice')).toBe('count');
  });
});

describe('convertQuantity', () => {
  it('converts exactly within mass', () => {
    expect(convertQuantity(1, 'kg', 'g')).toBe(1000);
    expect(convertQuantity(100, 'g', 'oz')).toBeCloseTo(3.5274, 4);
  });

  it('converts exactly within volume', () => {
    expect(convertQuantity(1, 'tbsp', 'tsp')).toBeCloseTo(3, 10);
    expect(convertQuantity(1, 'cup', 'ml')).toBeCloseTo(236.5882365, 6);
  });

  it('refuses mass-to-volume, since that needs a density the catalog does not carry', () => {
    expect(convertQuantity(100, 'g', 'ml')).toBeNull();
  });

  it('refuses a count unit against a measured one', () => {
    expect(convertQuantity(1, 'medium', 'g')).toBeNull();
  });

  it('passes a same-unit count through unchanged', () => {
    expect(convertQuantity(2, 'slice', 'slice')).toBe(2);
  });
});

describe('isGenericCountUnit', () => {
  it('flags units that name no particular food size', () => {
    expect(isGenericCountUnit('item')).toBe(true);
    expect(isGenericCountUnit('serving')).toBe(true);
    expect(isGenericCountUnit('medium')).toBe(false);
  });
});

describe('catalogScale', () => {
  it('scales a grams query against a grams serving', () => {
    expect(catalogScale(200, 'g', { servingSize: 100, servingUnit: 'g' }, 'Chicken')).toEqual({
      factor: 2,
      assumption: null,
    });
  });

  it('scales a millilitre query against a cup serving through an exact conversion', () => {
    const scale = catalogScale(250, 'ml', { servingSize: 1, servingUnit: 'cup' }, 'Whole Milk');
    expect(scale?.factor).toBeCloseTo(250 / 236.5882365, 10);
    expect(scale?.assumption).toBeNull();
  });

  it('scales by the count for a same-unit household serving', () => {
    expect(catalogScale(2, 'slice', { servingSize: 1, servingUnit: 'slice' }, 'Toast')).toEqual({
      factor: 2,
      assumption: null,
    });
  });

  it('matches a generic count to a catalog count unit with a stated assumption', () => {
    const scale = catalogScale(2, 'item', { servingSize: 1, servingUnit: 'large' }, 'Egg, Large');
    expect(scale).toEqual({
      factor: 2,
      assumption: 'Treated "2 item" as 2 × Egg, Large (1 large).',
    });
  });

  it('never matches a generic count to a mass or volume serving', () => {
    expect(catalogScale(2, 'item', { servingSize: 100, servingUnit: 'g' }, 'Potato')).toBeNull();
  });

  it('refuses a mismatch rather than inventing a scale', () => {
    expect(catalogScale(150, 'ml', { servingSize: 100, servingUnit: 'g' }, 'Salmon')).toBeNull();
    expect(catalogScale(1, 'medium', { servingSize: 1, servingUnit: 'large' }, 'Egg')).toBeNull();
  });

  it('refuses non-positive quantities and serving sizes', () => {
    expect(catalogScale(0, 'g', { servingSize: 100, servingUnit: 'g' }, 'X')).toBeNull();
    expect(catalogScale(10, 'g', { servingSize: 0, servingUnit: 'g' }, 'X')).toBeNull();
  });
});
