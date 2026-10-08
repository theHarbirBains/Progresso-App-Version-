# Nutrition resolution: representative query results

Run: 2026-10-04T21:09:01.463Z. 15 of 16 queries behaved as intended.

| Query                          | Main state     | As intended | Confidence | Source            | Detail                                                                                                                                                                     |
| ------------------------------ | -------------- | ----------- | ---------- | ----------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| potato                         | choose         | yes         |            |                   | Potato (baked) [progresso_catalog, 0.88]; Sweet Potato (baked) [progresso_catalog, 0.83]; Sweet potato, apple & chicken [progresso_catalog, 0.81]                          |
| baked potato                   | needs_quantity | yes         |            |                   | no amount given · matched Potato (baked)                                                                                                                                   |
| 100g potato                    | choose         | yes         |            |                   | Potato (baked) [progresso_catalog, 0.88]; Sweet Potato (baked) [progresso_catalog, 0.83]; Sweet potato, apple & chicken [progresso_catalog, 0.81]                          |
| 1 cup cooked rice              | choose         | yes         |            |                   | Rice flour, white, unenriched [usda_fdc, 0.88]; Rice, white, glutinous, unenriched, uncooked [usda_fdc, 0.85]; Rice, white, glutinous, unenriched, cooked [usda_fdc, 0.85] |
| chicken breast                 | choose         | yes         |            |                   | Chicken breast [progresso_catalog, 1.00]; Chicken Breast [progresso_catalog, 1.00]; Chicken Breasts [progresso_catalog, 1.00]                                              |
| 200g chicken breast            | choose         | yes         |            |                   | Chicken breast [progresso_catalog, 1.00]; Chicken Breast [progresso_catalog, 1.00]; Chicken Breasts [progresso_catalog, 1.00]                                              |
| banana                         | needs_quantity | yes         |            |                   | no amount given · matched Banana                                                                                                                                           |
| medium banana                  | resolved       | yes         | verified   | progresso_catalog | 105 kcal, 1.3 g protein (Banana)                                                                                                                                           |
| 2 eggs                         | choose         | no          |            |                   | Eggs [progresso_catalog, 1.00]; eggs [progresso_catalog, 1.00]; Egg, Large [progresso_catalog, 0.88]                                                                       |
| 250ml milk                     | choose         | yes         |            |                   | Whole Milk [progresso_catalog, 0.88]; Skim Milk [progresso_catalog, 0.88]; Oat milk [progresso_catalog, 0.88]                                                              |
| 1 Oreo                         | choose         | yes         |            |                   | Milka oreo [open_food_facts, 0.88]; The Original Oreo [open_food_facts, 0.88]; Oreo Mini [open_food_facts, 0.88]                                                           |
| Fairlife 2% milk               | choose         | yes         |            |                   | ultrafiltered WHOLE MILK [open_food_facts, 0.83]; ultrafiltered partly skimmed milk [open_food_facts, 0.81]; Partially Skimmed Chocolate Milk [open_food_facts, 0.81]      |
| Big Mac                        | needs_quantity | yes         |            |                   | no amount given · matched Big Mac Sauce                                                                                                                                    |
| chicken shawarma               | choose         | yes         |            |                   | Shawarma Chicken [open_food_facts, 1.00]; Chicken Shawarma [open_food_facts, 1.00]; Chicken Shawarma Pockets [open_food_facts, 0.92]                                       |
| homemade chicken curry         | needs_quantity | yes         |            |                   | no amount given · matched Curry Chicken                                                                                                                                    |
| air fried potatoes with no oil | choose         | yes         |            |                   | Potato (baked) [progresso_catalog, 0.88]; Sweet Potato (baked) [progresso_catalog, 0.83]; Sweet potato, apple & chicken [progresso_catalog, 0.81]                          |

## Acceptable states, written before the run

