// Runs the representative queries through the real interpretation pipeline (Claude parse,
// Progresso catalog, USDA, live Open Food Facts) and writes the results as a markdown table.
// Read-only: interpretDescription saves nothing.
//
// Usage (after `npm run build`, from apps/api, with the environment set):
//   node --env-file=.env dist/nutrition-resolution/evaluation/run-evaluation.cli.js [output.md]

import { writeFileSync } from 'node:fs';
import { FoodsService } from '../../foods/foods.service';
import { AnthropicNutritionProvider } from '../../foods/providers/anthropic-nutrition.provider';
import { OpenFoodFactsProvider } from '../../foods/providers/open-food-facts.provider';
import { SupabaseService } from '../../supabase/supabase.service';
import type { ComponentStatus, InterpretFoodResponse } from '../../foods/interpretation';
import { HAND_PARSES } from './hand-parses';
import { REPRESENTATIVE_QUERIES, type MainState } from './representative-queries';

function describeMain(response: InterpretFoodResponse): {
  state: MainState | 'clarification';
  detail: string;
  confidence: string;
  source: string;
} {
  if (response.status === 'clarification') {
    return { state: 'clarification', detail: response.question, confidence: '', source: '' };
  }
  const main: ComponentStatus | undefined = response.interpretation.components.find(
    (component) => component.request.role === 'main',
  );
  if (!main) return { state: 'not_found', detail: 'no main component', confidence: '', source: '' };

  switch (main.state) {
    case 'resolved':
    case 'ai_estimate': {
      const { nutrients, provenance } = main.component;
      return {
        state: main.state,
        detail: `${nutrients.calories} kcal, ${nutrients.proteinG} g protein (${provenance.matchedName ?? 'AI estimate'})`,
        confidence: provenance.confidence,
        source: provenance.sourceKind,
      };
    }
    case 'needs_quantity':
      return {
        state: 'needs_quantity',
        detail: `${main.reason}${main.matchedName ? ` · matched ${main.matchedName}` : ''}`,
        confidence: '',
        source: '',
      };
    case 'choose':
      return {
        state: 'choose',
        detail: main.choices
          .map((c) => `${c.matchedName} [${c.sourceKind}, ${c.score.toFixed(2)}]`)
          .join('; '),
        confidence: '',
        source: '',
      };
    case 'not_found':
      return { state: 'not_found', detail: main.reason, confidence: '', source: '' };
  }
}

function escapeCell(text: string): string {
  return text.replace(/\|/g, '\\|').replace(/\n/g, ' ');
}

async function main(): Promise<void> {
  const config = { get: (key: string) => process.env[key] } as never;
  const stubNutrition = {
    parse: async (text: string) => {
      const parsed = HAND_PARSES[text];
      if (!parsed) throw new Error(`no stand-in parse for ${text}`);
      return parsed;
    },
    estimate: async () => {
      throw new Error('AI estimate is not run in this evaluation');
    },
  } as unknown as AnthropicNutritionProvider;
  const service = new FoodsService(
    new SupabaseService(config),
    new OpenFoodFactsProvider(),
    stubNutrition,
  );

  const rows: string[] = [];
  let passed = 0;
  for (const entry of REPRESENTATIVE_QUERIES) {
    let described: ReturnType<typeof describeMain>;
    try {
      described = describeMain(await service.interpretDescription(entry.text));
    } catch (error) {
      described = {
        state: 'not_found',
        detail: `error: ${error instanceof Error ? error.message : String(error)}`,
        confidence: '',
        source: '',
      };
    }
    const ok = entry.acceptable.includes(described.state as MainState);
    if (ok) passed += 1;
    rows.push(
      `| ${escapeCell(entry.text)} | ${described.state} | ${ok ? 'yes' : 'no'} | ${escapeCell(described.confidence)} | ${escapeCell(described.source)} | ${escapeCell(described.detail)} |`,
    );
    console.log(
      `${ok ? 'PASS' : 'FAIL'}  ${entry.text}  ->  ${described.state}  ${described.detail}`,
    );
  }

  const report = [
    `# Nutrition resolution: representative query results`,
    '',
    `Run: ${new Date().toISOString()}. ${passed} of ${REPRESENTATIVE_QUERIES.length} queries behaved as intended.`,
    '',
    '| Query | Main state | As intended | Confidence | Source | Detail |',
    '| --- | --- | --- | --- | --- | --- |',
    ...rows,
    '',
    '## Acceptable states, written before the run',
    '',
    ...REPRESENTATIVE_QUERIES.map(
      (q) => `- **${q.text}**: ${q.acceptable.join(' or ')}. ${q.rationale}`,
    ),
    '',
  ].join('\n');

  const output = process.argv[2];
  if (output) writeFileSync(output, report);
  console.log(`\n${passed} of ${REPRESENTATIVE_QUERIES.length} as intended`);
}

main().catch((error: unknown) => {
  console.error(error instanceof Error ? error.message : error);
  process.exit(1);
});
