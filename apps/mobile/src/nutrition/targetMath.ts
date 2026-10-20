// Daily calorie and macro targets: the arithmetic behind the suggestions on Nutrition Goals
// (and a phase's own targets). Pure, no I/O. Every number here is a suggestion the person can
// take, change or ignore -- nothing is ever saved or overwritten from it.

/** Energy per gram, as nutrition labels count it. */
export const KCAL_PER_GRAM = { protein: 4, carbs: 4, fat: 9 } as const;

const LB_PER_KG = 2.2046226218;

/**
 * Rough starting points for a calorie deficit, per pound of body weight: protein 0.7-0.8 g,
 * fat about 0.3 g. Guidelines, not requirements -- and they don't make a deficit on their own:
 * that comes from calories eaten against calories burned.
 */
export const PROTEIN_G_PER_LB = { low: 0.7, high: 0.8 } as const;
export const FAT_G_PER_LB = 0.3;

export interface MacroSuggestion {
  /** The protein range, in grams: 0.7-0.8 g per lb. */
  proteinLowG: number;
  proteinHighG: number;
  /** The middle of the range -- what "Use" fills in. */
  proteinG: number;
  fatG: number;
}

/** Protein and fat to start from, for this body weight (stored in kg). */
export function suggestMacros(weightKg: number): MacroSuggestion {
  const lb = weightKg * LB_PER_KG;
  const proteinLowG = Math.round(lb * PROTEIN_G_PER_LB.low);
  const proteinHighG = Math.round(lb * PROTEIN_G_PER_LB.high);
  return {
    proteinLowG,
    proteinHighG,
    proteinG: Math.round((proteinLowG + proteinHighG) / 2),
    fatG: Math.round(lb * FAT_G_PER_LB),
  };
}

/** The same guidelines per kilogram, for people who weigh in kg: 1.5-1.8 g protein, 0.7 g fat. */
export function perKgGuidelines(): { proteinLow: number; proteinHigh: number; fat: number } {
  const round1 = (value: number) => Math.round(value * 10) / 10;
  return {
    proteinLow: round1(PROTEIN_G_PER_LB.low * LB_PER_KG),
    proteinHigh: round1(PROTEIN_G_PER_LB.high * LB_PER_KG),
    fat: round1(FAT_G_PER_LB * LB_PER_KG),
  };
}

/** The calories a day's macros come to: protein x 4 + carbs x 4 + fat x 9. */
export function caloriesFromMacros(proteinG: number, carbsG: number, fatG: number): number {
  return proteinG * KCAL_PER_GRAM.protein + carbsG * KCAL_PER_GRAM.carbs + fatG * KCAL_PER_GRAM.fat;
}

export type CarbSuggestion =
  /** The calories left after protein and fat, as grams of carbs. */
  | { kind: 'carbs'; carbsG: number; remainingCalories: number }
  /** Protein and fat alone come to more than the calorie target. */
  | { kind: 'conflict'; proteinFatCalories: number; overBy: number };

/**
 * Carbohydrates = (calories - protein x 4 - fat x 9) / 4, to the nearest gram: 2,200 cal with
 * 160 g protein (640 cal) and 60 g fat (540 cal) leaves 1,020 cal, or 255 g. When protein and
 * fat already pass the calorie target, it says so rather than suggesting zero.
 */
