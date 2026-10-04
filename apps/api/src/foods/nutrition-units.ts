// Pure unit handling for AI Food Search: decides whether a quantity the user
// typed can be expressed in a catalog food's own serving unit, exactly. No I/O.
//
// Only conversions that are exact by definition are made:
//   - mass <-> mass (g, kg, oz)
//   - volume <-> volume (ml, l, tsp, tbsp, cup, 1/2 cup, fl oz)
// Mass <-> volume needs a food's density, which the catalog doesn't carry, so
// it is refused rather than guessed. Count units ("medium", "large", "slice")
// convert only to the same count unit.

type UnitGroup = 'mass' | 'volume' | 'count';

// Size of each measurable unit in its group's base (grams or millilitres).
const BASE_SIZE: Record<string, { group: 'mass' | 'volume'; size: number }> = {
  g: { group: 'mass', size: 1 },
  kg: { group: 'mass', size: 1000 },
  oz: { group: 'mass', size: 28.349523125 },
  ml: { group: 'volume', size: 1 },
  l: { group: 'volume', size: 1000 },
  tsp: { group: 'volume', size: 4.92892159375 },
  tbsp: { group: 'volume', size: 14.78676478125 },
  'fl oz': { group: 'volume', size: 29.5735295625 },
  cup: { group: 'volume', size: 236.5882365 },
  '1/2 cup': { group: 'volume', size: 118.29411825 },
};

// What people actually type, mapped to the stored short forms.
const ALIASES: Record<string, string> = {
  g: 'g',
  gram: 'g',
  grams: 'g',
  gr: 'g',
  kg: 'kg',
  kilogram: 'kg',
  kilograms: 'kg',
  oz: 'oz',
  ounce: 'oz',
  ounces: 'oz',
  'fl oz': 'fl oz',
  'fl. oz': 'fl oz',
  'fluid ounce': 'fl oz',
  'fluid ounces': 'fl oz',
  ml: 'ml',
  milliliter: 'ml',
  milliliters: 'ml',
  millilitre: 'ml',
  millilitres: 'ml',
  l: 'l',
  liter: 'l',
  liters: 'l',
  litre: 'l',
  litres: 'l',
  tsp: 'tsp',
  teaspoon: 'tsp',
  teaspoons: 'tsp',
  tbsp: 'tbsp',
  tablespoon: 'tbsp',
  tablespoons: 'tbsp',
  cup: 'cup',
  cups: 'cup',
  '1/2 cup': '1/2 cup',
  'half cup': '1/2 cup',
};

// Units that name no particular food size. "2 eggs" is "2 item"; it can be
// matched to a catalog's own count unit, but only with a stated assumption.
const GENERIC_COUNT_UNITS = new Set(['item', 'items', 'piece', 'pieces', 'serving', 'servings']);

/** The stored short form of a unit as typed, or the trimmed lower-case text for a count unit. */
export function normalizeUnit(unit: string): string {
  const key = unit.trim().toLowerCase().replace(/\s+/g, ' ');
  return ALIASES[key] ?? key;
}

export function unitGroup(unit: string): UnitGroup {
  const normalized = normalizeUnit(unit);
  return BASE_SIZE[normalized]?.group ?? 'count';
}

export function isGenericCountUnit(unit: string): boolean {
  return GENERIC_COUNT_UNITS.has(normalizeUnit(unit));
}

/**
 * The quantity expressed in `toUnit`, or null when the two can't be converted
 * exactly. Same-unit count quantities pass through unchanged.
 */
export function convertQuantity(quantity: number, fromUnit: string, toUnit: string): number | null {
  const from = normalizeUnit(fromUnit);
  const to = normalizeUnit(toUnit);
  if (from === to) return quantity;
  const fromSize = BASE_SIZE[from];
  const toSize = BASE_SIZE[to];
  if (!fromSize || !toSize || fromSize.group !== toSize.group) return null;
  return (quantity * fromSize.size) / toSize.size;
}

export interface CatalogServing {
  servingSize: number;
  servingUnit: string;
}

export interface CatalogScale {
  /** Multiply the catalog food's per-serving values by this to get the requested amount. */
  factor: number;
  /** Set when the match relied on an assumption the user should see (a generic "2 eggs" against a large egg). */
  assumption: string | null;
}

/**
 * How many of a catalog food's servings equal the amount the user typed, or
 * null when no exact relationship exists between them -- in which case the
 * caller falls back to something it labels honestly, never a made-up scale.
 */
export function catalogScale(
  quantity: number,
  unit: string,
  serving: CatalogServing,
  matchedName: string,
): CatalogScale | null {
  if (!(quantity > 0) || !(serving.servingSize > 0)) return null;

  const wanted = normalizeUnit(unit);
  const available = normalizeUnit(serving.servingUnit);

  if (isGenericCountUnit(wanted)) {
    // "2 eggs" against a catalog's counted food: only a count unit is comparable.
    if (unitGroup(available) !== 'count') return null;
    const factor = quantity / serving.servingSize;
    return {
      factor,
      assumption: `Treated "${quantity} ${wanted}" as ${factor} × ${matchedName} (1 ${available}).`,
    };
  }

  const converted = convertQuantity(quantity, wanted, available);
  if (converted === null) return null;
  return { factor: converted / serving.servingSize, assumption: null };
}
