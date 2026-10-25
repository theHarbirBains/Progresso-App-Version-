// AI Food Search's three fields -- how much, what, and how it was made -- and the one
// description they make for the existing interpret request ("150 g of chicken breast, air fried
// with 1 tsp olive oil"), so the parsing, resolving and review behind it are unchanged.

export interface AiFoodUnit {
  /** The unit as written in the description. */
  value: string;
  /** What the dropdown shows. */
  label: string;
  one: string;
  many: string;
}

export const AI_FOOD_UNITS: readonly AiFoodUnit[] = [
  { value: 'g', label: 'grams', one: 'g', many: 'g' },
  { value: 'kg', label: 'kilograms', one: 'kg', many: 'kg' },
  { value: 'oz', label: 'ounces', one: 'oz', many: 'oz' },
  { value: 'lb', label: 'pounds', one: 'lb', many: 'lb' },
  { value: 'ml', label: 'millilitres', one: 'ml', many: 'ml' },
  { value: 'l', label: 'litres', one: 'litre', many: 'litres' },
  { value: 'fl oz', label: 'fluid ounces', one: 'fl oz', many: 'fl oz' },
  { value: 'piece', label: 'pieces', one: 'piece', many: 'pieces' },
  { value: 'cup', label: 'cups', one: 'cup', many: 'cups' },
  { value: 'tbsp', label: 'tablespoons', one: 'tbsp', many: 'tbsp' },
  { value: 'tsp', label: 'teaspoons', one: 'tsp', many: 'tsp' },
  { value: 'slice', label: 'slices', one: 'slice', many: 'slices' },
  { value: 'serving', label: 'servings', one: 'serving', many: 'servings' },
];

/** The longest description the interpret request takes (the API's own limit). */
export const AI_FOOD_DESCRIPTION_MAX = 300;

const DRINK_WORDS = [
  'milk',
  'juice',
  'soda',
  'coffee',
  'tea',
  'water',
  'drink',
  'shake',
  'smoothie',
  'latte',
  'cappuccino',
  'espresso',
  'cola',
  'coke',
  'beer',
  'wine',
  'kefir',
  'lemonade',
  'kombucha',
  'broth',
];
const SLICE_WORDS = ['bread', 'toast', 'pizza', 'bacon', 'ham', 'cake', 'pie', 'loaf'];
const PIECE_WORDS = [
  'egg',
  'apple',
  'banana',
  'orange',
  'pear',
  'peach',
  'plum',
  'kiwi',
  'mandarin',
  'clementine',
  'cookie',
  'nugget',
  'wing',
  'bagel',
  'muffin',
  'donut',
  'doughnut',
  'croissant',
  'pancake',
  'waffle',
  'taco',
  'burrito',
  'sandwich',
  'burger',
  'tortilla',
  'wrap',
  'bar',
];

// The units each kind of food is most often measured in, first; every unit is always offered.
const ORDERS = {
  drink: ['ml', 'l', 'fl oz', 'cup', 'serving', 'g', 'oz'],
  slice: ['slice', 'g', 'oz', 'serving', 'piece'],
  piece: ['piece', 'g', 'oz', 'serving', 'slice'],
  food: ['g', 'oz', 'serving', 'piece', 'cup', 'tbsp', 'tsp', 'slice'],
} as const;

function mentions(food: string, list: string[]): boolean {
  const words = food
    .toLowerCase()
    .split(/[^a-z]+/)
    .filter(Boolean);
  return words.some((word) =>
    list.some((w) => word === w || word === `${w}s` || word === `${w}es`),
  );
}

/** The units to offer for a food, those it's most often measured in first. */
export function unitsFor(food: string): AiFoodUnit[] {
  const kind = mentions(food, DRINK_WORDS)
    ? 'drink'
    : mentions(food, SLICE_WORDS)
      ? 'slice'
      : mentions(food, PIECE_WORDS)
        ? 'piece'
        : 'food';
  const first: readonly string[] = ORDERS[kind];
  return [
    ...first.map((value) => AI_FOOD_UNITS.find((unit) => unit.value === value)!),
    ...AI_FOOD_UNITS.filter((unit) => !first.includes(unit.value)),
  ];
}

/** The unit a food starts in, until the person picks one: the first it's offered in. */
export function defaultUnitFor(food: string): string {
  return unitsFor(food)[0].value;
}

export function unitLabel(value: string): string {
  return AI_FOOD_UNITS.find((unit) => unit.value === value)?.label ?? value;
}

/** The amount typed: a number above zero, null for a blank field, NaN for anything else. */
export function parseAmount(text: string): number | null {
  const trimmed = text.trim();
  if (trimmed === '') return null;
  const value = Number(trimmed.replace(',', '.'));
  return Number.isFinite(value) && value > 0 ? value : NaN;
}

/**
 * The description the three fields make: "150 g of chicken breast, air fried with 1 tsp olive
 * oil". With no amount, just the food (and how it was made) -- the review then asks how much.
 */
export function aiFoodDescription(fields: {
  amount: string;
  unit: string;
  food: string;
  preparation: string;
}): string {
  const food = fields.food.trim();
  const preparation = fields.preparation.trim();
  const amount = parseAmount(fields.amount);
  const unit = AI_FOOD_UNITS.find((u) => u.value === fields.unit);
  const serving =
    amount !== null && !Number.isNaN(amount)
      ? `${amount} ${unit ? (amount === 1 ? unit.one : unit.many) : fields.unit} of `
      : '';
  return `${serving}${food}${preparation ? `, ${preparation}` : ''}`;
}
