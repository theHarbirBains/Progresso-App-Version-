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
  /** A row's short word on it: "76%", "Avg 76%", "No data", "No target · as low as possible". */
  caption: string;
  /** The nutrient page's: what the percentage is of -- "76% of your recommendation" (an RDA) or
   * "76% of your adequate intake" (an AI) -- else the same as `caption`. */
  longCaption: string;
  /** How much of what was logged the figure is from, when not all of it: "3 of 5 foods". */
  coverage: string | null;
  percent: number | null;
  /** How full its bar is, 0-1 (never past full); none to draw without a reference. */
  fraction: number | null;
}

/** "Vitamin B1 (Thiamin)", "Vitamin C". */
export function displayName(nutrient: NutrientDefinition): string {
  return nutrient.altName ? `${nutrient.altName} (${nutrient.name})` : nutrient.name;
}

/** What its percentage is of, said in full: an RDA is a recommendation, an AI an adequate intake. */
function percentOf(percent: number, type: 'RDA' | 'AI' | null, week: boolean): string {
  const of = type === 'AI' ? 'your adequate intake' : 'your recommendation';
  return week ? `Averaging ${percent}% of ${of}` : `${percent}% of ${of}`;
}

/**
 * A text's first sentence and the rest, for a page that shows the first and the rest a tap away.
 * A sentence ends at ".", "!" or "?" followed by a space and a capital (or a quote or bracket).
 */
export function leadSentence(text: string): { lead: string; rest: string | null } {
  const match = /[.!?](?=\s+[A-Z“"(])/.exec(text);
  if (!match) return { lead: text.trim(), rest: null };
  const end = match.index + 1;
  const rest = text.slice(end).trim();
  return { lead: text.slice(0, end).trim(), rest: rest || null };
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
  let longCaption: string | null = null;
  if (nutrient.guidance) caption = 'No target · as low as possible';
  else if (target === null) caption = 'Add your details for a target';
  else if (amount === null) caption = noData;
  else {
    caption = week ? `Avg ${percent ?? 0}%` : `${percent ?? 0}%`;
    longCaption = percentOf(percent ?? 0, reference?.type ?? null, week);
  }

  return {
    nutrient,
    name: displayName(nutrient),
    reference,
    amount,
    figure,
    caption,
    longCaption: longCaption ?? caption,
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
    : `${intake.foodsWithData} of ${plural(intake.foodsLogged, 'food')}`;
  return line(nutrient, reference, known ? intake.amount : null, coverage, false, 'No data');
}

/** A nutrient's row for a week: its average over the days with data for it. */
export function weekLine(
  nutrient: NutrientDefinition,
  days: readonly Logs[],
  reference: ReferenceRow | null,
): NutrientLine {
  const week = weekIntake(days, nutrient.id as NutrientId);
  const partial = week.daysComplete < week.daysWithData;
  const coverage = `${plural(week.daysWithData, 'day')}${partial ? ' · some foods lack data' : ''}`;
  return line(nutrient, reference, week.average, coverage, true, 'No data');
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
