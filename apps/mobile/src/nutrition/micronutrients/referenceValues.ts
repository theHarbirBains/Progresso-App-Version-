import { ageFromBirthday } from '../calorieEstimationInput';
import { DRI_FOOTNOTES, REFERENCE_VALUES } from './nutrientCatalog.generated';
import type { LifeStageGroup, NutrientDefinition, ReferenceRow } from './nutrientTypes';

// Which of Health Canada's reference values apply to a person -- the one place a recommendation is
// chosen (every screen asks here). Pure.
//
// Health Canada's tables set values by age, by the sex categories they use, and for pregnancy
// and breastfeeding. Height, weight and activity don't change them, so they aren't asked. With
// what's needed missing -- no birthday, or a sex the tables don't have and no choice made -- no
// value is chosen at all, rather than a guessed one.

/** The two sex categories Health Canada's tables use. */
export type ReferenceSex = 'male' | 'female';
export type LifeStage = 'pregnant' | 'breastfeeding';

/** What the person chose on the Micronutrients page (kept on the phone, referenceSettings.ts). */
export interface ReferenceChoices {
  /** Which table to use when their profile's gender isn't one the tables have. */
  sex?: ReferenceSex | null;
  lifeStage?: LifeStage | null;
}

export interface ReferencePerson {
  ageYears: number | null;
  sex: ReferenceSex | null;
  lifeStage: LifeStage | null;
}

/** What's still needed to choose values: a birthday (Edit Profile), or which table to use. */
export type MissingForReference = 'age' | 'sex';

/** The person's reference details from their profile and their choices, and what's missing. */
export function referencePersonFor(
  profile: { birthday: string | null; gender: string | null } | null,
  choices: ReferenceChoices,
  now: Date = new Date(),
): { person: ReferencePerson; missing: MissingForReference[] } {
  const ageYears = profile?.birthday ? ageFromBirthday(profile.birthday, now) : null;
  const fromProfile =
    profile?.gender === 'male' || profile?.gender === 'female' ? profile.gender : null;
  const sex = fromProfile ?? choices.sex ?? null;
  const missing: MissingForReference[] = [];
  if (ageYears === null || ageYears < 0) missing.push('age');
  if (sex === null && (ageYears === null || ageYears >= 9)) missing.push('sex');
  return {
    person: {
      ageYears: ageYears !== null && ageYears >= 0 ? ageYears : null,
      sex,
      // Pregnancy and breastfeeding are only female categories in the tables.
      lifeStage: sex === 'female' ? (choices.lifeStage ?? null) : null,
    },
    missing,
  };
}

/** Whether pregnancy and breastfeeding values exist at this age (the tables: up to 50). */
export function lifeStageApplies(person: ReferencePerson): boolean {
  return (
    person.sex === 'female' &&
    person.ageYears !== null &&
    person.ageYears >= 14 &&
    person.ageYears <= 50
  );
}

const covers = (row: ReferenceRow, months: number) =>
  months >= row.ageMinMonths && (row.ageMaxMonths === null || months < row.ageMaxMonths);

/** The table group a person's values come from: their life stage, or their sex, or a child's. */
function groupsFor(person: ReferencePerson): LifeStageGroup[] {
  if (person.ageYears === null) return [];
  if (person.ageYears < 1) return ['infants'];
  if (person.ageYears < 9) return ['children'];
  if (person.sex === null) return [];
  const bySex: LifeStageGroup = person.sex === 'male' ? 'males' : 'females';
  // Pregnant or breastfeeding, those values first; past their ages, the usual ones.
  if (person.lifeStage === 'pregnant') return ['pregnancy', bySex];
  if (person.lifeStage === 'breastfeeding') return ['lactation', bySex];
  return [bySex];
}

/** The reference values that apply to the person for one nutrient; null when none can be chosen. */
export function referenceRowFor(nutrientId: string, person: ReferencePerson): ReferenceRow | null {
  const rows = REFERENCE_VALUES[nutrientId];
  if (!rows || person.ageYears === null) return null;
  const months = person.ageYears * 12;
  for (const group of groupsFor(person)) {
    const row = rows.find((r) => r.group === group && covers(r, months));
    if (row) return row;
  }
  return null;
}

/**
 * Who the person's values are for, as the tables group them ("Females 31–50"): every nutrient's
 * values share the same life-stage groups, so any one with a value for them says it.
 */
export function referenceGroupLabel(person: ReferencePerson): string | null {
  const row = referenceRowFor('vitamin_c', person);
  return row ? lifeStageLabel(row) : null;
}

const GROUP_NAMES: Record<LifeStageGroup, string> = {
  infants: 'Infants',
  children: 'Children',
  males: 'Males',
  females: 'Females',
  pregnancy: 'Pregnancy',
  lactation: 'Breastfeeding',
};

/** "Females 19–30", "Pregnancy, 19–30", "Breastfeeding, ≤18": who the values are for. */
export function lifeStageLabel(row: ReferenceRow): string {
  const ages = row.ageLabel.replace(/ (y|mo)$/, (_, unit: string) =>
    unit === 'mo' ? ' months' : '',
  );
  const name = GROUP_NAMES[row.group];
  return row.group === 'pregnancy' || row.group === 'lactation'
    ? `${name}, ${ages}`
    : `${name} ${ages}`;
}

/** What a reference value is called: "Recommended Dietary Allowance" or "Adequate Intake". */
export function referenceTypeName(type: 'RDA' | 'AI'): string {
  return type === 'RDA' ? 'Recommended Dietary Allowance' : 'Adequate Intake';
}

/** Health Canada's notes, word for word, for these keys -- unknown keys left out. */
export function notesFor(keys: readonly string[]): string[] {
  return [...new Set(keys)]
    .map((key) => DRI_FOOTNOTES[key])
    .filter((text): text is string => !!text);
}

/** The notes that qualify a nutrient's recommendation for this life stage. */
export function valueNotes(nutrient: NutrientDefinition, row: ReferenceRow | null): string[] {
  return notesFor([
    ...nutrient.footnotes.nutrient,
    ...nutrient.footnotes.value,
    ...(row?.notes ?? []),
  ]);
}

/** The notes on its upper limit: what it covers, or why there's none. */
export function upperLimitNotes(nutrient: NutrientDefinition): string[] {
  return notesFor(nutrient.footnotes.ul);
}
