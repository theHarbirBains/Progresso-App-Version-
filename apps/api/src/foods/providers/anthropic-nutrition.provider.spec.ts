import { BadGatewayException, ServiceUnavailableException } from '@nestjs/common';
import type { ConfigService } from '@nestjs/config';
import type { EnvironmentVariables } from '../../config/env.validation';
import { AnthropicNutritionProvider } from './anthropic-nutrition.provider';

function mockConfigService(apiKey: string) {
  return {
    get: jest.fn().mockReturnValue(apiKey),
  } as unknown as ConfigService<EnvironmentVariables, true>;
}

function mockFetchOnce(body: unknown, ok = true, status = 200) {
  (global.fetch as jest.Mock).mockResolvedValueOnce({
    ok,
    status,
    json: () => Promise.resolve(body),
  });
}

function toolUseResponse(input: unknown) {
  return {
    content: [{ type: 'tool_use', name: 'nutrition_estimate', input }],
  };
}

describe('AnthropicNutritionProvider', () => {
  beforeEach(() => {
    global.fetch = jest.fn();
  });

  it('throws ServiceUnavailableException without calling out when no API key is configured', async () => {
    const provider = new AnthropicNutritionProvider(mockConfigService(''));

    await expect(provider.estimate('100g rice')).rejects.toBeInstanceOf(
      ServiceUnavailableException,
    );
    expect(global.fetch).not.toHaveBeenCalled();
  });

  it("returns the model's tool-use estimate for a real description", async () => {
    mockFetchOnce(
      toolUseResponse({
        name: 'Air-Fried Potatoes (100g)',
        servingSize: 100,
        servingUnit: 'g',
        calories: 120,
        proteinG: 2,
        carbsG: 27,
        fatG: 0.2,
      }),
    );
    const provider = new AnthropicNutritionProvider(mockConfigService('sk-ant-test'));

    const result = await provider.estimate('100 grams of air fried potatoes with no oil');

    expect(result).toEqual({
      name: 'Air-Fried Potatoes (100g)',
      servingSize: 100,
      servingUnit: 'g',
      calories: 120,
      proteinG: 2,
      carbsG: 27,
      fatG: 0.2,
    });
  });

  it('sends the description, the forced tool_choice and the API key header', async () => {
    mockFetchOnce(
      toolUseResponse({
        name: 'x',
        servingSize: 1,
        servingUnit: 'g',
        calories: 1,
        proteinG: 1,
        carbsG: 1,
        fatG: 1,
      }),
    );
    const provider = new AnthropicNutritionProvider(mockConfigService('sk-ant-test'));

    await provider.estimate('one egg');

    const [url, init] = (global.fetch as jest.Mock).mock.calls[0] as [string, RequestInit];
    expect(url).toBe('https://api.anthropic.com/v1/messages');
    expect((init.headers as Record<string, string>)['x-api-key']).toBe('sk-ant-test');
    const body = JSON.parse(init.body as string);
    expect(body.messages).toEqual([{ role: 'user', content: 'one egg' }]);
    expect(body.tool_choice).toEqual({ type: 'tool', name: 'nutrition_estimate' });
  });

  it('throws BadGatewayException when the response has no usable tool_use block', async () => {
    mockFetchOnce({ content: [{ type: 'text', text: 'sorry, I cannot help with that' }] });
    const provider = new AnthropicNutritionProvider(mockConfigService('sk-ant-test'));

    await expect(provider.estimate('100g rice')).rejects.toBeInstanceOf(BadGatewayException);
  });

  it('throws BadGatewayException when the tool input is missing a required field', async () => {
    mockFetchOnce(
      toolUseResponse({
        name: 'Incomplete',
        servingSize: 100,
        servingUnit: 'g',
        calories: 100,
        // proteinG/carbsG/fatG missing
      }),
    );
    const provider = new AnthropicNutritionProvider(mockConfigService('sk-ant-test'));

    await expect(provider.estimate('100g rice')).rejects.toBeInstanceOf(BadGatewayException);
  });

  it('retries once on a 5xx and succeeds if the retry does', async () => {
    (global.fetch as jest.Mock)
      .mockResolvedValueOnce({ ok: false, status: 503 })
      .mockResolvedValueOnce({
        ok: true,
        status: 200,
        json: () =>
          Promise.resolve(
            toolUseResponse({
              name: 'Retried',
              servingSize: 1,
              servingUnit: 'g',
              calories: 1,
              proteinG: 1,
              carbsG: 1,
              fatG: 1,
            }),
          ),
      });
    const provider = new AnthropicNutritionProvider(mockConfigService('sk-ant-test'));

    const result = await provider.estimate('anything');

    expect(global.fetch).toHaveBeenCalledTimes(2);
    expect(result.name).toBe('Retried');
  });

  it('throws BadGatewayException (not a raw error) when the retry also fails', async () => {
    (global.fetch as jest.Mock)
      .mockResolvedValueOnce({ ok: false, status: 503 })
      .mockResolvedValueOnce({ ok: false, status: 503 });
    const provider = new AnthropicNutritionProvider(mockConfigService('sk-ant-test'));

    await expect(provider.estimate('anything')).rejects.toBeInstanceOf(BadGatewayException);
    expect(global.fetch).toHaveBeenCalledTimes(2);
  });

  it('does not retry a non-5xx failure (e.g. a 400)', async () => {
    (global.fetch as jest.Mock).mockResolvedValueOnce({ ok: false, status: 400 });
    const provider = new AnthropicNutritionProvider(mockConfigService('sk-ant-test'));

    await expect(provider.estimate('anything')).rejects.toBeInstanceOf(BadGatewayException);
    expect(global.fetch).toHaveBeenCalledTimes(1);
  });

  it('throws BadGatewayException (not a raw network error) when the network call itself throws', async () => {
    (global.fetch as jest.Mock).mockRejectedValueOnce(new Error('network down'));
    const provider = new AnthropicNutritionProvider(mockConfigService('sk-ant-test'));

    await expect(provider.estimate('anything')).rejects.toBeInstanceOf(BadGatewayException);
  });
});

