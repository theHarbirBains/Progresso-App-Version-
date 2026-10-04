# Nutrition resolution: representative query results

Run: 2026-10-04T23:41:40.277Z. 13 of 16 queries behaved as intended.

| Query | Main state | As intended | Confidence | Source | Detail |
| --- | --- | --- | --- | --- | --- |
| potato | choose | yes |  |  | Potato (baked) [progresso_catalog, 0.88]; Sweet Potato (baked) [progresso_catalog, 0.83]; Sweet potato, apple & chicken [progresso_catalog, 0.81] |
| baked potato | choose | no |  |  | Potato (baked) [progresso_catalog, 0.88]; Sweet Potato (baked) [progresso_catalog, 0.83]; Sweet potato, apple & chicken [progresso_catalog, 0.81] |
| 100g potato | choose | yes |  |  | Potato (baked) [progresso_catalog, 0.88]; Sweet Potato (baked) [progresso_catalog, 0.83]; Sweet potato, apple & chicken [progresso_catalog, 0.81] |
| 1 cup cooked rice | choose | yes |  |  | Jasmine rice [progresso_catalog, 0.88]; White Rice (cooked) [progresso_catalog, 0.83]; Brown Rice (cooked) [progresso_catalog, 0.83] |
| chicken breast | choose | yes |  |  | Chicken breast [progresso_catalog, 1.00]; Chicken Breast [progresso_catalog, 1.00]; Chicken Breasts [progresso_catalog, 1.00] |
| 200g chicken breast | choose | yes |  |  | Chicken breast [progresso_catalog, 1.00]; Chicken Breast [progresso_catalog, 1.00]; Chicken Breasts [progresso_catalog, 1.00] |
| banana | needs_quantity | yes |  |  | no amount given · matched Banana |
| medium banana | resolved | yes | verified | progresso_catalog | 105 kcal, 1.3 g protein (Banana) |
| 2 eggs | choose | no |  |  | Eggs [progresso_catalog, 1.00]; eggs [progresso_catalog, 1.00]; Egg, Large [progresso_catalog, 0.88] |
| 250ml milk | choose | yes |  |  | Whole Milk [progresso_catalog, 0.88]; Skim Milk [progresso_catalog, 0.88]; Oat milk [progresso_catalog, 0.88] |
| 1 Oreo | choose | yes |  |  | Oreo original box [open_food_facts, 0.83]; Oreo à l'érable [open_food_facts, 0.83] |
| Fairlife 2% milk | choose | yes |  |  | ultrafiltered WHOLE MILK [open_food_facts, 0.83]; ultrafiltered partly skimmed milk [open_food_facts, 0.81]; Partially Skimmed Chocolate Milk [open_food_facts, 0.81] |
| Big Mac | needs_quantity | yes |  |  | no amount given · matched Big Mac Sauce |
| chicken shawarma | choose | yes |  |  | Shawarma Chicken [open_food_facts, 1.00]; Chicken Shawarma [open_food_facts, 1.00]; Chicken Shawarma Pockets [open_food_facts, 0.92] |
| homemade chicken curry | needs_quantity | yes |  |  | no amount given · matched Curry Chicken |
| air fried potatoes with no oil | not_found | no |  |  | error: AI food search failed. Please try again. |

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
