import type { SupabaseService } from '../../supabase/supabase.service';
import { CatalogNutritionSource } from './catalog.source';

function catalogWith(rows: Record<string, unknown>[]) {
  const builder: Record<string, unknown> = {};
  for (const method of ['select', 'is', 'eq', 'ilike', 'limit']) {
    builder[method] = jest.fn(() => builder);
  }
  builder.then = (resolve: (value: unknown) => unknown) => resolve({ data: rows, error: null });
  return { getClient: () => ({ from: () => builder }) } as unknown as SupabaseService;
}

const row = {
  id: 'food-1',
  name: 'Onions, raw',
  brand: null,
  barcode: null,
  serving_size: '100.00',
  serving_unit: 'g',
  calories: '40.00',
  protein_g: '1.10',
  carbs_g: '9.34',
  fat_g: '0.10',
  provider: null,
};

describe('CatalogNutritionSource', () => {
  it("leaves a USDA reference food Search Food cached to the USDA source, so it keeps USDA's provenance", async () => {
    const source = new CatalogNutritionSource(
      catalogWith([
        { ...row, id: 'cached-usda', provider: 'usda_fdc' },
        { ...row, id: 'product', name: 'Diced White Onions', provider: 'open_food_facts' },
        { ...row, id: 'builtin', name: 'Onion' },
      ]),
    );

    const found = await source.search({
      term: 'onion',
      brand: null,
      barcode: null,
      restaurant: null,
    });

    expect(found.map((candidate) => candidate.sourceId)).toEqual(['product', 'builtin']);
  });
});
