# Nutrition resolution: representative query results

Run: 2026-10-04T23:55:45.512Z. 12 of 16 queries behaved as intended.

| Query | Main state | As intended | Confidence | Source | Detail |
| --- | --- | --- | --- | --- | --- |
| potato | needs_quantity | yes |  |  | no amount given · matched Potato (baked) |
| baked potato | needs_quantity | yes |  |  | no amount given · matched Potato (baked) |
| 100g potato | resolved | yes | verified | progresso_catalog | 93 kcal, 2.5 g protein (Potato (baked)) |
| 1 cup cooked rice | choose | yes |  |  | Rice, brown, medium-grain, cooked (Includes foods for USDA's Food Distribution Program) [usda_fdc, 1.00]; Rice, white, long-grain, regular, enriched, cooked [usda_fdc, 1.00]; Rice, white, medium-grain, enriched, cooked [usda_fdc, 1.00] |
| chicken breast | clarification | no |  |  | How much chicken breast did you eat? (e.g., 100g, 4 oz, 1 breast) |
| 200g chicken breast | choose | yes |  |  | Chicken Breast (cooked) [progresso_catalog, 1.00]; Chicken breast [progresso_catalog, 1.00]; Chicken Breast [progresso_catalog, 1.00] |
| banana | needs_quantity | yes |  |  | no amount given · matched Banana |
| medium banana | resolved | yes | verified | progresso_catalog | 105 kcal, 1.3 g protein (Banana) |
| 2 eggs | choose | no |  |  | Egg, Large [progresso_catalog, 1.00]; Eggs [progresso_catalog, 1.00]; eggs [progresso_catalog, 1.00] |
| 250ml milk | choose | yes |  |  | Milk, buttermilk, fluid, cultured, reduced fat [usda_fdc, 1.00]; Milk, imitation, non-soy [usda_fdc, 1.00]; Milk dessert, frozen, milk-fat free, chocolate [usda_fdc, 0.75] |
| 1 Oreo | ai_estimate | no | ai_estimate | ai_estimate | 53 kcal, 0.7 g protein (AI estimate) |
| Fairlife 2% milk | needs_quantity | yes |  |  | No food data matched this. How much did you have? |
| Big Mac | needs_quantity | yes |  |  | No food data matched this. How much did you have? |
| chicken shawarma | clarification | no |  |  | How much chicken shawarma did you have? (e.g., 1 serving, 200g, 1 wrap) |
| homemade chicken curry | needs_quantity | yes |  |  | no amount given · matched Curry Chicken |
| air fried potatoes with no oil | needs_quantity | yes |  |  | no amount given · matched Potato (baked) |

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
