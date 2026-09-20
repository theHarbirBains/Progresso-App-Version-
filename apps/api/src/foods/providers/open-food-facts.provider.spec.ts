import { OpenFoodFactsProvider } from './open-food-facts.provider';

function mockFetchOnce(body: unknown, ok = true, status = 200) {
  (global.fetch as jest.Mock).mockResolvedValueOnce({
    ok,
    status,
    json: () => Promise.resolve(body),
  });
}

describe('OpenFoodFactsProvider', () => {
  let provider: OpenFoodFactsProvider;

  beforeEach(() => {
    provider = new OpenFoodFactsProvider();
    global.fetch = jest.fn();
  });

  describe('searchFoods', () => {
    it('normalizes a real branded product using its own per-serving nutrient data', async () => {
      mockFetchOnce({
        count: 1,
        products: [
          {
            code: '0066721016123',
            product_name: 'Oreo Original',
            brands: 'Oreo,Mondelez International',
            serving_quantity: '34',
            serving_size: '3 cookies (34 g)',
            nutriments: {
              'energy-kcal_serving': 160,
              'energy-kcal_100g': 471,
              proteins_serving: 1.6,
              proteins_100g: 4.7,
              carbohydrates_serving: 25,
              carbohydrates_100g: 74,
              fat_serving: 7,
              fat_100g: 20.5,
            },
          },
        ],
      });

      const result = await provider.searchFoods('oreo', 0, 20);

      expect(result.foods).toEqual([
        {
          provider: 'open_food_facts',
          providerFoodId: '0066721016123',
          barcode: '0066721016123',
          name: 'Oreo Original',
          brand: 'Oreo',
          imageUrl: null,
          servingSize: 34,
          servingUnit: 'g',
          calories: 160,
          proteinG: 1.6,
          carbsG: 25,
          fatG: 7,
        },
      ]);
    });

    it("captures the product's image_front_url when Open Food Facts provides one", async () => {
      mockFetchOnce({
        count: 1,
        products: [
          {
            code: '0066721016123',
            product_name: 'Oreo Original',
            image_front_url: 'https://images.openfoodfacts.org/oreo-front.jpg',
            nutriments: { 'energy-kcal_100g': 471 },
          },
        ],
      });

      const result = await provider.searchFoods('oreo', 0, 20);

      expect(result.foods[0]!.imageUrl).toBe('https://images.openfoodfacts.org/oreo-front.jpg');
    });

    it('uses null imageUrl (never a placeholder) when the product has no photo', async () => {
      mockFetchOnce({
        count: 1,
        products: [
          { code: '555', product_name: 'No Photo', nutriments: { 'energy-kcal_100g': 100 } },
        ],
      });

      const result = await provider.searchFoods('x', 0, 20);

      expect(result.foods[0]!.imageUrl).toBeNull();
    });

    it('falls back to a 100g basis (not a fabricated serving) when the product has no serving_quantity', async () => {
      mockFetchOnce({
        count: 1,
        products: [
          {
            code: '1234567890123',
            product_name: 'Generic Branded Rice',
            brands: 'SomeBrand',
            nutriments: {
              'energy-kcal_100g': 130,
              proteins_100g: 2.7,
              carbohydrates_100g: 28,
              fat_100g: 0.3,
            },
          },
        ],
      });

      const result = await provider.searchFoods('rice', 0, 20);

      expect(result.foods[0]!.servingSize).toBe(100);
      expect(result.foods[0]!.servingUnit).toBe('g');
      expect(result.foods[0]!.calories).toBe(130);
    });

    it('scales missing per-serving fields from the 100g figure using the real serving_quantity, rather than inventing a value', async () => {
      mockFetchOnce({
        count: 1,
        products: [
          {
            code: '9999999999999',
            product_name: 'Test Product',
            serving_quantity: '50',
            nutriments: {
              // No _serving fields at all -- only _100g.
              'energy-kcal_100g': 200,
              proteins_100g: 10,
              carbohydrates_100g: 20,
              fat_100g: 5,
            },
          },
        ],
      });

      const result = await provider.searchFoods('test', 0, 20);

      // 50g is half of 100g, so every value should be halved.
      expect(result.foods[0]!).toMatchObject({
        servingSize: 50,
        calories: 100,
        proteinG: 5,
        carbsG: 10,
        fatG: 2.5,
      });
    });

    it('drops a product with no name (unusable as a search result)', async () => {
      mockFetchOnce({
        count: 1,
        products: [{ code: '111', nutriments: { 'energy-kcal_100g': 100 } }],
      });

      const result = await provider.searchFoods('x', 0, 20);

      expect(result.foods).toEqual([]);
    });

    it('drops a product with no barcode/id', async () => {
      mockFetchOnce({
        count: 1,
        products: [{ product_name: 'No Barcode', nutriments: { 'energy-kcal_100g': 100 } }],
      });

      const result = await provider.searchFoods('x', 0, 20);

      expect(result.foods).toEqual([]);
    });

    it('drops a product with no calorie figure at all, rather than fabricating one', async () => {
      mockFetchOnce({
        count: 1,
        products: [
          {
            code: '222',
            product_name: 'No Calories Known',
            nutriments: { proteins_100g: 5 },
          },
        ],
      });

      const result = await provider.searchFoods('x', 0, 20);

      expect(result.foods).toEqual([]);
    });

    it('preserves individually missing macros as null rather than inventing 0', async () => {
      mockFetchOnce({
        count: 1,
        products: [
          {
            code: '333',
            product_name: 'Partial Data Product',
            nutriments: { 'energy-kcal_100g': 250 }, // no protein/carbs/fat at all
          },
        ],
      });

      const result = await provider.searchFoods('x', 0, 20);

      expect(result.foods[0]!).toMatchObject({
        calories: 250,
        proteinG: null,
        carbsG: null,
        fatG: null,
      });
    });

    it('uses null brand when the product has none', async () => {
      mockFetchOnce({
        count: 1,
        products: [
          { code: '444', product_name: 'No Brand', nutriments: { 'energy-kcal_100g': 100 } },
        ],
      });

      const result = await provider.searchFoods('x', 0, 20);

      expect(result.foods[0]!.brand).toBeNull();
    });

    it('returns an empty, non-throwing result for an empty search (no products found)', async () => {
      mockFetchOnce({ count: 0, products: [] });

      const result = await provider.searchFoods('zzzznotarealfood', 0, 20);

      expect(result).toEqual({ foods: [], hasMore: false });
    });

    it('reports hasMore based on the total count vs. the current page window', async () => {
      mockFetchOnce({ count: 45, products: [] });

      const result = await provider.searchFoods('x', 0, 20);

      expect(result.hasMore).toBe(true);
    });

    it("converts the 0-indexed page convention to OFF's 1-indexed paging", async () => {
      mockFetchOnce({ count: 0, products: [] });

      await provider.searchFoods('x', 2, 20);

      const requestedUrl = (global.fetch as jest.Mock).mock.calls[0][0] as URL;
      expect(requestedUrl.searchParams.get('page')).toBe('3');
    });

    it('degrades to an empty result (not a thrown error) when the provider request fails on both the initial attempt and the retry', async () => {
      (global.fetch as jest.Mock)
        .mockResolvedValueOnce({ ok: false, status: 503 })
        .mockResolvedValueOnce({ ok: false, status: 503 });

      const result = await provider.searchFoods('x', 0, 20);

      expect(result).toEqual({ foods: [], hasMore: false });
      expect(global.fetch).toHaveBeenCalledTimes(2);
    });

    it('retries once on a 5xx and succeeds if the retry does -- verified against real, intermittent 503s from the live API while building this integration', async () => {
      (global.fetch as jest.Mock)
        .mockResolvedValueOnce({ ok: false, status: 503 })
        .mockResolvedValueOnce({
          ok: true,
          status: 200,
          json: () =>
            Promise.resolve({
              count: 1,
              products: [
                {
                  code: '1',
                  product_name: 'Retried Product',
                  nutriments: { 'energy-kcal_100g': 100 },
                },
              ],
            }),
        });

      const result = await provider.searchFoods('x', 0, 20);

      expect(global.fetch).toHaveBeenCalledTimes(2);
      expect(result.foods).toHaveLength(1);
      expect(result.foods[0]!.name).toBe('Retried Product');
    });

    it('does not retry a non-5xx failure (e.g. a 404) -- only likely-transient server errors', async () => {
      (global.fetch as jest.Mock).mockResolvedValueOnce({ ok: false, status: 404 });

      const result = await provider.searchFoods('x', 0, 20);

      expect(global.fetch).toHaveBeenCalledTimes(1);
      expect(result).toEqual({ foods: [], hasMore: false });
    });

    it('degrades to an empty result when the network call itself throws', async () => {
      (global.fetch as jest.Mock).mockRejectedValueOnce(new Error('network down'));

      const result = await provider.searchFoods('x', 0, 20);

      expect(result).toEqual({ foods: [], hasMore: false });
    });
  });

  describe('getFoodByBarcode', () => {
    it('returns the normalized product for a known barcode', async () => {
      mockFetchOnce({
        status: 1,
        product: {
          code: '0066721016123',
          product_name: 'Oreo Original',
          brands: 'Oreo',
          serving_quantity: '34',
          nutriments: { 'energy-kcal_serving': 160 },
        },
      });

      const result = await provider.getFoodByBarcode('0066721016123');

      expect(result).toMatchObject({ name: 'Oreo Original', barcode: '0066721016123' });
    });

    it('returns null when the barcode is not found (status 0)', async () => {
      mockFetchOnce({ status: 0 });

      const result = await provider.getFoodByBarcode('0000000000000');

      expect(result).toBeNull();
    });

    it('returns null on a provider request failure (after the automatic retry also fails)', async () => {
      (global.fetch as jest.Mock)
        .mockResolvedValueOnce({ ok: false, status: 500 })
        .mockResolvedValueOnce({ ok: false, status: 500 });

      const result = await provider.getFoodByBarcode('123');

      expect(result).toBeNull();
    });
  });

  describe('getFood', () => {
    it('resolves by provider food id, which is the barcode for this provider', async () => {
      mockFetchOnce({
        status: 1,
        product: { code: '555', product_name: 'By Id', nutriments: { 'energy-kcal_100g': 100 } },
      });

      const result = await provider.getFood('555');

      expect(result).toMatchObject({ providerFoodId: '555' });
    });
  });
});
