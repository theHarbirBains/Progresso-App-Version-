// Stand-in parses for the representative queries, used because the Claude parser can't be
// called here (ANTHROPIC_API_KEY is empty in the local environment). Each one is what the parser
// is specified to return for that query. This evaluation therefore tests the resolver, the
// sources, and the calculation. It does NOT test the parser's own accuracy, which still needs a
// live run with a key.

import type { ParsedFoodDescription } from '../../foods/providers/anthropic-nutrition.provider';

function main(
  name: string,
  searchTerm: string,
  quantity: number | null,
  unit: string | null,
  brand: string | null = null,
  preparation: string | null = null,
): ParsedFoodDescription {
  return {
    clarification: null,
    preparation,
    main: { name, searchTerm, quantity, unit, brand },
    addedIngredients: [],
  };
}

export const HAND_PARSES: Record<string, ParsedFoodDescription> = {
  potato: main('potato', 'potato', null, null),
  'baked potato': main('baked potato', 'baked potato', null, null),
  '100g potato': main('potato', 'potato', 100, 'g'),
  '1 cup cooked rice': main('cooked white rice', 'white rice', 1, 'cup', null, 'cooked'),
  'chicken breast': main('chicken breast', 'chicken breast', null, null),
  '200g chicken breast': main('chicken breast', 'chicken breast', 200, 'g'),
  banana: main('banana', 'banana', null, null),
  'medium banana': main('banana', 'banana', 1, 'medium'),
  '2 eggs': main('eggs', 'egg', 2, 'item'),
  '250ml milk': main('milk', 'milk', 250, 'ml'),
  '1 Oreo': main('Oreo', 'oreo', 1, 'item'),
  'Fairlife 2% milk': main('Fairlife 2% milk', 'milk', null, null, 'Fairlife'),
  'Big Mac': main('Big Mac', 'big mac', null, null, "McDonald's"),
  'chicken shawarma': main('chicken shawarma', 'chicken shawarma', null, null),
  'homemade chicken curry': main('homemade chicken curry', 'chicken curry', null, null),
  'air fried potatoes with no oil': main(
    'air fried potatoes',
    'potato',
    null,
    null,
    null,
    'air fried, no oil',
  ),
};
