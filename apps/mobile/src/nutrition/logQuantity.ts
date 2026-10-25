// The amount typed on the log step, and the servings it comes to -- what a log stores. Every
// food can be logged by weight: 250 g of a food whose serving is 100 g is 2.5 servings. A
// serving's weight is its own when it is one (g, kg, oz), else the one its wording states
// ("1 cup (240 g)"), else the one the person gives on the log step (LogFoodStep). A drink whose
// serving is a volume (ml, l) can be logged in millilitres. A food whose serving names its
// pieces ("3 cookies (34 g)", the provider's own wording) can also be logged in those pieces: 2
// cookies is 2/3 of a serving. A log keeps the amount as typed too
// (food_logs.entered_amount/entered_unit), so it's shown and edited that way afterwards.

/** What the log step's amount is typed in. */
export type QuantityUnit = 'servings' | 'pieces' | 'g' | 'oz' | 'ml';

const GRAMS_PER_OUNCE = 28.349523125;

// The serving units that are weights, in grams per unit.
const GRAMS_PER_SERVING_UNIT: Record<string, number> = {
  g: 1,
  kg: 1000,
  oz: GRAMS_PER_OUNCE,
};

/** What one serving weighs in grams, or null when the serving is not a weight (a cup, a slice). */
export function gramsPerServing(food: { servingSize: number; servingUnit: string }): number | null {
  const perUnit = GRAMS_PER_SERVING_UNIT[food.servingUnit.trim().toLowerCase()];
  return perUnit === undefined ? null : food.servingSize * perUnit;
}

// A weight in grams in a serving's own wording -- "1 cup (240 g)", "1 bar (40g)" -- never mg or kg.
const LABEL_GRAMS = /(?:^|[^a-z\d.,])(\d+(?:[.,]\d+)?)\s*(?:g|gr|grams?)(?![a-z])/;

/** The grams a serving's wording says it weighs, or null when it says none. */
export function labelGrams(label: string | null | undefined): number | null {
  const match = label?.trim().toLowerCase().match(LABEL_GRAMS);
  if (!match) return null;
  const grams = Number(match[1]!.replace(',', '.'));
  return grams > 0 ? grams : null;
}

/**
 * The grams one serving weighs, as an amount typed by weight shows it -- 250 g logged as 2.5
 * servings is 100 g a serving. Null for an amount typed any other way.
 */
export function entryServingGrams(
  entry: { amount: number; unit: QuantityUnit } | null | undefined,
  servings: number,
): number | null {
  if (!entry || !(entry.amount > 0) || !(servings > 0)) return null;
  if (entry.unit === 'g') return entry.amount / servings;
  if (entry.unit === 'oz') return (entry.amount * GRAMS_PER_OUNCE) / servings;
  return null;
}

// The serving units that are volumes, in millilitres per unit.
const ML_PER_SERVING_UNIT: Record<string, number> = { ml: 1, l: 1000 };

/** One serving's volume in millilitres, or null when the serving is not a volume. */
export function mlPerServing(food: { servingSize: number; servingUnit: string }): number | null {
  const perUnit = ML_PER_SERVING_UNIT[food.servingUnit.trim().toLowerCase()];
  return perUnit === undefined ? null : food.servingSize * perUnit;
}

/** The pieces one serving is made of, as the serving's own wording names them. */
export interface ServingPieces {
  /** How many make one serving: "3 cookies" is 3. */
  perServing: number;
  singular: string;
  plural: string;
}

// Words that name a weight, a volume or a serving itself -- never pieces.
const NOT_PIECES = new Set([
  'g',
  'gr',
  'gram',
  'grams',
  'mg',
  'kg',
  'ml',
  'cl',
  'dl',
  'l',
  'litre',
  'litres',
  'liter',
  'liters',
  'oz',
  'ounce',
  'ounces',
  'fl oz',
  'lb',
  'lbs',
  'kcal',
  'cal',
  'serving',
  'servings',
  'portion',
  'portions',
]);
const MAX_PIECES_PER_SERVING = 100;
const MAX_PIECE_NAME_LENGTH = 16;

