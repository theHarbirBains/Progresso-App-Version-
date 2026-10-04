// Turns USDA FoodData Central bulk CSV rows into reference rows (usda_food_reference and
// usda_food_measure). Pure: the CLI streams the files from disk into this, and writes what
// comes out. Streaming keeps the 36 MB nutrient file out of memory.
//
// Only foods with all four Progresso figures (energy, protein, fat, carbohydrate) are kept.
// A food missing any of them is skipped and counted, never filled with a zero.

/** The FoodData Central data types this importer accepts now, mapped to the stored names. */
export const ACCEPTED_DATA_TYPES: Record<string, 'Foundation' | 'SR Legacy'> = {
  foundation_food: 'Foundation',
  sr_legacy_food: 'SR Legacy',
};

/**
 * Energy nutrient IDs in order of preference. 1008 is the standard energy value. 2047 and
 * 2048 are the Atwater factor variants that Foundation records use when 1008 is absent.
 */
export const ENERGY_NUTRIENT_IDS = [1008, 2047, 2048] as const;
export const PROTEIN_NUTRIENT_ID = 1003;
export const FAT_NUTRIENT_ID = 1004;
export const CARBS_NUTRIENT_ID = 1005;

export interface ReferenceFoodRow {
  fdc_id: number;
  description: string;
  data_type: 'Foundation' | 'SR Legacy';
  brand_owner: null;
  gtin_upc: null;
  calories_per_100g: number;
  protein_g_per_100g: number;
  carbs_g_per_100g: number;
  fat_g_per_100g: number;
  data_version: string;
}

export interface ReferenceMeasureRow {
  fdc_id: number;
  seq: number;
  unit: string;
  amount: number;
  grams: number;
}

export interface ReferenceOutput {
  foods: ReferenceFoodRow[];
  measures: ReferenceMeasureRow[];
  skipped: Record<string, number>;
}

interface PendingFood {
  description: string;
  dataType: 'Foundation' | 'SR Legacy';
  nutrients: Map<number, number>;
  portions: ReferenceMeasureRow[];
}

/** Parses one CSV line. Handles quoted fields and doubled quotes. Multi-line fields are rejected. */
export function parseCsvLine(line: string): string[] {
  const fields: string[] = [];
  let current = '';
  let quoted = false;
  for (let i = 0; i < line.length; i += 1) {
    const ch = line[i]!;
    if (quoted) {
      if (ch === '"') {
        if (line[i + 1] === '"') {
          current += '"';
          i += 1;
        } else {
          quoted = false;
        }
      } else {
        current += ch;
      }
    } else if (ch === '"') {
      quoted = true;
    } else if (ch === ',') {
      fields.push(current);
      current = '';
    } else {
      current += ch;
    }
  }
  if (quoted) throw new Error('Unterminated quoted field: multi-line CSV is not supported');
  fields.push(current);
  return fields;
}

/** Turns a header line and a data line into a keyed row. */
export function csvRecord(header: string[], line: string): Record<string, string> {
  const values = parseCsvLine(line);
  const record: Record<string, string> = {};
  header.forEach((name, index) => {
    record[name] = values[index] ?? '';
  });
  return record;
}

/** The release date from a folder name such as FoodData_Central_foundation_food_csv_2026-04-30. */
export function releaseLabelFrom(dir: string): string {
  const name = dir.split(/[\\/]/).filter(Boolean).pop() ?? dir;
  const match = name.match(/(\d{4}-\d{2}(?:-\d{2})?)/);
  return match ? match[1]! : name;
}

function finiteOrNull(value: string): number | null {
  if (value.trim() === '') return null;
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : null;
}

/**
 * Builds reference rows from streamed USDA rows. Call addFood for every food.csv row, then
 * addNutrient and addPortion for the matching nutrient and portion rows, then finish().
 */
export class UsdaReferenceBuilder {
  private readonly foods = new Map<number, PendingFood>();
  private readonly skipped: Record<string, number> = {};

  constructor(
    private readonly releaseLabel: string,
    /** measure_unit.csv: id to name. */
    private readonly measureUnitNames: Map<string, string>,
  ) {}

