import { csvRecord, parseCsvLine, releaseLabelFrom, UsdaReferenceBuilder } from './usda-fdc.import';

describe('parseCsvLine', () => {
  it('splits plain fields', () => {
    expect(parseCsvLine('1,sr_legacy_food,Apple')).toEqual(['1', 'sr_legacy_food', 'Apple']);
  });

  it('keeps commas inside quoted fields and unescapes doubled quotes', () => {
    expect(parseCsvLine('"170112","Potatoes, baked, flesh, with ""skin"""')).toEqual([
      '170112',
      'Potatoes, baked, flesh, with "skin"',
    ]);
  });

  it('keeps empty fields', () => {
    expect(parseCsvLine('a,,c,')).toEqual(['a', '', 'c', '']);
  });

  it('rejects a multi-line quoted field rather than mis-reading it', () => {
    expect(() => parseCsvLine('"unterminated,field')).toThrow(/multi-line/);
  });
});

describe('csvRecord', () => {
  it('pairs header names with values', () => {
    expect(csvRecord(['fdc_id', 'description'], '"5","Milk"')).toEqual({
      fdc_id: '5',
      description: 'Milk',
    });
  });
});

describe('releaseLabelFrom', () => {
  it('reads the release date from the extracted folder name', () => {
    expect(releaseLabelFrom('/data/FoodData_Central_foundation_food_csv_2026-04-30')).toBe(
      '2026-04-30',
    );
    expect(releaseLabelFrom('FoodData_Central_sr_legacy_food_csv_2018-04')).toBe('2018-04');
  });
});

const UNITS = new Map([
  ['9999', 'undetermined'],
  ['1001', 'egg'],
]);

function builder() {
  return new UsdaReferenceBuilder('2018-04', UNITS);
}

const FULL_NUTRIENTS = [
  { fdc_id: '170112', nutrient_id: '1008', amount: '93' },
  { fdc_id: '170112', nutrient_id: '1003', amount: '1.96' },
  { fdc_id: '170112', nutrient_id: '1004', amount: '0.1' },
  { fdc_id: '170112', nutrient_id: '1005', amount: '21.55' },
];

