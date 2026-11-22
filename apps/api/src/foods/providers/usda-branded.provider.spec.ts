import type { ConfigService } from '@nestjs/config';
import type { EnvironmentVariables } from '../../config/env.validation';
import {
  barcodeKey,
  labelCase,
  normalizeBrandedFood,
  UsdaBrandedProvider,
} from './usda-branded.provider';

// FoodData Central's own answer for Oreo's UPC (Branded, 2023-03-16), trimmed to what's read.
const oreo = {
  fdcId: 2500691,
  description: 'CHOCOLATE SANDWICH COOKIES, CHOCOLATE',
  brandOwner: 'Nabisco Biscuit Company',
  brandName: 'OREO',
  gtinUpc: '044000032029',
  servingSize: 34,
  servingSizeUnit: 'GRM',
  householdServingFullText: '3 cookies',
  publishedDate: '2023-03-16',
  foodNutrients: [
    { nutrientId: 1003, value: 2.94 },
    { nutrientId: 1004, value: 20.6 },
    { nutrientId: 1005, value: 73.5 },
    { nutrientId: 1008, value: 471 },
    { nutrientId: 1079, value: 2.9 },
    { nutrientId: 1087, value: 29 },
    { nutrientId: 1089, value: 4.12 },
    { nutrientId: 1092, value: 147 },
    { nutrientId: 1093, value: 382 },
    { nutrientId: 1110, value: 0 },
    { nutrientId: 1253, value: 0 },
    { nutrientId: 1258, value: 5.88 },
  ],
};

function provider(key: string) {
  const config = { get: jest.fn(() => key) } as unknown as ConfigService<
    EnvironmentVariables,
    true
  >;
  return new UsdaBrandedProvider(config);
}

describe('normalizeBrandedFood', () => {
  it("gives the label's serving and its figures, scaled back from USDA's per 100 g", () => {
    expect(normalizeBrandedFood(oreo, '0044000032029')).toEqual({
      provider: 'usda_fdc',
      providerFoodId: '2500691',
      barcode: '0044000032029',
      name: 'Chocolate Sandwich Cookies, Chocolate',
      brand: 'Oreo',
      imageUrl: null,
      servingSize: 34,
      servingUnit: 'g',
      servingLabel: '3 cookies (34 g)',
      calories: 160.14,
      proteinG: 1,
      carbsG: 24.99,
      fatG: 7,
      micronutrients: {
        fibre: 0.986,
        calcium: 9.86,
        iron: 1.4008,
        potassium: 49.98,
        sodium: 129.88,
        vitamin_d: 0,
        cholesterol: 0,
        saturated_fat: 1.9992,
      },
    });
  });

  it("reads vitamin D in IU as mcg, and a drink's serving in ml", () => {
    const juice = normalizeBrandedFood(
      {
        ...oreo,
        servingSize: 240,
        servingSizeUnit: 'MLT',
        householdServingFullText: '1 cup',
        foodNutrients: [
          { nutrientId: 1008, value: 46 },
          { nutrientId: 1110, value: 42 },
        ],
      },
      '1',
    );
    expect(juice).toMatchObject({
      servingUnit: 'ml',
      servingLabel: '1 cup (240 ml)',
      calories: 110.4,
    });
    // 42 IU per 100 ml is 1.05 mcg; 240 ml, 2.52 mcg.
    expect(juice?.micronutrients).toEqual({ vitamin_d: 2.52 });
  });

  it('leaves a figure the label data lacks unknown, and drops a food with no energy', () => {
    const food = normalizeBrandedFood(
      { ...oreo, foodNutrients: [{ nutrientId: 1008, value: 100 }] },
      '1',
    );
    expect(food).toMatchObject({ proteinG: null, carbsG: null, fatG: null, micronutrients: null });
    expect(normalizeBrandedFood({ ...oreo, foodNutrients: [] }, '1')).toBeNull();
  });
});

describe('barcodeKey and labelCase', () => {
  it('matches UPC-A, EAN-13 and GTIN-14 forms of one code', () => {
    expect(barcodeKey('044000032029')).toBe(barcodeKey('0044000032029'));
    expect(barcodeKey('00044000032029')).toBe('44000032029');
  });

  it('turns capitals into title case, leaving mixed case as it is', () => {
    expect(labelCase('PEANUT BUTTER & JELLY (SMOOTH)')).toBe('Peanut Butter & Jelly (Smooth)');
    expect(labelCase('Kraft Dinner')).toBe('Kraft Dinner');
  });
});

describe('UsdaBrandedProvider', () => {
  afterEach(() => {
    jest.restoreAllMocks();
  });

  it('looks a barcode up with its key in a header, keeping only that very barcode, the newest label first', async () => {
    const fetchMock = jest.spyOn(global, 'fetch').mockResolvedValue({
      ok: true,
      json: async () => ({
        foods: [
          { ...oreo, fdcId: 1, gtinUpc: '999', description: 'OTHER' },
          { ...oreo, fdcId: 2, publishedDate: '2021-01-01' },
          { ...oreo, fdcId: 3, publishedDate: '2024-05-01' },
        ],
      }),
    } as Response);

    const food = await provider('key-1').getFoodByBarcode('0044000032029');

    expect(food?.providerFoodId).toBe('3');
    const [url, init] = fetchMock.mock.calls[0]!;
    expect(String(url)).toContain('dataType=Branded');
    expect(String(url)).not.toContain('key-1');
    expect((init?.headers as Record<string, string>)['X-Api-Key']).toBe('key-1');
  });

  it('looks nothing up without a key, and never throws', async () => {
    const fetchMock = jest.spyOn(global, 'fetch');
    expect(provider('').enabled).toBe(false);
    expect(await provider('').getFoodByBarcode('044000032029')).toBeNull();
    expect(fetchMock).not.toHaveBeenCalled();

    fetchMock.mockRejectedValue(new Error('offline'));
    expect(await provider('key-1').getFoodByBarcode('044000032029')).toBeNull();
  });
});
