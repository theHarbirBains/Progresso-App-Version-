import { request } from './apiClient';
import { interpretFoodDescription, resolveFoodComponent } from './foodsApi';

jest.mock('./apiClient', () => ({
  request: jest.fn().mockResolvedValue({ status: 'ok' }),
}));

const mockRequest = request as jest.Mock;

beforeEach(() => {
  mockRequest.mockClear();
});

describe('AI Food Search endpoints', () => {
  // These call a third-party LLM server-side, with their own internal retry logic (see
  // apps/api's AnthropicNutritionProvider) -- legitimately slower than request()'s default
  // 15s timeout, which exists to fail fast on a cold backend instance, not a real
  // still-in-progress AI response.
  it('interpretFoodDescription uses a longer timeout than the default', async () => {
    await interpretFoodDescription('token-123', 'a bowl of oatmeal');

    expect(mockRequest).toHaveBeenCalledWith(
      '/api/v1/foods/interpret',
      'token-123',
      { method: 'POST', body: JSON.stringify({ description: 'a bowl of oatmeal' }) },
      { timeoutMs: 45_000 },
    );
  });

  it('resolveFoodComponent uses a longer timeout than the default', async () => {
    const componentRequest = {
      index: 0,
      role: 'main' as const,
      name: 'oatmeal',
      term: 'oatmeal',
      brand: null,
      barcode: null,
      quantity: null,
    };

    await resolveFoodComponent('token-123', componentRequest, null);

    expect(mockRequest).toHaveBeenCalledWith(
      '/api/v1/foods/resolve-component',
      'token-123',
      { method: 'POST', body: JSON.stringify({ request: componentRequest, pick: null }) },
      { timeoutMs: 45_000 },
    );
  });
});