// A count, then the piece: "3 cookies (34 g)", "1 package, 85 g", "3 cookies 34 g", "2 biscuits".
const LEADING_PIECES =
  /^(\d+(?:[.,]\d+)?|\d+\s*\/\s*\d+)\s*([a-zà-ÿ][a-zà-ÿ' -]*?)\s*(?:[(,]|(?=\d)|$)/;
// The same in brackets after the weight: "34 g (3 cookies)".
const BRACKETED_PIECES = /\(\s*(\d+(?:[.,]\d+)?|\d+\s*\/\s*\d+)\s*([a-zà-ÿ][a-zà-ÿ' -]*?)\s*\)/;

function parseCount(text: string): number {
  const fraction = text.split('/');
  if (fraction.length === 2) return Number(fraction[0]) / Number(fraction[1]);
  return Number(text.replace(',', '.'));
}

function pluralize(word: string): string {
  if (/s$/.test(word)) return word;
  if (/[^aeiou]y$/.test(word)) return `${word.slice(0, -1)}ies`;
  if (/(ch|sh|x|z)$/.test(word)) return `${word}es`;
  return `${word}s`;
}

// Plurals in -ies whose singular ends in -ie, not -y (unlike patties, berries).
const IE_PLURALS = new Set(['cookies', 'brownies', 'pies', 'smoothies', 'veggies']);

function singularize(word: string): string {
  if (IE_PLURALS.has(word)) return word.slice(0, -1);
  if (/[^aeiou]ies$/.test(word)) return `${word.slice(0, -3)}y`;
  if (/(ches|shes|xes|zes|sses)$/.test(word)) return word.slice(0, -2);
  if (/[^s]s$/.test(word)) return word.slice(0, -1);
  return word;
}

/** Changes the last word only: "sandwich cookie" -> "sandwich cookies". */
function onLastWord(name: string, change: (word: string) => string): string {
  const words = name.split(' ');
  words[words.length - 1] = change(words[words.length - 1]!);
  return words.join(' ');
}

function piecesFrom(match: RegExpMatchArray | null): ServingPieces | null {
  if (!match) return null;
  const perServing = parseCount(match[1]!);
  const name = match[2]!.replace(/\s+/g, ' ').trim();
  if (!(perServing > 0) || perServing > MAX_PIECES_PER_SERVING) return null;
  if (!name || name.length > MAX_PIECE_NAME_LENGTH || NOT_PIECES.has(name)) return null;
  // One piece or less ("1 package", "1/2 package") is worded in the singular.
  return perServing <= 1
    ? { perServing, singular: name, plural: onLastWord(name, pluralize) }
    : { perServing, singular: onLastWord(name, singularize), plural: name };
}

/**
 * The pieces a serving's wording names -- "3 cookies (34 g)" is 3 cookies -- or null when it
 * names none (just a weight, "30 g", or no wording at all).
 */
export function servingPieces(label: string | null | undefined): ServingPieces | null {
  const text = label?.trim().toLowerCase();
  if (!text) return null;
  return piecesFrom(text.match(LEADING_PIECES)) ?? piecesFrom(text.match(BRACKETED_PIECES));
}

/** Rounds to the 2 decimal places food_logs.quantity stores. */
function round2(value: number): number {
  return Math.round(value * 100) / 100;
}

/** The servings an amount typed in `unit` comes to, rounded the way a log stores them. */
export function toServings(
  amount: number,
  unit: QuantityUnit,
  servingGrams: number | null,
  piecesPerServing: number | null = null,
  servingMl: number | null = null,
): number {
  if (unit === 'pieces') return round2(piecesPerServing ? amount / piecesPerServing : amount);
  if (unit === 'ml') return round2(servingMl ? amount / servingMl : amount);
  if (unit === 'servings') return round2(amount);
  // A weight with no serving weight to divide by comes to nothing -- never grams taken as servings.
  if (servingGrams === null) return NaN;
  const grams = unit === 'g' ? amount : amount * GRAMS_PER_OUNCE;
  return round2(grams / servingGrams);
}

/** A number of servings as the amount to show in `unit`, so switching units keeps the amount. */
export function fromServings(
  servings: number,
  unit: QuantityUnit,
  servingGrams: number | null,
  piecesPerServing: number | null = null,
  servingMl: number | null = null,
): string {
  if (unit === 'pieces') return String(round2(servings * (piecesPerServing ?? 1)));
  if (unit === 'ml') return String(round2(servings * (servingMl ?? 1)));
  if (unit === 'servings') return String(round2(servings));
  // No serving weight: no amount in grams to show yet.
  if (servingGrams === null) return '';
  const grams = servings * servingGrams;
  return String(round2(unit === 'g' ? grams : grams / GRAMS_PER_OUNCE));
}

/** Everything a serving can be counted in: its weight, its volume, its pieces. */
export interface ServingMeasures {
  servingGrams: number | null;
  servingMl: number | null;
  pieces: ServingPieces | null;
}

/** A food's -- or a log's own snapshot of it -- serving measures. */
export function servingMeasures(food: {
  servingSize: number;
  servingUnit: string;
  servingLabel?: string | null;
}): ServingMeasures {
  return {
    servingGrams: gramsPerServing(food) ?? labelGrams(food.servingLabel),
    servingMl: mlPerServing(food),
    pieces: servingPieces(food.servingLabel),
  };
}

/**
 * A log's serving measures from its own snapshot -- and, for a serving with no weight of its
 * own that was logged by weight, the weight that entry shows, so the amount is still edited in
 * grams.
 */
export function logMeasures(log: {
  servingSize: number;
  servingUnit: string;
  servingLabel?: string | null;
  quantity: number;
  enteredAmount?: number | null;
  enteredUnit?: QuantityUnit | null;
}): ServingMeasures {
  const measures = servingMeasures(log);
  if (measures.servingGrams !== null || log.enteredAmount == null || !log.enteredUnit) {
    return measures;
  }
  return {
    ...measures,
    servingGrams: entryServingGrams(
      { amount: log.enteredAmount, unit: log.enteredUnit },
      log.quantity,
    ),
  };
}

/** The servings an amount in `unit` comes to, given a serving's measures. */
export function servingsFor(amount: number, unit: QuantityUnit, measures: ServingMeasures): number {
  return toServings(
    amount,
    unit,
    measures.servingGrams,
    measures.pieces?.perServing ?? null,
    measures.servingMl,
  );
}

/** The amount, in `unit`, that a number of servings is, given a serving's measures. */
export function amountFor(servings: number, unit: QuantityUnit, measures: ServingMeasures): string {
  return fromServings(
    servings,
    unit,
    measures.servingGrams,
    measures.pieces?.perServing ?? null,
    measures.servingMl,
  );
}

/** The unit word for an amount: "g", "ml", "cookies" / "cookie", "servings" / "serving". */
export function unitWord(amount: number, unit: QuantityUnit, pieces: ServingPieces | null): string {
  switch (unit) {
    case 'pieces':
      return amount === 1 ? (pieces?.singular ?? 'piece') : (pieces?.plural ?? 'pieces');
    case 'servings':
      return amount === 1 ? 'serving' : 'servings';
    default:
      return unit;
  }
}

/** An amount as typed: "2 cookies", "150 g", "330 ml", "1.5 servings". */
export function amountText(
  amount: number,
  unit: QuantityUnit,
  pieces: ServingPieces | null,
): string {
  return `${amount} ${unitWord(amount, unit, pieces)}`;
}