- **potato**: choose or needs_quantity. Ambiguous word with no amount: several candidates, and the amount is needed.
- **baked potato**: needs_quantity. A specific food with no amount: ask for the amount.
- **100g potato**: resolved or choose. Amount given, so a verified figure is wanted. A choice is acceptable if candidates are close.
- **1 cup cooked rice**: resolved or choose or needs_quantity. Cup needs a per-food gram weight. USDA publishes one for cooked rice. Without it, ask.
- **chicken breast**: needs_quantity or choose. No amount given: ask.
- **200g chicken breast**: resolved or choose. Amount given, so a calculated figure from chicken breast data.
- **banana**: needs_quantity or choose. No amount given: ask (medium, a grams amount, and so on).
- **medium banana**: resolved. The catalog holds a medium banana directly, so a verified figure is available.
- **2 eggs**: needs_quantity. A count with no size: the size changes the figure, so ask rather than assume large.
- **250ml milk**: resolved or choose. Volume against a cup serving is exact. Milk type is ambiguous, so a choice is acceptable.
- **1 Oreo**: resolved or choose. A branded product: Open Food Facts may hold it. An estimate would be a failure.
- **Fairlife 2% milk**: needs_quantity or choose or resolved. A named brand must match the brand. No amount given, so ask.
- **Big Mac**: needs_quantity or choose or ai_estimate. A restaurant item with no curated chain data. Ask for the amount, and label any estimate.
- **chicken shawarma**: needs_quantity or choose or ai_estimate. A composite dish. Ask for the amount, and label any estimate.
- **homemade chicken curry**: needs_quantity or ai_estimate. Homemade, no ingredients given. Ask, or label the estimate. Never a verified figure.
- **air fried potatoes with no oil**: needs_quantity or choose. No amount given. Preparation is recorded, and it must not change the numbers.

## What this run does and does not show

- **The parser was not exercised.** `ANTHROPIC_API_KEY` is empty in the local environment, so
  every query used a hand-written parse (`hand-parses.ts`) standing in for Claude's output. The
  results test the resolver, the Progresso catalog, USDA, and live Open Food Facts. They say
  nothing about how accurately Claude parses real wording. That still needs a live run with a key.
- **The Anthropic estimate fallback was not exercised either.** Components no source matched
  show as unresolved here, not as AI estimates.
- **Open Food Facts returned HTTP 503 several times** during the run, so branded results are
  intermittent. Fallback behaviour when it is down is part of what needs review.

## Defects this run found, and what was done

1. **A weaker source overrode an ambiguous, stronger one.** "100g potato" resolved to _Potato
   Chips_ (536 kcal) because the catalog was ambiguous and USDA then auto-accepted. Fixed: a
   strong but ambiguous set now stops the search and the user chooses.
2. **A conversion failure at one source ended the search.** "1 cup cooked rice" asked for a
   quantity although USDA publishes a cup weight for cooked rice. Fixed: the search continues
   to the next source that can express the amount.

## Defects this run found, and left for review

3. **A wrong match at auto-accept strength.** "Big Mac" matched _Big Mac Sauce_ (score about 0.92)
   and asked for an amount for the sauce. The name score treats the sauce and the item alike. This
   is the most serious finding: a confident wrong match is worse than a question. The fix belongs
   in the scoring, not the thresholds, and needs a decision.
4. **A near-tie that is not really ambiguous.** "100 g potato" offers three choices, because
   "Sweet Potato (baked)" scores 0.83 against 0.88 for "Potato (baked)". The margin of 0.05 treats
   that as ambiguous. Whether that is right depends on the scoring, not the margin.
5. **Duplicate cached rows.** Open Food Facts results are cached into the same table as seeded
   foods, so "Chicken Breast" appears several times and "Eggs" and "eggs" both exist. That causes
   spurious ambiguity ("2 eggs" offers a choice rather than asking for the size). Cleanup of the
   cache is a separate task.

## Against the acceptable states

15 of 16 behaved as intended. The one miss is "2 eggs", which offered a choice between duplicate
cached "Eggs" rows and "Egg, Large", where the acceptable outcome was a request for the size. It
is caused by defect 5, not by the resolver's logic.

The acceptable states were written before the first run and were not changed afterwards. The
resolver was changed once, after that first run, to fix defects 1 and 2, and the results were
regenerated. No threshold was tuned against these queries.
