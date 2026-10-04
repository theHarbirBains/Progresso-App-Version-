// Representative natural-language queries for evaluating the resolver. The acceptable states were
// written down before any run, so the results can't be fitted to them afterwards.
//
// A state is the main component's status: resolved, ai_estimate, needs_quantity, choose,
// not_found. "Acceptable" means the system behaved as intended for that query. A query with no
// amount should ask for one. An ambiguous word should offer choices. Only a real match gets a
// figure, and an estimate is acceptable only when no data source can match.

export type MainState = 'resolved' | 'ai_estimate' | 'needs_quantity' | 'choose' | 'not_found';

export interface RepresentativeQuery {
  text: string;
  /** Main-component states that count as the intended behaviour. */
  acceptable: MainState[];
  /** Why these are the acceptable states. */
  rationale: string;
}

export const REPRESENTATIVE_QUERIES: RepresentativeQuery[] = [
  {
    text: 'potato',
    acceptable: ['choose', 'needs_quantity'],
    rationale: 'Ambiguous word with no amount: several candidates, and the amount is needed.',
  },
  {
    text: 'baked potato',
    acceptable: ['needs_quantity'],
    rationale: 'A specific food with no amount: ask for the amount.',
  },
  {
    text: '100g potato',
    acceptable: ['resolved', 'choose'],
    rationale:
      'Amount given, so a verified figure is wanted. A choice is acceptable if candidates are close.',
  },
  {
    text: '1 cup cooked rice',
    acceptable: ['resolved', 'choose', 'needs_quantity'],
    rationale:
      'Cup needs a per-food gram weight. USDA publishes one for cooked rice. Without it, ask.',
  },
  {
    text: 'chicken breast',
    acceptable: ['needs_quantity', 'choose'],
    rationale: 'No amount given: ask.',
  },
  {
    text: '200g chicken breast',
    acceptable: ['resolved', 'choose'],
    rationale: 'Amount given, so a calculated figure from chicken breast data.',
  },
  {
    text: 'banana',
    acceptable: ['needs_quantity', 'choose'],
    rationale: 'No amount given: ask (medium, a grams amount, and so on).',
  },
  {
    text: 'medium banana',
    acceptable: ['resolved'],
    rationale: 'The catalog holds a medium banana directly, so a verified figure is available.',
  },
  {
    text: '2 eggs',
    acceptable: ['needs_quantity'],
    rationale:
      'A count with no size: the size changes the figure, so ask rather than assume large.',
  },
  {
    text: '250ml milk',
    acceptable: ['resolved', 'choose'],
    rationale:
      'Volume against a cup serving is exact. Milk type is ambiguous, so a choice is acceptable.',
  },
  {
    text: '1 Oreo',
    acceptable: ['resolved', 'choose'],
    rationale: 'A branded product: Open Food Facts may hold it. An estimate would be a failure.',
  },
  {
    text: 'Fairlife 2% milk',
    acceptable: ['needs_quantity', 'choose', 'resolved'],
    rationale: 'A named brand must match the brand. No amount given, so ask.',
  },
  {
    text: 'Big Mac',
    acceptable: ['needs_quantity', 'choose', 'ai_estimate'],
    rationale:
      'A restaurant item with no curated chain data. Ask for the amount, and label any estimate.',
  },
  {
    text: 'chicken shawarma',
    acceptable: ['needs_quantity', 'choose', 'ai_estimate'],
    rationale: 'A composite dish. Ask for the amount, and label any estimate.',
  },
  {
    text: 'homemade chicken curry',
    acceptable: ['needs_quantity', 'ai_estimate'],
    rationale:
      'Homemade, no ingredients given. Ask, or label the estimate. Never a verified figure.',
  },
  {
    text: 'air fried potatoes with no oil',
    acceptable: ['needs_quantity', 'choose'],
    rationale: 'No amount given. Preparation is recorded, and it must not change the numbers.',
  },
];
