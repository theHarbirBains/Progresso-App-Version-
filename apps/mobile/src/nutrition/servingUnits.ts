export interface ServingUnitOption {
  /** Stored in foods.serving_unit / food_logs.serving_unit. */
  value: string;
  label: string;
}

// The units a food's serving can be described in. Stored values are the
// short forms the existing data already uses ('g', 'oz', 'tbsp', 'slice'),
// so no new spelling enters the database, and labels use the wording users
// read. Nothing in the nutrition math depends on the unit: calories and macros
// scale by quantity alone, so the unit is a label for the serving and a choice
// of list never changes a number.
export const SERVING_UNITS: readonly ServingUnitOption[] = [
  { value: 'serving', label: 'serving' },
  { value: 'piece', label: 'piece' },
  { value: 'item', label: 'item' },
  { value: 'cup', label: 'cup' },
  { value: '1/2 cup', label: '1/2 cup' },
  { value: 'tbsp', label: 'tablespoon' },
  { value: 'tsp', label: 'teaspoon' },
  { value: 'fl oz', label: 'fluid ounce' },
  { value: 'oz', label: 'ounce' },
  { value: 'g', label: 'gram' },
  { value: 'kg', label: 'kilogram' },
  { value: 'ml', label: 'millilitre' },
  { value: 'l', label: 'litre' },
  { value: 'slice', label: 'slice' },
  { value: 'container', label: 'container' },
  { value: 'package', label: 'package' },
  { value: 'bottle', label: 'bottle' },
  { value: 'can', label: 'can' },
  { value: 'bar', label: 'bar' },
  { value: 'scoop', label: 'scoop' },
  { value: 'handful', label: 'handful' },
];

/** The default for a new food: grams, the unit the seed data and barcode lookups already use. */
export const DEFAULT_SERVING_UNIT = 'g';

/**
 * The options to offer for a food's current unit. A unit that isn't in the
 * standard list (an existing food's 'large' or 'medium', or a provider's own
 * unit) is kept as its own option at the top, so opening an existing food
 * never silently rewrites its serving unit.
 */
export function servingUnitOptions(currentValue: string): readonly ServingUnitOption[] {
  if (currentValue === '' || SERVING_UNITS.some((unit) => unit.value === currentValue)) {
    return SERVING_UNITS;
  }
  return [{ value: currentValue, label: currentValue }, ...SERVING_UNITS];
}

/** The label to show for a stored unit, falling back to the stored text itself. */
export function servingUnitLabel(value: string): string {
  return SERVING_UNITS.find((unit) => unit.value === value)?.label ?? value;
}
