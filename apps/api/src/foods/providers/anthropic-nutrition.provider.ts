import {
  BadGatewayException,
  Injectable,
  Logger,
  ServiceUnavailableException,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import type { EnvironmentVariables } from '../../config/env.validation';

// Haiku, not Sonnet/Opus -- both calls here are short, single-shot structured
// tasks (one description in, a small structured reply out), not something
// that benefits from a larger model's extra reasoning depth.
const MODEL = 'claude-haiku-4-5-20251001';
const API_URL = 'https://api.anthropic.com/v1/messages';
const ANTHROPIC_VERSION = '2023-06-01';
const REQUEST_TIMEOUT_MS = 20000;
const RETRY_DELAY_MS = 400;
const MAX_TOKENS = 1024;

const PARSE_TOOL_NAME = 'food_parse';
const ESTIMATE_TOOL_NAME = 'nutrition_estimate';

// The parse call never produces nutrition numbers. Its only job is to
// understand what the user said, so the numbers can come from Progresso's own
// food data (see FoodsService.interpretDescription) instead of from memory.
const PARSE_SYSTEM_PROMPT =
  'You read a food description a user typed into a nutrition app and break it into ' +
  'structured parts using the food_parse tool. Do not estimate calories, macros or any ' +
  'nutrition -- only report what the user said. Rules: ' +
  '(1) main is the food the amount applies to, with its quantity and unit exactly as the ' +
  'user wrote them. (2) searchTerm is a short, singular, generic name for a food database ' +
  'lookup with no preparation words ("potatoes" -> "potato", "grilled chicken breast" -> ' +
  '"chicken breast"). (3) preparation records how the main food was prepared, including ' +
  'an explicit "no oil", or null. (4) addedIngredients lists only things the user said ' +
  'were added: oils, butter, sauces, toppings, other ingredients. Never add anything the ' +
  'user did not mention, and never add oil for an air fried or "no oil" preparation. ' +
  '(5) If the amount or the food is missing or too vague to log, set clarification to one ' +
  'short question asking for it, and leave main null. Always call the tool.';

const ESTIMATE_SYSTEM_PROMPT =
  'You are a nutrition estimation assistant inside a fitness app. The user describes a ' +
  'food in their own words. Report your single best estimate of its calories and macros ' +
  'for the exact amount they described, using the nutrition_estimate tool. Always call ' +
  'the tool -- never reply in plain text. Make a reasonable assumption for anything ' +
  'ambiguous rather than asking a question.';

const COMPONENT_SCHEMA = {
  type: 'object',
  properties: {
    name: {
      type: 'string',
      description: 'The food as the user described it, e.g. "air fried potatoes".',
    },
    searchTerm: {
      type: 'string',
      description: 'A short singular generic food name for a database lookup, e.g. "potato".',
    },
    quantity: { type: 'number', description: 'The amount the user gave, as a number.' },
    unit: {
      type: 'string',
      description:
        'The unit the user wrote, e.g. "g", "ml", "cup", "tbsp", "tsp", "oz", "slice", "medium", "large". Use "item" when a countable food had no unit.',
    },
  },
  required: ['name', 'searchTerm', 'quantity', 'unit'],
};

const PARSE_TOOL = {
  name: PARSE_TOOL_NAME,
  description: 'Reports the structured parts of a food description the user typed.',
  input_schema: {
    type: 'object',
    properties: {
      clarification: {
        type: ['string', 'null'],
        description:
          'One short question to ask the user when the description cannot be logged yet (no amount, or not a food). Otherwise null.',
      },
      preparation: {
        type: ['string', 'null'],
        description:
          'How the main food was prepared, e.g. "air fried", "grilled", "no oil". Null if not stated.',
      },
      main: {
        type: ['object', 'null'],
        description: 'The food the amount applies to. Null only when clarification is set.',
        properties: COMPONENT_SCHEMA.properties,
        required: COMPONENT_SCHEMA.required,
      },
      addedIngredients: {
        type: 'array',
        description:
          'Things the user said were added (oil, butter, sauce, toppings). Empty when none.',
        items: COMPONENT_SCHEMA,
      },
    },
    required: ['clarification', 'preparation', 'main', 'addedIngredients'],
  },
};

const ESTIMATE_TOOL = {
  name: ESTIMATE_TOOL_NAME,
  description: 'Reports an estimated nutrition breakdown for the described food.',
  input_schema: {
    type: 'object',
    properties: {
      name: { type: 'string', description: 'A short, natural name for this food.' },
      servingSize: { type: 'number' },
      servingUnit: { type: 'string', description: 'e.g. "g", "oz", "cup", "piece"' },
      calories: { type: 'number' },
      proteinG: { type: 'number' },
      carbsG: { type: 'number' },
      fatG: { type: 'number' },
    },
    required: ['name', 'servingSize', 'servingUnit', 'calories', 'proteinG', 'carbsG', 'fatG'],
  },
};

/** A nutrition estimate for one food/serving, in Progresso's own foods-table shape (see FoodInput). Every field is the model's single best estimate, never a fetched/verified figure. */
export interface NutritionEstimate {
  name: string;
  servingSize: number;
  servingUnit: string;
  calories: number;
  proteinG: number;
  carbsG: number;
  fatG: number;
}

/** One food the user mentioned, with the amount they gave for it. */
export interface ParsedFoodComponent {
  name: string;
  searchTerm: string;
  quantity: number;
  unit: string;
}

/** The structure of a food description. Carries no nutrition numbers. */
export interface ParsedFoodDescription {
  /** Set when the description can't be logged yet; the caller asks the user this instead of guessing. */
  clarification: string | null;
  preparation: string | null;
  main: ParsedFoodComponent | null;
  addedIngredients: ParsedFoodComponent[];
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

function isNonEmptyString(value: unknown): value is string {
  return typeof value === 'string' && value.trim().length > 0;
}

function toEstimate(input: unknown): NutritionEstimate | null {
  if (typeof input !== 'object' || input === null) return null;
  const raw = input as Record<string, unknown>;
  if (
    !isNonEmptyString(raw.name) ||
    !isNonEmptyString(raw.servingUnit) ||
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

function toComponent(input: unknown): ParsedFoodComponent | null {
  if (typeof input !== 'object' || input === null) return null;
  const raw = input as Record<string, unknown>;
  if (
    !isNonEmptyString(raw.name) ||
    !isNonEmptyString(raw.searchTerm) ||
    !isNonEmptyString(raw.unit) ||
    !isFiniteNumber(raw.quantity) ||
    raw.quantity <= 0
  ) {
    return null;
  }
  return {
    name: raw.name.trim(),
    searchTerm: raw.searchTerm.trim(),
    quantity: raw.quantity,
    unit: raw.unit.trim(),
  };
}

function toParsed(input: unknown): ParsedFoodDescription | null {
  if (typeof input !== 'object' || input === null) return null;
  const raw = input as Record<string, unknown>;
  const clarification =
    raw.clarification === null || raw.clarification === undefined
      ? null
      : isNonEmptyString(raw.clarification)
        ? raw.clarification.trim()
        : null;
  if (raw.clarification !== null && raw.clarification !== undefined && clarification === null) {
    return null;
  }
  const preparation = isNonEmptyString(raw.preparation) ? raw.preparation.trim() : null;

  const main = raw.main === null || raw.main === undefined ? null : toComponent(raw.main);
  if (raw.main !== null && raw.main !== undefined && main === null) return null;

  if (!Array.isArray(raw.addedIngredients)) return null;
  const addedIngredients: ParsedFoodComponent[] = [];
  for (const item of raw.addedIngredients) {
    const component = toComponent(item);
    if (!component) return null;
    addedIngredients.push(component);
  }

  // Either the parse is usable, or it says what to ask. A reply with neither
  // is malformed, not a silent "nothing to log".
  if (clarification === null && main === null) return null;
  return { clarification, preparation, main, addedIngredients };
}

/**
 * The two Claude calls behind AI Food Search. `parse` understands a description
 * (structure only, no nutrition numbers). `estimate` is a last-resort fallback
 * for one component the food database can't match -- its numbers are labelled
 * as unverified AI estimates everywhere they surface.
 *
 * Both use forced tool use, so the API itself validates the reply's shape
 * before our own checks run. Either throws on any failure: there's no local
 * data to degrade to for an arbitrary free-text description.
 */
@Injectable()
export class AnthropicNutritionProvider {
  private readonly logger = new Logger(AnthropicNutritionProvider.name);

  constructor(private readonly configService: ConfigService<EnvironmentVariables, true>) {}

  async parse(description: string): Promise<ParsedFoodDescription> {
    const body = await this.call(description, PARSE_SYSTEM_PROMPT, PARSE_TOOL);
    const parsed = toParsed(body);
    if (!parsed) {
      this.logger.warn('Anthropic parse reply was not a usable food_parse tool call');
      throw new BadGatewayException('AI food search failed. Please try again.');
    }
    return parsed;
  }

  async estimate(description: string): Promise<NutritionEstimate> {
    const body = await this.call(description, ESTIMATE_SYSTEM_PROMPT, ESTIMATE_TOOL);
    const result = toEstimate(body);
    if (!result) {
      this.logger.warn('Anthropic estimate reply was not a usable nutrition_estimate tool call');
      throw new BadGatewayException('Failed to estimate nutrition for that description');
    }
    return result;
  }

  private async call(
    description: string,
    system: string,
    tool: { name: string; description: string; input_schema: object },
  ): Promise<unknown> {
    const apiKey = this.configService.get('ANTHROPIC_API_KEY', { infer: true });
    if (!apiKey) {
      throw new ServiceUnavailableException('AI food search is not configured');
    }

    const response = await this.request(apiKey, description, system, tool);
    const reply = (await response.json()) as AnthropicMessageResponse;
    const toolUse = (reply.content ?? []).find(
      (block): block is AnthropicToolUseBlock =>
        block.type === 'tool_use' && 'name' in block && block.name === tool.name,
    );
    return toolUse?.input;
  }

  private async request(
    apiKey: string,
    description: string,
    system: string,
    tool: { name: string; description: string; input_schema: object },
    attempt = 0,
  ): Promise<Response> {
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
          system,
          messages: [{ role: 'user', content: description }],
          tools: [tool],
          tool_choice: { type: 'tool', name: tool.name },
        }),
      });

      if (!response.ok) {
        if (response.status >= 500 && attempt < 1) {
          await new Promise((resolve) => setTimeout(resolve, RETRY_DELAY_MS));
          return this.request(apiKey, description, system, tool, attempt + 1);
        }
        this.logger.warn(`Anthropic request failed: ${response.status}`);
        throw new BadGatewayException('AI food search failed. Please try again.');
      }
      return response;
    } catch (err) {
      if (err instanceof BadGatewayException) throw err;
      this.logger.warn(
        `Anthropic request errored: ${err instanceof Error ? err.message : String(err)}`,
      );
      throw new BadGatewayException('AI food search failed. Please try again.');
    } finally {
      clearTimeout(timeout);
    }
  }
}
