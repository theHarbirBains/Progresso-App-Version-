# Nutrition resolution

Status: **implemented.** The resolver is wired into AI Food Search. The provenance migration is
applied (`supabase/migrations/20261004100200_nutrition_provenance.sql`). The USDA Foundation and
SR Legacy releases are imported. Evaluation results are in `evaluation-results.md`. This document covers what was approved, what was
drafted, what was checked, and what is waiting on a decision.

## What was approved

- USDA FoodData Central now. Canadian Nutrient File as a follow-up.
- No paid providers. The interface must allow one to be added later.
- Provenance stored on the food and the log, not in the name.
- Restaurant chains supported in the architecture, but no large chain data system.
- Missing quantities are asked for, never assumed.
- AI estimates may be saved, but always labelled as unverified.

## Source order

The resolver tries sources in the order the caller gives. The order is:

1. Progresso catalog (seeded and cached rows)
2. Barcode match (Open Food Facts), when a barcode is given
3. Branded match (Open Food Facts search, and USDA Branded once imported)
4. Restaurant or chain match, when a chain is named and curated data exists
5. Generic match: USDA Foundation and SR Legacy
6. Canadian Nutrient File, as a follow-up
7. Multi-component calculation from verified parts (homemade meals), via the same resolver
8. AI estimate, only as the last step, and always labelled

The first **unambiguous** match at or above the auto-accept score wins. If several
candidates are close, the user chooses. The resolver never picks between close
candidates silently.

## Architecture

```
Claude parser              structure only: food, amount, unit, preparation, added items.
                           No nutrition numbers. Knows nothing about any provider.
   ↓ FoodQuery per component
NutritionResolver          walks sources in order; scores; returns one of:
                             resolved | needs_quantity | choose | not_found
   ↓ NutritionSource (interface)
   ├─ ProgresoCatalogSource        (existing table)
   ├─ OpenFoodFactsSource          (existing provider, reshaped to the interface)
   ├─ UsdaFdcSource                (reference tables, added later)
   └─ future: CanadianNutrientFileSource, paid providers (not built)
   ↓ quantity.scaleFor
Calculation                 factor relative to the source's own basis; exact where possible
   ↓
ResolvedComponent           nutrients, grams, provenance
```

Files in the draft (`apps/api/src/nutrition-resolution/`):

| File | Role |
|---|---|
| `source.interface.ts` | Types: `NutritionSource`, `SourceCandidate`, `NutrientBasis`, `MeasureWeight`, `Provenance`, `Confidence`, `Licence` |
| `scoring.ts` | Name score, brand score, barcode, ranking, the auto-accept and ambiguity thresholds |
| `quantity.ts` | `scaleFor`: converts an amount to a factor against the source's basis |
| `resolver.ts` | `resolveComponent`: the source order, the four outcomes, provenance |
| `usda-fdc.mapping.ts` | Pure mapping from USDA responses to candidates |
| `nutrition-resolution.spec.ts` | 31 tests, all passing |

The existing unit module (`apps/api/src/foods/nutrition-units.ts`) is reused unchanged.

## Scoring and matching

- **Name:** word tokens with basic singularisation ("potatoes" → "potato"). Score is
  0.75 × recall + 0.25 × precision. Recall matters more, so "potato" matches
  "Potato (baked)" well and "Sweet Potato (baked)" less well.
- **Brand:** when the user names a brand, a candidate without it scores zero. A branded
  request can never resolve to a different product.
- **Barcode:** an exact match is conclusive (score 1).
- **Thresholds:** auto-accept at 0.85. Offered as a choice from 0.5. Below 0.5, ignored.
  Two candidates within 0.05 of each other are ambiguous.

These thresholds are **provisional**. They need testing against real queries before
they're trusted.

## Quantities

`scaleFor` never guesses. It works on the source's own basis (100 g, or one labelled
serving), in this order:

1. **Same family, no density needed.** Mass against mass, volume against volume.
   "250 ml" against a "1 cup" serving is exact by definition.
2. **Grams from the food's own measure.** USDA publishes gram weights per household
   measure for each food ("1 cup" of baked potato = 122 g). That makes cup, tbsp, and
   "medium" convertible for that food only.
3. **Otherwise: ask.** A generic count ("2 items") is never converted, because it names
   no size.

