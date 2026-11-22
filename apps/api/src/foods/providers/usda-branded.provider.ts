import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import type { EnvironmentVariables } from '../../config/env.validation';
import { micronutrientsPer100g } from '../../nutrition-resolution/usda-fdc.import';
import type { NormalizedFood } from '../food-provider.interface';

// USDA FoodData Central's Branded Foods, looked up by a scanned barcode (explicitly requested):
// manufacturers' own label data, supplied to USDA -- checked before Open Food Facts' crowd-sourced
// entries, which stay the fallback (Canadian-only products often aren't in USDA's). Read through
// FoodData Central's API with an api.data.gov key (USDA_FDC_API_KEY); with none set, every lookup
// is simply "not found" and scans work as they did. The data is in the public domain.

const SEARCH_URL = 'https://api.nal.usda.gov/fdc/v1/foods/search';
const REQUEST_TIMEOUT_MS = 6000;
const MAX_SERVING_LABEL_LENGTH = 80;
// A label's energy in kilojoules, as kilocalories.
const KJ_PER_KCAL = 4.184;
// Vitamin D in international units, as micrograms: 40 IU is 1 mcg, by definition.
const VITAMIN_D_IU_PER_MCG = 40;

// FoodData Central's nutrient ids (nutrient.csv).
const ENERGY_KCAL = 1008;
const ENERGY_KJ = 1062;
const PROTEIN = 1003;
const FAT = 1004;
const CARBS = 1005;
const VITAMIN_D_MCG = 1114;
const VITAMIN_D_IU = 1110;

interface FdcNutrient {
  nutrientId?: number;
  value?: number;
}

interface FdcBrandedFood {
  fdcId?: number;
  description?: string;
  brandName?: string;
  brandOwner?: string;
  gtinUpc?: string;
  servingSize?: number;
  servingSizeUnit?: string;
  householdServingFullText?: string;
  publishedDate?: string;
  foodNutrients?: FdcNutrient[];
}

/** A barcode's digits without its leading zeros: UPC-A, EAN-13 and GTIN-14 forms of one code match. */
export function barcodeKey(code: string): string {
  return code.replace(/\D/g, '').replace(/^0+/, '');
}

/** "CHOCOLATE SANDWICH COOKIES" -> "Chocolate Sandwich Cookies": Branded names come in capitals. */
export function labelCase(text: string): string {
  if (text !== text.toUpperCase()) return text.trim();
  return text
    .toLowerCase()
    .replace(
      /(^|[\s(/&-])([a-z])/g,
      (_, before: string, letter: string) => before + letter.toUpperCase(),
    )
    .trim();
}

const round = (value: number, places: number) => Math.round(value * 10 ** places) / 10 ** places;

/**
 * A Branded food as Progresso's own shape, for its label serving: FoodData Central keeps a
 * Branded food's nutrients per 100 g (or ml), worked out from the label, so each is scaled back
 * to the serving the label gives. Null without an energy figure.
 */
export function normalizeBrandedFood(food: FdcBrandedFood, barcode: string): NormalizedFood | null {
  if (!food.fdcId || !food.description) return null;
  const per100 = new Map<number, number>();
  for (const nutrient of food.foodNutrients ?? []) {
    if (typeof nutrient.nutrientId === 'number' && Number.isFinite(nutrient.value)) {
      per100.set(nutrient.nutrientId, nutrient.value as number);
    }
  }
  const unit = food.servingSizeUnit?.trim().toLowerCase();
  const servingUnit = unit === 'mlt' || unit === 'ml' ? 'ml' : 'g';
  const labelled = typeof food.servingSize === 'number' && food.servingSize > 0;
  const servingSize = labelled ? (food.servingSize as number) : 100;
  const scale = servingSize / 100;
  const perServing = (id: number) => (per100.has(id) ? round(per100.get(id)! * scale, 2) : null);

  const kcal = per100.has(ENERGY_KCAL)
    ? per100.get(ENERGY_KCAL)!
    : per100.has(ENERGY_KJ)
      ? per100.get(ENERGY_KJ)! / KJ_PER_KCAL
      : null;
  if (kcal === null || kcal < 0) return null;

  // A US label gives vitamin D in IU: the same amount in mcg.
  if (!per100.has(VITAMIN_D_MCG) && per100.has(VITAMIN_D_IU)) {
    per100.set(VITAMIN_D_MCG, per100.get(VITAMIN_D_IU)! / VITAMIN_D_IU_PER_MCG);
  }
  const micros = micronutrientsPer100g(per100);
  const micronutrients = micros
    ? Object.fromEntries(
        Object.entries(micros).map(([id, amount]) => [id, round(amount * scale, 4)]),
      )
    : null;

  const household = food.householdServingFullText?.trim();
  const servingLabel =
    labelled && household
      ? `${household} (${round(servingSize, 1)} ${servingUnit})`.slice(0, MAX_SERVING_LABEL_LENGTH)
      : null;
  const brand = food.brandName?.trim() || food.brandOwner?.trim() || null;

  return {
    provider: 'usda_fdc',
    providerFoodId: String(food.fdcId),
    barcode,
    name: labelCase(food.description),
    brand: brand ? labelCase(brand) : null,
    imageUrl: null,
    servingSize,
    servingUnit,
    servingLabel,
    calories: round(kcal * scale, 2),
    proteinG: perServing(PROTEIN),
    carbsG: perServing(CARBS),
    fatG: perServing(FAT),
    micronutrients,
  };
}

/** USDA's Branded Foods, by barcode. Never throws: an outage or no key is "not found". */
@Injectable()
export class UsdaBrandedProvider {
  private readonly logger = new Logger(UsdaBrandedProvider.name);

  constructor(private readonly configService: ConfigService<EnvironmentVariables, true>) {}

  /** Whether a key is set, so lookups are made at all. */
  get enabled(): boolean {
    return Boolean(this.configService.get('USDA_FDC_API_KEY', { infer: true }));
  }

  /** The newest Branded food with this barcode, as Progresso's shape; null when there's none. */
  async getFoodByBarcode(barcode: string): Promise<NormalizedFood | null> {
    const apiKey = this.configService.get('USDA_FDC_API_KEY', { infer: true });
    const key = barcodeKey(barcode);
    if (!apiKey || !key) return null;
    const url = new URL(SEARCH_URL);
    url.searchParams.set('query', barcode.replace(/\D/g, ''));
    url.searchParams.set('dataType', 'Branded');
    url.searchParams.set('pageSize', '10');
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), REQUEST_TIMEOUT_MS);
    try {
      const response = await fetch(url, {
        headers: { 'X-Api-Key': apiKey },
        signal: controller.signal,
      });
      if (!response.ok) {
        this.logger.warn(`USDA FoodData Central lookup failed: ${response.status}`);
        return null;
      }
      const body = (await response.json()) as { foods?: FdcBrandedFood[] };
      // Only the very barcode -- the search matches words too -- and of several, the newest label.
      const match = (body.foods ?? [])
        .filter((food) => food.gtinUpc && barcodeKey(food.gtinUpc) === key)
        .sort((a, b) => (b.publishedDate ?? '').localeCompare(a.publishedDate ?? ''))[0];
      return match ? normalizeBrandedFood(match, barcode) : null;
    } catch (err) {
      this.logger.warn(
        `USDA FoodData Central lookup errored: ${err instanceof Error ? err.message : String(err)}`,
      );
      return null;
    } finally {
      clearTimeout(timeout);
    }
  }
}
