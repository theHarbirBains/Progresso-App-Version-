import { hasData, isComplete, nutrientIntake, progressOf, weekIntake } from './intake';
import { formatAmount, unitWithBasis, type NutrientAmounts, type NutrientId } from './nutrients';
import type { NutrientDefinition, ReferenceRow } from './nutrientTypes';

// What a nutrient's row says, for a day or for a week's average: its figures against its
// reference value, and how much of what was logged they're from. Pure.
//
// The wording keeps the rules the page lives by: a percentage is of a population reference,
// never a score -- 100% isn't a limit and more isn't a warning (the bar simply stops at full);
// a nutrient no food has data for says so rather than reading 0; and a total from only some of
// the foods says how many.

type Logs = readonly { micronutrients?: NutrientAmounts | null }[];

export interface NutrientLine {
  nutrient: NutrientDefinition;
  name: string;
  reference: ReferenceRow | null;
  /** The day's total or the week's average; null when nothing logged has data for it. */
  amount: number | null;
  /** "68 / 90 mg", "12 g", "No data". */
  figure: string;
  /** "76% of daily recommendation", "No daily target", ... */
  caption: string;
  /** How much of what was logged the figure is from, when not all of it: "From 3 of 5 foods". */
  coverage: string | null;
  percent: number | null;
  /** How full its bar is, 0-1 (never past full); none to draw without a reference. */
  fraction: number | null;
}

/** "Vitamin B1 (Thiamin)", "Vitamin C". */
export function displayName(nutrient: NutrientDefinition): string {
  return nutrient.altName ? `${nutrient.altName} (${nutrient.name})` : nutrient.name;
}

/** What its percentage is of: an RDA is a recommendation, an AI an adequate intake. */
function percentCaption(percent: number, type: 'RDA' | 'AI' | null, week: boolean): string {
  const of = type === 'AI' ? 'adequate intake' : 'daily recommendation';
  return week ? `Averaging ${percent}% of ${of}` : `${percent}% of ${of}`;
}

function line(
  nutrient: NutrientDefinition,
  reference: ReferenceRow | null,
  amount: number | null,
  coverage: string | null,
  week: boolean,
  noData: string,
): NutrientLine {
  const unit = unitWithBasis(nutrient);
  const target = reference?.value ?? null;
  const { percent, fraction } = progressOf(amount ?? 0, target);
  let figure: string;
  if (amount === null) figure = target === null ? 'No data' : `— / ${formatAmount(target)} ${unit}`;
  else
    figure =
      target === null
        ? `${formatAmount(amount)} ${unit}`
        : `${formatAmount(amount)} / ${formatAmount(target)} ${unit}`;

  let caption: string;
  if (nutrient.guidance) caption = 'No daily target — as low as possible';
  else if (target === null) caption = 'Add your details to see a recommendation';
  else if (amount === null) caption = noData;
  else caption = percentCaption(percent ?? 0, reference?.type ?? null, week);

  return {
    nutrient,
    name: displayName(nutrient),
    reference,
    amount,
    figure,
    caption,
    coverage: amount === null ? null : coverage,
    percent: amount === null || target === null ? null : percent,
    fraction: amount === null || target === null ? null : fraction,
  };
}

const plural = (n: number, word: string) => `${n} ${word}${n === 1 ? '' : 's'}`;

/** A nutrient's row for one day's logs (none logged: the page says so, not every row). */
export function dayLine(
  nutrient: NutrientDefinition,
  logs: Logs,
  reference: ReferenceRow | null,
): NutrientLine {
  const intake = nutrientIntake(logs, nutrient.id as NutrientId);
  const known = hasData(intake);
  const coverage = isComplete(intake)
    ? null
    : `From ${intake.foodsWithData} of ${plural(intake.foodsLogged, 'food')}`;
  return line(
    nutrient,
    reference,
    known ? intake.amount : null,
    coverage,
    false,
    `No data from the ${plural(intake.foodsLogged, 'food')} logged`,
  );
}

/** A nutrient's row for a week: its average over the days with data for it. */
export function weekLine(
  nutrient: NutrientDefinition,
  days: readonly Logs[],
  reference: ReferenceRow | null,
): NutrientLine {
  const week = weekIntake(days, nutrient.id as NutrientId);
  const partial = week.daysComplete < week.daysWithData;
  const coverage = `Over ${plural(week.daysWithData, 'day')}${partial ? ', some foods without data' : ''}`;
  return line(nutrient, reference, week.average, coverage, true, 'No data on the days logged');
}

/**
 * Whether a day's logged total is over an upper limit that covers food -- never one Health Canada
 * sets for supplements or one form only (ulOnlySupplements), which a food log can't be held to.
 */
export function overUpperLimit(
  nutrient: NutrientDefinition,
  reference: ReferenceRow | null,
  amount: number | null,
): boolean {
  return (
    !nutrient.ulOnlySupplements && reference?.ul != null && amount !== null && amount > reference.ul
  );
}
