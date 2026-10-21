// Daily calorie and macro targets: the arithmetic behind Nutrition Goals. Pure, no I/O. The recommendations are fixed and the same every time:
// - protein: 0.8 g per lb of body weight;
// - fat: 0.3 g per lb of body weight;
// - carbs: whatever calories are left after protein and fat, at 4 cal per gram.
// Every field is still the person's own to type: a recommendation only fills a field left blank.

/** Energy per gram, as nutrition labels count it. */
export const KCAL_PER_GRAM = { protein: 4, carbs: 4, fat: 9 } as const;

export const LB_PER_KG = 2.2046226218;

/** Grams per pound of body weight, every time. */
export const PROTEIN_G_PER_LB = 0.8;
export const FAT_G_PER_LB = 0.3;

/** Macros that come to within this many calories of the calorie target count as matching it. */
export const MATCH_TOLERANCE_KCAL = 5;

export interface MacroGuidance {
  /** Body weight in lb, to the nearest pound -- what the per-lb figures multiply. */
  weightLb: number;
  proteinG: number;
  fatG: number;
}

/** Protein (0.8 g/lb) and fat (0.3 g/lb) for this body weight, stored in kg. */
export function macroGuidance(weightKg: number): MacroGuidance {
  const lb = weightKg * LB_PER_KG;
  return {
    weightLb: Math.round(lb),
    proteinG: Math.round(lb * PROTEIN_G_PER_LB),
    fatG: Math.round(lb * FAT_G_PER_LB),
  };
}

/** The calories a day's macros come to: protein x 4 + carbs x 4 + fat x 9. */
export function caloriesFromMacros(proteinG: number, carbsG: number, fatG: number): number {
  return proteinG * KCAL_PER_GRAM.protein + carbsG * KCAL_PER_GRAM.carbs + fatG * KCAL_PER_GRAM.fat;
}

export type CarbResult =
  /** The calories left after protein and fat, as grams of carbs. */
  | { kind: 'carbs'; carbsG: number; remainingCalories: number }
  /** Protein and fat alone come to more than the calorie target. */
  | { kind: 'conflict'; proteinFatCalories: number; overBy: number };

/**
 * Carbohydrates = (calories - protein x 4 - fat x 9) / 4, to the nearest gram: 2,200 cal with
 * 160 g protein (640 cal) and 60 g fat (540 cal) leaves 1,020 cal, or 255 g. When protein and
 * fat already pass the calorie target, it says so rather than giving zero.
 */
export function carbsFor(calories: number, proteinG: number, fatG: number): CarbResult {
  const proteinFatCalories = proteinG * KCAL_PER_GRAM.protein + fatG * KCAL_PER_GRAM.fat;
  const remainingCalories = calories - proteinFatCalories;
  if (remainingCalories < 0) {
    return {
      kind: 'conflict',
      proteinFatCalories: Math.round(proteinFatCalories),
      overBy: Math.round(-remainingCalories),
    };
  }
  return {
    kind: 'carbs',
    carbsG: Math.round(remainingCalories / KCAL_PER_GRAM.carbs),
    remainingCalories: Math.round(remainingCalories),
  };
}

export interface TargetValues {
  calories: number | null;
  proteinG: number | null;
  carbsG: number | null;
  fatG: number | null;
}

/** What's typed into the four target fields; blank is ''. */
export interface TargetDraft {
  calories: string;
  proteinG: string;
  carbsG: string;
  fatG: string;
}

type TargetKey = keyof TargetDraft;

const LIMITS: Record<TargetKey, { max: number; whole: boolean }> = {
  calories: { max: 20000, whole: true },
  proteinG: { max: 1500, whole: false },
  carbsG: { max: 1500, whole: false },
  fatG: { max: 1500, whole: false },
};

const FIELD_ERRORS: Record<TargetKey, string> = {
  calories: 'Enter whole calories, above 0',
  proteinG: 'Enter grams above 0',
  carbsG: 'Enter grams above 0',
  fatG: 'Enter grams above 0',
};

/** One field as a number: blank is null, anything else not a positive number is 'invalid'. */
export function parseField(text: string, key: TargetKey): number | null | 'invalid' {
  const trimmed = text.trim();
  if (trimmed === '') return null;
  const value = Number(trimmed);
  const limit = LIMITS[key];
  if (!Number.isFinite(value) || value <= 0 || value > limit.max) return 'invalid';
  if (limit.whole && !Number.isInteger(value)) return 'invalid';
  return Math.round(value * 100) / 100;
}

