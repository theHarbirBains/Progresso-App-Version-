// Daily calorie and macro targets: the arithmetic behind Nutrition Goals (and a phase's own
// targets). Pure, no I/O. The guidance is fixed and the same every time:
// - protein: 0.8 g per lb of body weight;
// - fat: 0.3 g per lb of body weight;
// - carbs: whatever calories are left after protein and fat, at 4 cal per gram.
// Nothing is ever saved or overwritten from here: a screen offers these and the person chooses.

/** Energy per gram, as nutrition labels count it. */
export const KCAL_PER_GRAM = { protein: 4, carbs: 4, fat: 9 } as const;

export const LB_PER_KG = 2.2046226218;

/** Grams per pound of body weight, every time. */
export const PROTEIN_G_PER_LB = 0.8;
export const FAT_G_PER_LB = 0.3;

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

/** What's typed into the target fields. Carbs aren't typed: they're worked out. */
export interface TargetDraft {
  calories: string;
  proteinG: string;
  fatG: string;
}

const LIMITS = {
  calories: { max: 20000, whole: true },
  proteinG: { max: 1500, whole: false },
  fatG: { max: 1500, whole: false },
} as const;

type TargetKey = keyof typeof LIMITS;

const FIELD_ERRORS: Record<TargetKey, string> = {
  calories: 'Enter whole calories, above 0',
  proteinG: 'Enter grams above 0',
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

/**
 * The typed targets as numbers (blank is "no target"), carbs worked out from the rest when
 * calories, protein and fat are all there, and what's wrong with any of them -- including
 * protein and fat that pass the calories, which can't be saved until the person changes one.
 */
export function parseTargets(draft: TargetDraft): {
  values: TargetValues;
  carbs: CarbResult | null;
  errors: Partial<Record<TargetKey, string>>;
} {
  const errors: Partial<Record<TargetKey, string>> = {};
  const read = (key: TargetKey): number | null => {
    const parsed = parseField(draft[key], key);
    if (parsed === 'invalid') {
      errors[key] = FIELD_ERRORS[key];
      return null;
    }
    return parsed;
  };
  const calories = read('calories');
  const proteinG = read('proteinG');
  const fatG = read('fatG');
  const carbs =
    calories !== null && proteinG !== null && fatG !== null
      ? carbsFor(calories, proteinG, fatG)
      : null;
  return {
    values: {
      calories,
      proteinG,
      fatG,
      carbsG: carbs?.kind === 'carbs' ? carbs.carbsG : null,
    },
    carbs,
    errors,
  };
}

/** Whether these targets can be saved: every field valid, and protein and fat within calories. */
export function canSaveTargets(parsed: ReturnType<typeof parseTargets>): boolean {
  return Object.keys(parsed.errors).length === 0 && parsed.carbs?.kind !== 'conflict';
}

function toText(value: number | null): string {
  return value === null ? '' : String(value);
}

/** The draft for saved targets: their calories, protein and fat (carbs are worked out again). */
export function draftFromTargets(targets: TargetValues): TargetDraft {
  return {
    calories: toText(targets.calories),
    proteinG: toText(targets.proteinG),
    fatG: toText(targets.fatG),
  };
}