function parseToolResponse(input: unknown) {
  return {
    content: [{ type: 'tool_use', name: 'food_parse', input }],
  };
}

const VALID_PARSE = {
  clarification: null,
  preparation: 'air fried, no oil',
  main: {
    name: 'air fried potatoes',
    searchTerm: 'potato',
    quantity: 100,
    unit: 'grams',
    brand: null,
  },
  addedIngredients: [],
};

describe('AnthropicNutritionProvider.parse', () => {
  beforeEach(() => {
    global.fetch = jest.fn();
  });

  it('returns the structure of a description, with no nutrition numbers', async () => {
    mockFetchOnce(parseToolResponse(VALID_PARSE));
    const provider = new AnthropicNutritionProvider(mockConfigService('test-key'));

    const result = await provider.parse('100 grams of air fried potatoes with no oil');

    expect(result).toEqual(VALID_PARSE);
    expect(result).not.toHaveProperty('calories');
  });

  it('sends the food_parse tool as the forced tool choice, with the parse instructions', async () => {
    mockFetchOnce(parseToolResponse(VALID_PARSE));
    const provider = new AnthropicNutritionProvider(mockConfigService('test-key'));

    await provider.parse('100 grams of air fried potatoes');

    const body = JSON.parse((global.fetch as jest.Mock).mock.calls[0][1].body as string);
    expect(body.tool_choice).toEqual({ type: 'tool', name: 'food_parse' });
    expect(body.tools[0].name).toBe('food_parse');
    expect(body.system).toContain('Do not estimate calories');
  });

  it('passes a clarification through and leaves main empty', async () => {
    mockFetchOnce(
      parseToolResponse({
        clarification: 'How much rice did you eat?',
        preparation: null,
        main: null,
        addedIngredients: [],
      }),
    );
    const provider = new AnthropicNutritionProvider(mockConfigService('test-key'));

    const result = await provider.parse('rice');

    expect(result.clarification).toBe('How much rice did you eat?');
    expect(result.main).toBeNull();
  });

  it('keeps every added ingredient the model reported', async () => {
    mockFetchOnce(
      parseToolResponse({
        clarification: null,
        preparation: 'scrambled',
        main: { name: 'eggs', searchTerm: 'egg', quantity: 2, unit: 'item' },
        addedIngredients: [
          { name: 'butter', searchTerm: 'butter', quantity: 1, unit: 'tsp', brand: null },
        ],
      }),
    );
    const provider = new AnthropicNutritionProvider(mockConfigService('test-key'));

    const result = await provider.parse('2 scrambled eggs cooked with 1 tsp butter');

    expect(result.addedIngredients).toEqual([
      { name: 'butter', searchTerm: 'butter', quantity: 1, unit: 'tsp', brand: null },
    ]);
  });

  it('throws BadGatewayException when the reply has no food_parse tool call', async () => {
    mockFetchOnce({ content: [{ type: 'text', text: 'Sure!' }] });
    const provider = new AnthropicNutritionProvider(mockConfigService('test-key'));

    await expect(provider.parse('100g rice')).rejects.toBeInstanceOf(BadGatewayException);
  });

  it('throws BadGatewayException when neither a clarification nor a main food is given', async () => {
    mockFetchOnce(
      parseToolResponse({
        clarification: null,
        preparation: null,
        main: null,
        addedIngredients: [],
      }),
    );
    const provider = new AnthropicNutritionProvider(mockConfigService('test-key'));

    await expect(provider.parse('???')).rejects.toBeInstanceOf(BadGatewayException);
  });

  it('throws BadGatewayException for a non-positive or non-numeric quantity', async () => {
    const provider = new AnthropicNutritionProvider(mockConfigService('test-key'));

    mockFetchOnce(
      parseToolResponse({ ...VALID_PARSE, main: { ...VALID_PARSE.main, quantity: 0 } }),
    );
    await expect(provider.parse('0 g rice')).rejects.toBeInstanceOf(BadGatewayException);

    mockFetchOnce(
      parseToolResponse({ ...VALID_PARSE, main: { ...VALID_PARSE.main, quantity: 'lots' } }),
    );
    await expect(provider.parse('lots of rice')).rejects.toBeInstanceOf(BadGatewayException);
  });

  it('throws BadGatewayException when an added ingredient is malformed rather than dropping it', async () => {
    mockFetchOnce(
      parseToolResponse({
        ...VALID_PARSE,
        addedIngredients: [
          { name: 'butter', searchTerm: 'butter', quantity: 'lots', unit: 'tsp', brand: null },
        ],
      }),
    );
    const provider = new AnthropicNutritionProvider(mockConfigService('test-key'));

    await expect(provider.parse('potato with butter')).rejects.toBeInstanceOf(BadGatewayException);
  });

  it('throws BadGatewayException when addedIngredients is not a list', async () => {
    mockFetchOnce(parseToolResponse({ ...VALID_PARSE, addedIngredients: 'butter' }));
    const provider = new AnthropicNutritionProvider(mockConfigService('test-key'));

    await expect(provider.parse('potato with butter')).rejects.toBeInstanceOf(BadGatewayException);
  });

  it('throws ServiceUnavailableException without calling out when no API key is configured', async () => {
    const provider = new AnthropicNutritionProvider(mockConfigService(''));

    await expect(provider.parse('100g rice')).rejects.toBeInstanceOf(ServiceUnavailableException);
    expect(global.fetch).not.toHaveBeenCalled();
  });

  it('throws BadGatewayException when the API call fails', async () => {
    mockFetchOnce({}, false, 400);
    const provider = new AnthropicNutritionProvider(mockConfigService('test-key'));

    await expect(provider.parse('100g rice')).rejects.toBeInstanceOf(BadGatewayException);
  });
});

