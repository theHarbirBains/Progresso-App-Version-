import {
  BadGatewayException,
  Injectable,
  Logger,
  ServiceUnavailableException,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import type { EnvironmentVariables } from '../../config/env.validation';

// Haiku, not Sonnet/Opus -- this is a short, single-shot extraction task
// (one food description in, a handful of numbers out), not something that
// benefits from a larger model's extra reasoning depth.
const MODEL = 'claude-haiku-4-5-20251001';
const API_URL = 'https://api.anthropic.com/v1/messages';
const ANTHROPIC_VERSION = '2023-06-01';
const REQUEST_TIMEOUT_MS = 20000;
const RETRY_DELAY_MS = 400;
const MAX_TOKENS = 1024;

const SYSTEM_PROMPT =
  'You are a nutrition estimation assistant inside a fitness app. The user ' +
  'describes a food or meal in their own words (e.g. "100 grams of air ' +
  'fried potatoes with no oil"). Report your single best estimate of its ' +
  'calories and macros for the exact serving they described, using the ' +
  'nutrition_estimate tool. Always call the tool -- never reply in plain ' +
  'text. If the description is ambiguous, make a reasonable assumption ' +
  '(e.g. a typical preparation) rather than asking a clarifying question.';

const TOOL_NAME = 'nutrition_estimate';

/** A nutrition estimate for one food/serving, in Progresso's own foods-table shape (see FoodInput). Every field is the model's single best estimate, never a fetched/verified figure -- the mobile app labels this clearly as an estimate and lets the user edit before saving. */
export interface NutritionEstimate {
  name: string;
  servingSize: number;
  servingUnit: string;
  calories: number;
  proteinG: number;
  carbsG: number;
  fatG: number;
}

interface AnthropicToolUseBlock {
  type: 'tool_use';
  name: string;
  input: unknown;
}

interface AnthropicMessageResponse {
  content?: Array<AnthropicToolUseBlock | { type: string }>;
}

function isFiniteNumber(value: unknown): value is number {
  return typeof value === 'number' && Number.isFinite(value);
}

function toEstimate(input: unknown): NutritionEstimate | null {
  if (typeof input !== 'object' || input === null) return null;
  const raw = input as Record<string, unknown>;
  if (
    typeof raw.name !== 'string' ||
    !raw.name.trim() ||
    typeof raw.servingUnit !== 'string' ||
    !raw.servingUnit.trim() ||
    !isFiniteNumber(raw.servingSize) ||
    !isFiniteNumber(raw.calories) ||
    !isFiniteNumber(raw.proteinG) ||
    !isFiniteNumber(raw.carbsG) ||
    !isFiniteNumber(raw.fatG)
  ) {
    return null;
  }
  return {
    name: raw.name.trim(),
    servingSize: raw.servingSize,
    servingUnit: raw.servingUnit.trim(),
    calories: raw.calories,
    proteinG: raw.proteinG,
    carbsG: raw.carbsG,
    fatG: raw.fatG,
  };
}

/**
 * Turns a natural-language food description into an estimated nutrition
 * breakdown via Anthropic's Claude API, for the mobile app's AI food search.
 * Uses tool use (forced tool_choice) rather than asking for free-text JSON --
 * structured output the API itself validates the shape of, instead of a
 * prompt asking nicely for JSON and then hoping the reply parses.
 *
 * Unlike OpenFoodFactsProvider, a failure here has no local fallback to
 * degrade to (there's no cached/local nutrition data for an arbitrary
 * free-text description), so this throws on any failure rather than
 * returning null -- the caller (FoodsService) lets that propagate as a real
 * error the mobile app shows the user, with a retry.
 */
@Injectable()
export class AnthropicNutritionProvider {
  private readonly logger = new Logger(AnthropicNutritionProvider.name);

  constructor(private readonly configService: ConfigService<EnvironmentVariables, true>) {}

  async estimate(description: string): Promise<NutritionEstimate> {
    const apiKey = this.configService.get('ANTHROPIC_API_KEY', { infer: true });
    if (!apiKey) {
      throw new ServiceUnavailableException('AI nutrition estimation is not configured');
    }

    const response = await this.request(apiKey, description);
    const body = (await response.json()) as AnthropicMessageResponse;
    const toolUse = (body.content ?? []).find(
      (block): block is AnthropicToolUseBlock =>
        block.type === 'tool_use' && 'name' in block && block.name === TOOL_NAME,
    );
    const result = toolUse ? toEstimate(toolUse.input) : null;
    if (!result) {
      this.logger.warn('Anthropic response did not include a usable nutrition_estimate tool call');
      throw new BadGatewayException('Failed to estimate nutrition for that description');
    }
    return result;
  }

  private async request(apiKey: string, description: string, attempt = 0): Promise<Response> {
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), REQUEST_TIMEOUT_MS);
    try {
      const response = await fetch(API_URL, {
        method: 'POST',
        headers: {
          'content-type': 'application/json',
          'x-api-key': apiKey,
          'anthropic-version': ANTHROPIC_VERSION,
        },
        signal: controller.signal,
        body: JSON.stringify({
          model: MODEL,
          max_tokens: MAX_TOKENS,
          system: SYSTEM_PROMPT,
          messages: [{ role: 'user', content: description }],
          tools: [
            {
              name: TOOL_NAME,
              description: 'Reports an estimated nutrition breakdown for the described food.',
              input_schema: {
                type: 'object',
                properties: {
                  name: {
                    type: 'string',
                    description:
                      'A short, natural name for this food and serving, e.g. "Air-Fried Potatoes (100g)".',
                  },
                  servingSize: { type: 'number' },
                  servingUnit: {
                    type: 'string',
                    description: 'e.g. "g", "oz", "cup", "piece"',
                  },
                  calories: { type: 'number' },
                  proteinG: { type: 'number' },
                  carbsG: { type: 'number' },
                  fatG: { type: 'number' },
                },
                required: [
                  'name',
                  'servingSize',
                  'servingUnit',
                  'calories',
                  'proteinG',
                  'carbsG',
                  'fatG',
                ],
              },
            },
          ],
          tool_choice: { type: 'tool', name: TOOL_NAME },
        }),
      });

      if (!response.ok) {
        if (response.status >= 500 && attempt < 1) {
          await new Promise((resolve) => setTimeout(resolve, RETRY_DELAY_MS));
          return this.request(apiKey, description, attempt + 1);
        }
        this.logger.warn(`Anthropic request failed: ${response.status}`);
        throw new BadGatewayException('Failed to estimate nutrition for that description');
      }
      return response;
    } catch (err) {
      if (err instanceof BadGatewayException) throw err;
      this.logger.warn(
        `Anthropic request errored: ${err instanceof Error ? err.message : String(err)}`,
      );
      throw new BadGatewayException('Failed to estimate nutrition for that description');
    } finally {
      clearTimeout(timeout);
    }
  }
}