  /** Registers a food from food.csv if its data type is accepted. Returns whether it was kept. */
  addFood(row: { fdc_id: string; data_type: string; description: string }): boolean {
    const dataType = ACCEPTED_DATA_TYPES[row.data_type];
    if (!dataType) return false;
    const fdcId = Number(row.fdc_id);
    if (!Number.isInteger(fdcId)) return false;
    this.foods.set(fdcId, {
      description: row.description.trim(),
      dataType,
      nutrients: new Map(),
      portions: [],
    });
    return true;
  }

  /** Records a nutrient amount for a registered food. Ignored for foods not registered. */
  addNutrient(row: { fdc_id: string; nutrient_id: string; amount: string }): void {
    const food = this.foods.get(Number(row.fdc_id));
    if (!food) return;
    const nutrientId = Number(row.nutrient_id);
    const amount = finiteOrNull(row.amount);
    if (amount === null) return;
    const isKnown =
      nutrientId === PROTEIN_NUTRIENT_ID ||
      nutrientId === FAT_NUTRIENT_ID ||
      nutrientId === CARBS_NUTRIENT_ID ||
      (ENERGY_NUTRIENT_IDS as readonly number[]).includes(nutrientId);
    if (isKnown && !food.nutrients.has(nutrientId)) food.nutrients.set(nutrientId, amount);
  }

  /**
   * Records a household measure for a registered food. The unit is the real measure name when
   * one exists, else the modifier (SR Legacy's household name), else the portion description.
   * A portion with no gram weight, or no name at all, is dropped rather than guessed.
   */
  addPortion(row: {
    fdc_id: string;
    amount: string;
    gram_weight: string;
    measure_unit_id: string;
    portion_description: string;
    modifier: string;
  }): void {
    const food = this.foods.get(Number(row.fdc_id));
    if (!food) return;
    const amount = finiteOrNull(row.amount);
    const grams = finiteOrNull(row.gram_weight);
    if (amount === null || grams === null || !(amount > 0) || !(grams > 0)) return;

    const measureName = (this.measureUnitNames.get(row.measure_unit_id) ?? '').trim();
    const unit = [
      measureName !== '' && measureName !== 'undetermined' ? measureName : '',
      row.modifier,
      row.portion_description,
    ]
      .map((value) => value.trim())
      .find((value) => value.length > 0);
    if (!unit) return;

    food.portions.push({
      fdc_id: Number(row.fdc_id),
      seq: food.portions.length + 1,
      unit,
      amount,
      grams,
    });
  }

  finish(): ReferenceOutput {
    const foods: ReferenceFoodRow[] = [];
    const measures: ReferenceMeasureRow[] = [];
    for (const [fdcId, food] of this.foods) {
      const energy = ENERGY_NUTRIENT_IDS.map((id) => food.nutrients.get(id)).find(
        (value): value is number => value !== undefined,
      );
      const protein = food.nutrients.get(PROTEIN_NUTRIENT_ID);
      const fat = food.nutrients.get(FAT_NUTRIENT_ID);
      const carbs = food.nutrients.get(CARBS_NUTRIENT_ID);
      if (
        energy === undefined ||
        protein === undefined ||
        fat === undefined ||
        carbs === undefined
      ) {
        this.skipped.missing_nutrient = (this.skipped.missing_nutrient ?? 0) + 1;
        continue;
      }
      // FoodData Central can carry small negative values where a figure was calculated by
      // difference. A negative amount of a nutrient is not a real figure, so the food is
      // skipped and counted rather than clamped to zero.
      if ([energy, protein, fat, carbs].some((value) => value < 0)) {
        this.skipped.negative_nutrient = (this.skipped.negative_nutrient ?? 0) + 1;
        continue;
      }
      foods.push({
        fdc_id: fdcId,
        description: food.description,
        data_type: food.dataType,
        brand_owner: null,
        gtin_upc: null,
        calories_per_100g: energy,
        protein_g_per_100g: protein,
        carbs_g_per_100g: carbs,
        fat_g_per_100g: fat,
        data_version: `${food.dataType} ${this.releaseLabel}`,
      });
      measures.push(...food.portions);
    }
    return { foods, measures, skipped: { ...this.skipped } };
  }
}