describe('AnthropicNutritionProvider: one retry for transient failures', () => {
  beforeEach(() => {
    global.fetch = jest.fn();
  });

  it('makes a single call when the first attempt succeeds, with no retry delay', async () => {
    mockFetchOnce(parseToolResponse(VALID_PARSE));
    const provider = new AnthropicNutritionProvider(mockConfigService('test-key'));

    const started = Date.now();
    await provider.parse('100 grams of air fried potatoes');

    expect(global.fetch).toHaveBeenCalledTimes(1);
    expect(Date.now() - started).toBeLessThan(200);
  });

  it('retries once after a transient network failure and succeeds', async () => {
    (global.fetch as jest.Mock)
      .mockRejectedValueOnce(new Error('socket hang up'))
      .mockResolvedValueOnce({
        ok: true,
        status: 200,
        json: () => Promise.resolve(parseToolResponse(VALID_PARSE)),
      });
    const provider = new AnthropicNutritionProvider(mockConfigService('test-key'));

    await expect(provider.parse('100 grams of air fried potatoes')).resolves.toEqual(VALID_PARSE);
    expect(global.fetch).toHaveBeenCalledTimes(2);
  });

  it('retries once after a malformed reply and succeeds', async () => {
    mockFetchOnce({ content: [{ type: 'text', text: 'Sorry, I cannot help.' }] });
    mockFetchOnce(parseToolResponse(VALID_PARSE));
    const provider = new AnthropicNutritionProvider(mockConfigService('test-key'));

    await expect(provider.parse('100 grams of air fried potatoes')).resolves.toEqual(VALID_PARSE);
    expect(global.fetch).toHaveBeenCalledTimes(2);
  });

  it('gives one clean error, with no raw network message, after the retry also fails', async () => {
    (global.fetch as jest.Mock).mockRejectedValue(new Error('ECONNRESET 10.0.0.1:443'));
    const provider = new AnthropicNutritionProvider(mockConfigService('test-key'));

    const error = await provider.parse('anything').catch((e: unknown) => e);

    expect(error).toBeInstanceOf(BadGatewayException);
    expect((error as Error).message).toBe('AI food search failed. Please try again.');
    expect(global.fetch).toHaveBeenCalledTimes(2);
  });
});