describe('UsdaReferenceBuilder', () => {
  it('keeps only accepted data types', () => {
    const b = builder();
    expect(b.addFood({ fdc_id: '1', data_type: 'sr_legacy_food', description: 'Apple' })).toBe(
      true,
    );
    expect(b.addFood({ fdc_id: '2', data_type: 'branded_food', description: 'Oreo' })).toBe(false);
  });

  it('builds a food with its four figures per 100 g and its data version', () => {
    const b = builder();
    b.addFood({
      fdc_id: '170112',
      data_type: 'sr_legacy_food',
      description: 'Potatoes, baked, flesh, with salt',
    });
    for (const row of FULL_NUTRIENTS) b.addNutrient(row);
    const { foods, skipped } = b.finish();

    expect(skipped).toEqual({});
    expect(foods).toEqual([
      {
        fdc_id: 170112,
        description: 'Potatoes, baked, flesh, with salt',
        data_type: 'SR Legacy',
        brand_owner: null,
        gtin_upc: null,
        calories_per_100g: 93,
        protein_g_per_100g: 1.96,
        carbs_g_per_100g: 21.55,
        fat_g_per_100g: 0.1,
        data_version: 'SR Legacy 2018-04',
      },
    ]);
  });

  it('skips a food missing a macro, counting it, rather than filling in a zero', () => {
    const b = builder();
    b.addFood({ fdc_id: '1', data_type: 'foundation_food', description: 'Thing' });
    b.addNutrient({ fdc_id: '1', nutrient_id: '1008', amount: '50' });
    const { foods, skipped } = b.finish();

    expect(foods).toEqual([]);
    expect(skipped).toEqual({ missing_nutrient: 1 });
  });

  it('skips a food with a negative figure, counting it, rather than clamping it to zero', () => {
    const b = builder();
    b.addFood({ fdc_id: '1', data_type: 'foundation_food', description: 'Thing' });
    b.addNutrient({ fdc_id: '1', nutrient_id: '1008', amount: '50' });
    b.addNutrient({ fdc_id: '1', nutrient_id: '1003', amount: '2' });
    b.addNutrient({ fdc_id: '1', nutrient_id: '1004', amount: '1' });
    b.addNutrient({ fdc_id: '1', nutrient_id: '1005', amount: '-0.2' });
    const { foods, skipped } = b.finish();

    expect(foods).toEqual([]);
    expect(skipped).toEqual({ negative_nutrient: 1 });
  });

  it('uses Atwater energy when the standard energy value is absent', () => {
    const b = builder();
    b.addFood({ fdc_id: '1', data_type: 'foundation_food', description: 'Thing' });
    b.addNutrient({ fdc_id: '1', nutrient_id: '2047', amount: '120' });
    b.addNutrient({ fdc_id: '1', nutrient_id: '1003', amount: '2' });
    b.addNutrient({ fdc_id: '1', nutrient_id: '1004', amount: '3' });
    b.addNutrient({ fdc_id: '1', nutrient_id: '1005', amount: '20' });

    expect(b.finish().foods[0]?.calories_per_100g).toBe(120);
  });

  it('prefers the standard energy value over the Atwater variant when both exist', () => {
    const b = builder();
    b.addFood({ fdc_id: '1', data_type: 'foundation_food', description: 'Thing' });
    b.addNutrient({ fdc_id: '1', nutrient_id: '2047', amount: '999' });
    b.addNutrient({ fdc_id: '1', nutrient_id: '1008', amount: '100' });
    for (const id of ['1003', '1004', '1005'])
      b.addNutrient({ fdc_id: '1', nutrient_id: id, amount: '1' });

    expect(b.finish().foods[0]?.calories_per_100g).toBe(100);
  });

  it("reads a portion's household name from the modifier when the measure is undetermined", () => {
    const b = builder();
    b.addFood({ fdc_id: '170112', data_type: 'sr_legacy_food', description: 'Potatoes' });
    for (const row of FULL_NUTRIENTS) b.addNutrient(row);
    b.addPortion({
      fdc_id: '170112',
      amount: '0.5',
      gram_weight: '61',
      measure_unit_id: '9999',
      portion_description: '',
      modifier: 'cup',
    });
    const { measures } = b.finish();

    expect(measures).toEqual([{ fdc_id: 170112, seq: 1, unit: 'cup', amount: 0.5, grams: 61 }]);
  });

  it('reads a real measure name first, as Foundation records carry one', () => {
    const b = builder();
    b.addFood({ fdc_id: '319875', data_type: 'foundation_food', description: 'Egg' });
    for (const row of FULL_NUTRIENTS.map((r) => ({ ...r, fdc_id: '319875' }))) b.addNutrient(row);
    b.addPortion({
      fdc_id: '319875',
      amount: '2',
      gram_weight: '35.8',
      measure_unit_id: '1001',
      portion_description: '',
      modifier: 'whole',
    });
    const { measures } = b.finish();

    expect(measures[0]).toMatchObject({ unit: 'egg', amount: 2, grams: 35.8 });
  });

  it('drops a portion with no gram weight or no usable name, rather than guessing', () => {
    const b = builder();
    b.addFood({ fdc_id: '170112', data_type: 'sr_legacy_food', description: 'Potatoes' });
    for (const row of FULL_NUTRIENTS) b.addNutrient(row);
    b.addPortion({
      fdc_id: '170112',
      amount: '1',
      gram_weight: '',
      measure_unit_id: '9999',
      portion_description: '',
      modifier: 'cup',
    });
    b.addPortion({
      fdc_id: '170112',
      amount: '1',
      gram_weight: '50',
      measure_unit_id: '9999',
      portion_description: '',
      modifier: '',
    });

    expect(b.finish().measures).toEqual([]);
  });

  it('ignores nutrients and portions for foods it did not register', () => {
    const b = builder();
    b.addNutrient({ fdc_id: '999', nutrient_id: '1008', amount: '1' });
    b.addPortion({
      fdc_id: '999',
      amount: '1',
      gram_weight: '10',
      measure_unit_id: '9999',
      portion_description: '',
      modifier: 'cup',
    });

    expect(b.finish()).toEqual({ foods: [], measures: [], skipped: {} });
  });
});
