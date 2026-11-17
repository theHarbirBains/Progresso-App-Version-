import type { FoodProvenance } from './foodQueries';

/** What's known about where a food's figures came from: its provenance, or the provider it was cached from. */
export interface FoodSourceInput {
  provenance?: FoodProvenance | null;
  /** The provider a shared food was cached from ('usda_fdc', 'open_food_facts'); null for a built-in. */
  provider?: string | null;
}

/**
 * Where a food's figures come from, in a few words for the food's page -- "USDA FoodData
 * Central (SR Legacy 2018-04)", "Open Food Facts", "Progresso's built-in foods" -- so a figure
 * someone doubts can be traced. Null when nothing is known. Never claims more than is recorded:
 * a built-in food is Progresso's own, not "USDA-verified" (see the provenance migration).
 */
export function foodSourceText({ provenance, provider }: FoodSourceInput): string | null {
  const kind = provenance?.sourceKind ?? provider ?? undefined;
  switch (kind) {
    case 'usda_fdc':
      return provenance?.dataVersion
        ? `USDA FoodData Central (${provenance.dataVersion})`
        : 'USDA FoodData Central';
    case 'open_food_facts':
      return 'Open Food Facts, from the product label';
    case 'canadian_nutrient_file':
      return 'Canadian Nutrient File';
    case 'progresso_catalog':
      return "Progresso's built-in foods";
    case 'ai_estimate':
      return 'AI estimate, not verified';
    case 'user_entered':
      return 'Entered by you';
    default:
      break;
  }
  if (provenance?.confidence === 'calculated') return 'Worked out from its ingredients';
  // A shared food with no provider is one of the seeded built-ins.
  if (provider === null) return "Progresso's built-in foods";
  return null;
}

/** The figures a report about a food's nutrition starts from, so whoever reads it sees what was shown. */
export function nutritionReportDraft(
  food: {
    name: string;
    servingSize: number;
    servingUnit: string;
    servingLabel?: string | null;
    calories: number;
    proteinG: number;
    carbsG: number;
    fatG: number;
  },
  source: string | null,
): { title: string; description: string } {
  const serving = food.servingLabel?.trim() || `${food.servingSize} ${food.servingUnit}`;
  return {
    title: `Nutrition looks wrong: ${food.name}`.slice(0, 120),
    description: [
      `Food: ${food.name}`,
      `1 serving: ${serving}`,
      `Shown: ${food.calories} cal, ${food.proteinG} g protein, ${food.carbsG} g carbs, ${food.fatG} g fat`,
      ...(source ? [`Source: ${source}`] : []),
      '',
      'What looks wrong, and what should it be?',
      '',
    ].join('\n'),
  };
}