## Provenance

| Confidence | Meaning | When |
|---|---|---|
| `verified` | Figures published by a source for exactly this amount | Amount equals the source's basis or a published measure |
| `calculated` | Verified figures scaled or combined for the amount given | Any other amount |
| `ai_estimate` | No reliable source; Claude's estimate | Final fallback only |
| `user_entered` | The user typed the figures | Their own foods |

Each resolved component carries: source kind, source ID, matched name, brand, data
version, retrieval time, licence, attribution, and any assumptions. These are stored on
the food and the log (see the migration draft).

## USDA: what was verified

One read-only request each, using the public demo key, on 2026-10-04.

- **Search response:** nutrients are keyed by `nutrientId`. Energy is 1008, protein
  1003, fat 1004, carbohydrate 1005. Values are per 100 g.
- **Detail response:** the same nutrient IDs, with `nutrient.id` and `amount`. Portions
  carry `amount`, `gramWeight`, and `modifier`.
- **Important finding:** for SR Legacy records, `measureUnit.name` is `"undetermined"`.
  The household name is in **`modifier`** ("cup", or a size such as `potato (2-1/3" x
  4-3/4")`). The mapping reads `modifier`. Reading `measureUnit` would have dropped every
  household measure.

Not verified from a live source (recorded from knowledge, to check before relying on
them):

- Licence wording and attribution requirements on the FoodData Central data policy page.
- The hourly rate limit on the API key, and the cost of an API key.
- The contents of the Foundation and SR Legacy bulk CSV releases, and their sizes.

## Import and licensing

- **Source:** the FoodData Central bulk release for **Foundation** and **SR Legacy**
  first, not Branded. Branded runs to hundreds of thousands of rows, so it waits until
  the import pipeline is proven. The importer reads the CSV files, not the API, so no
  request rate limit applies to the bulk load.
- **Storage:** only the four macros per 100 g, the measures, and the release version.
  The full nutrient list is not stored, since the app doesn't use it.
- **Licence:** public-domain US government data, so storable. Each result carries the
  attribution string, and the app says the data isn't endorsed by USDA.
- **Versioning:** each load is recorded in `nutrition_import_runs`, so every stored
  figure traces to a release.
- **Live API:** an optional fallback later. Its key comes from the environment
  (`USDA_FDC_API_KEY`) and is never committed.

## Existing data needs a decision

Checked against the recorded USDA values: the seeded catalog's **Potato (baked)** row
says protein 2.5 g and carbs 21.2 g per 100 g. USDA SR Legacy says 1.96 g and 21.55 g.
Calories match (93). The seed's origin isn't recorded in the repo, so its figures can't
be attributed. Before the catalog is used as a `verified` source, its provenance has to
be confirmed, and any disagreement with USDA resolved. Until then the migration leaves
seeded rows' provenance null, rather than claiming they are verified.

## Scoring behaviour to watch

A short generic term against a long USDA description scores below auto-accept. For
example, "potato" against "Potatoes, baked, flesh, with salt" scores about 0.81, so the
user is asked to choose. That's the intended behaviour for an ambiguous term, but it
means many everyday queries will need a choice until the thresholds or the source
descriptions are tuned.

## Migration

Applied: `supabase/migrations/20261004100200_nutrition_provenance.sql`. It adds provenance to
`foods` and `food_logs`, adds the USDA reference tables and the import audit table, and enables
read-only RLS on the reference data.

## Testing

- `nutrition-resolution.spec.ts`: 31 tests, all passing. Covers the USDA mapping from the
  recorded response, scoring, quantity scaling, and every resolver outcome, including
  the cases where the resolver must refuse to guess.
- Not yet tested: a real Anthropic parse feeding the resolver, the live USDA search, and
  the mobile review for the new outcomes (`needs_quantity` and `choose`).

## Open decisions

1. Confirm the seeded catalog's origin, and decide whether USDA values replace it or
   sit alongside it.
2. Approve the migration draft, including the `pg_trgm` extension for name search.
3. Confirm the USDA licence and attribution wording before the import runs.
4. Decide the thresholds (0.85 auto, 0.5 choice) after a test pass on real queries.
5. Mobile: the review must show `needs_quantity` (with its options) and `choose` (with
   the choices), which the current screen doesn't handle yet.
