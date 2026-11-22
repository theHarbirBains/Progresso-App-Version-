import { foodSourceText, nutritionReportDraft, photoCredit } from './foodSource';
import type { FoodProvenance } from './foodQueries';

const provenance = (overrides: Partial<FoodProvenance>): FoodProvenance => ({
  confidence: 'verified',
  sourceKind: null,
  sourceId: null,
  matchedName: null,
  dataVersion: null,
  retrievedAt: null,
  licence: null,
  attribution: null,
  assumptions: [],
  components: null,
  ...overrides,
});

describe('foodSourceText', () => {
  it('names where the figures came from, with the data version when recorded', () => {
    expect(
      foodSourceText({
        provenance: provenance({ sourceKind: 'usda_fdc', dataVersion: 'SR Legacy 2018-04' }),
      }),
    ).toBe('USDA FoodData Central (SR Legacy 2018-04)');
    expect(foodSourceText({ provider: 'usda_fdc' })).toBe('USDA FoodData Central');
    expect(foodSourceText({ provider: 'open_food_facts' })).toBe(
      'Open Food Facts, from the product label',
    );
    expect(
      foodSourceText({
        provenance: provenance({ confidence: 'user_entered', sourceKind: 'user_entered' }),
      }),
    ).toBe('Entered by you');
    expect(
      foodSourceText({
        provenance: provenance({ confidence: 'ai_estimate', sourceKind: 'ai_estimate' }),
      }),
    ).toBe('AI estimate, not verified');
    expect(foodSourceText({ provenance: provenance({ confidence: 'calculated' }) })).toBe(
      'Worked out from its ingredients',
    );
  });

  it("calls a built-in food Progresso's own, never USDA-verified, and says nothing when nothing is known", () => {
    expect(foodSourceText({ provider: null })).toBe("Progresso's built-in foods");
    expect(foodSourceText({})).toBeNull();
  });
});

describe('nutritionReportDraft', () => {
  it('fills in the food, its serving, the figures shown and their source', () => {
    const draft = nutritionReportDraft(
      {
        name: 'Egg White, Large',
        servingSize: 1,
        servingUnit: 'large',
        servingLabel: null,
        calories: 17,
        proteinG: 3.6,
        carbsG: 0.2,
        fatG: 0.1,
      },
      "Progresso's built-in foods",
    );
    expect(draft.title).toBe('Nutrition looks wrong: Egg White, Large');
    expect(draft.description).toContain('1 serving: 1 large');
    expect(draft.description).toContain('Shown: 17 cal, 3.6 g protein, 0.2 g carbs, 0.1 g fat');
    expect(draft.description).toContain("Source: Progresso's built-in foods");
  });

  it('keeps the title within what feedback takes', () => {
    const draft = nutritionReportDraft(
      {
        name: 'x'.repeat(200),
        servingSize: 1,
        servingUnit: 'g',
        calories: 1,
        proteinG: 0,
        carbsG: 0,
        fatG: 0,
      },
      null,
    );
    expect(draft.title.length).toBe(120);
  });
});

describe('photoCredit', () => {
  it("credits Open Food Facts' photo of a product whose figures come from elsewhere", () => {
    expect(photoCredit('https://images.openfoodfacts.org/images/products/004/400/front.jpg')).toBe(
      'Photo: Open Food Facts',
    );
    expect(photoCredit('https://example.com/openfoodfacts.org/x.jpg')).toBeNull();
    expect(photoCredit(null)).toBeNull();
  });
});
