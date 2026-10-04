import {
  DEFAULT_SERVING_UNIT,
  SERVING_UNITS,
  servingUnitLabel,
  servingUnitOptions,
} from './servingUnits';

describe('servingUnits', () => {
  it('defaults new foods to grams, the unit the seed data and barcode lookups already use', () => {
    expect(DEFAULT_SERVING_UNIT).toBe('g');
    expect(SERVING_UNITS.some((unit) => unit.value === DEFAULT_SERVING_UNIT)).toBe(true);
  });

  it('stores the short forms existing data uses, labelled with the wording users read', () => {
    expect(SERVING_UNITS).toEqual(
      expect.arrayContaining([
        { value: 'g', label: 'gram' },
        { value: 'oz', label: 'ounce' },
        { value: 'tbsp', label: 'tablespoon' },
        { value: 'fl oz', label: 'fluid ounce' },
        { value: 'ml', label: 'millilitre' },
      ]),
    );
  });

  it('has no duplicate stored values', () => {
    const values = SERVING_UNITS.map((unit) => unit.value);
    expect(new Set(values).size).toBe(values.length);
  });

  it('offers the standard list unchanged for a standard unit', () => {
    expect(servingUnitOptions('cup')).toBe(SERVING_UNITS);
  });

  it('keeps a non-standard existing unit as its own first option, never rewriting it', () => {
    const options = servingUnitOptions('large');
    expect(options[0]).toEqual({ value: 'large', label: 'large' });
    expect(options.slice(1)).toEqual(SERVING_UNITS);
  });

  it('offers the standard list for an empty value', () => {
    expect(servingUnitOptions('')).toBe(SERVING_UNITS);
  });

  it('labels a stored unit, falling back to the stored text itself', () => {
    expect(servingUnitLabel('g')).toBe('gram');
    expect(servingUnitLabel('large')).toBe('large');
  });
});