export function suggestCarbs(calories: number, proteinG: number, fatG: number): CarbSuggestion {
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

/** Within this many calories, macros and a calorie target are taken to match (whole-gram rounding). */
export const MATCH_TOLERANCE_KCAL = 5;

/** How far the macros' calories are from the calorie target: positive is over, negative under. */
export function macroCalorieDifference(
  calories: number,
  proteinG: number,
  carbsG: number,
  fatG: number,
): number {
  return Math.round(caloriesFromMacros(proteinG, carbsG, fatG) - calories);
}

export interface TargetValues {
  calories: number | null;
  proteinG: number | null;
  carbsG: number | null;
  fatG: number | null;
}

/** What's typed into the four target fields. */
export interface TargetDraft {
  calories: string;
  proteinG: string;
  carbsG: string;
  fatG: string;
  /**
   * Whether carbs follow the calories left after protein and fat. True until the person types
   * their own carbs; then their number stays put, and a suggestion is only offered beside it.
   */
  carbsFollow: boolean;
}

const LIMITS = {
  calories: { max: 20000, whole: true },
  proteinG: { max: 1500, whole: false },
  carbsG: { max: 1500, whole: false },
  fatG: { max: 1500, whole: false },
} as const;

type TargetKey = keyof typeof LIMITS;

function parseField(text: string, key: TargetKey): number | null | 'invalid' {
  const trimmed = text.trim();
  if (trimmed === '') return null;
  const value = Number(trimmed);
  const limit = LIMITS[key];
  if (!Number.isFinite(value) || value <= 0 || value > limit.max) return 'invalid';
  if (limit.whole && !Number.isInteger(value)) return 'invalid';
  return Math.round(value * 100) / 100;
}

const FIELD_ERRORS: Record<TargetKey, string> = {
  calories: 'Enter whole calories, above 0',
  proteinG: 'Enter grams above 0, or leave it blank',
  carbsG: 'Enter grams above 0, or leave it blank',
  fatG: 'Enter grams above 0, or leave it blank',
};

/** The typed targets as numbers (blank is "no target"), with a message for any that isn't valid. */
export function parseTargets(draft: TargetDraft): {
  values: TargetValues;
  errors: Partial<Record<TargetKey, string>>;
} {
  const values: TargetValues = { calories: null, proteinG: null, carbsG: null, fatG: null };
  const errors: Partial<Record<TargetKey, string>> = {};
  for (const key of Object.keys(LIMITS) as TargetKey[]) {
    const parsed = parseField(draft[key], key);
    if (parsed === 'invalid') errors[key] = FIELD_ERRORS[key];
    else values[key] = parsed;
  }
  return { values, errors };
}

/** The carb suggestion the draft's own calories, protein and fat give, when they all parse. */
export function draftCarbSuggestion(draft: TargetDraft): CarbSuggestion | null {
  const { values } = parseTargets(draft);
  if (values.calories === null || values.proteinG === null || values.fatG === null) return null;
  return suggestCarbs(values.calories, values.proteinG, values.fatG);
}

/**
 * Applies a change to one field. Changing calories, protein or fat moves carbs along while they
 * follow; typing carbs stops them following, so the person's own number is never overwritten.
 */
export function editDraft(draft: TargetDraft, key: TargetKey, text: string): TargetDraft {
  if (key === 'carbsG') return { ...draft, carbsG: text, carbsFollow: false };
  const next = { ...draft, [key]: text };
  if (!next.carbsFollow) return next;
  const suggestion = draftCarbSuggestion(next);
  return suggestion?.kind === 'carbs' ? { ...next, carbsG: String(suggestion.carbsG) } : next;
}

/** Takes the suggested carbs, and has them follow from then on. */
export function takeSuggestedCarbs(draft: TargetDraft): TargetDraft {
  const suggestion = draftCarbSuggestion(draft);
  if (suggestion?.kind !== 'carbs') return draft;
  return { ...draft, carbsG: String(suggestion.carbsG), carbsFollow: true };
}

function toText(value: number | null): string {
  return value === null ? '' : String(value);
}

/**
 * The draft for saved targets. Carbs follow when the saved carbs are what the saved calories,
 * protein and fat give, or when there's nothing yet to work them out from (so they fill in as
 * the targets are first set). Otherwise they're the person's own -- including no carb target
 * at all -- and a suggestion is only offered beside them.
 */
export function draftFromTargets(targets: TargetValues): TargetDraft {
  const draft: TargetDraft = {
    calories: toText(targets.calories),
    proteinG: toText(targets.proteinG),
    carbsG: toText(targets.carbsG),
    fatG: toText(targets.fatG),
    carbsFollow: false,
  };
  const suggestion = draftCarbSuggestion(draft);
  if (targets.carbsG === null) return { ...draft, carbsFollow: suggestion === null };
  return {
    ...draft,
    carbsFollow: suggestion?.kind === 'carbs' && Math.abs(suggestion.carbsG - targets.carbsG) <= 1,
  };
}