export interface Recommended {
  /** 0.8 g per lb; null without a body weight. */
  proteinG: number | null;
  /** 0.3 g per lb; null without a body weight. */
  fatG: number | null;
  /** The calories left after protein and fat; null until calories, protein and fat are known. */
  carbsG: number | null;
}

export interface ParsedTargets {
  /** The targets to save: each field as typed, or what a blank one means. */
  values: TargetValues;
  /** The recommendation for each macro, whether or not it's typed over. */
  recommended: Recommended;
  /**
   * The carb recommendation in full -- the calories it comes from, or protein and fat past the
   * calories -- worked out from the protein and fat that will be saved.
   */
  carbs: CarbResult | null;
  errors: Partial<Record<TargetKey, string>>;
}

/**
 * The four fields as targets. Protein and fat are recommended from body weight; carbs from the
 * calories left after the protein and fat that will be saved (typed, or recommended). A typed
 * number always wins; a blank field is its recommendation, shown faded in it -- what's shown is
 * what's saved.
 */
export function parseTargets(draft: TargetDraft, weightKg: number | null): ParsedTargets {
  const errors: Partial<Record<TargetKey, string>> = {};
  const read = (key: TargetKey): number | null => {
    const parsed = parseField(draft[key], key);
    if (parsed === 'invalid') {
      errors[key] = FIELD_ERRORS[key];
      return null;
    }
    return parsed;
  };
  const fillBlank = (typed: number | null, recommendation: number | null) =>
    typed ?? recommendation;

  const guide = weightKg !== null ? macroGuidance(weightKg) : null;
  const calories = read('calories');
  const proteinG = fillBlank(read('proteinG'), guide?.proteinG ?? null);
  const fatG = fillBlank(read('fatG'), guide?.fatG ?? null);
  const carbs =
    calories !== null && proteinG !== null && fatG !== null
      ? carbsFor(calories, proteinG, fatG)
      : null;
  const recommendedCarbs = carbs?.kind === 'carbs' ? carbs.carbsG : null;

  return {
    values: { calories, proteinG, fatG, carbsG: fillBlank(read('carbsG'), recommendedCarbs) },
    recommended: {
      proteinG: guide?.proteinG ?? null,
      fatG: guide?.fatG ?? null,
      carbsG: recommendedCarbs,
    },
    carbs,
    errors,
  };
}

/** Whether these targets can be saved: every field a valid number or blank. */
export function canSaveTargets(parsed: ParsedTargets): boolean {
  return Object.keys(parsed.errors).length === 0;
}

/**
 * The calories the macros to be saved come to, against the calorie target -- null until all
 * four are known. `difference` is positive when the macros come to more.
 */
export function macroTotal(
  values: TargetValues,
): { total: number; difference: number; matches: boolean } | null {
  const { calories, proteinG, carbsG, fatG } = values;
  if (calories === null || proteinG === null || carbsG === null || fatG === null) return null;
  const total = Math.round(caloriesFromMacros(proteinG, carbsG, fatG));
  const difference = total - calories;
  return { total, difference, matches: Math.abs(difference) <= MATCH_TOLERANCE_KCAL };
}

function toText(value: number | null): string {
  return value === null ? '' : String(value);
}

/**
 * The fields for saved targets. A saved macro that is exactly its recommendation starts blank,
 * so it shows faded and keeps following the recommendation (a new weight or calorie target
 * moves it) until the person types their own.
 */
export function draftFromTargets(targets: TargetValues, weightKg: number | null): TargetDraft {
  const draft: TargetDraft = {
    calories: toText(targets.calories),
    proteinG: toText(targets.proteinG),
    carbsG: toText(targets.carbsG),
    fatG: toText(targets.fatG),
  };
  const guide = weightKg !== null ? macroGuidance(weightKg) : null;
  const carbs =
    targets.calories !== null && targets.proteinG !== null && targets.fatG !== null
      ? carbsFor(targets.calories, targets.proteinG, targets.fatG)
      : null;
  return {
    calories: draft.calories,
    proteinG: guide && targets.proteinG === guide.proteinG ? '' : draft.proteinG,
    fatG: guide && targets.fatG === guide.fatG ? '' : draft.fatG,
    carbsG: carbs?.kind === 'carbs' && targets.carbsG === carbs.carbsG ? '' : draft.carbsG,
  };
}
