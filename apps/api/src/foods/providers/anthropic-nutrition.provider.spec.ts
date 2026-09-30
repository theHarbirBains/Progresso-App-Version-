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
