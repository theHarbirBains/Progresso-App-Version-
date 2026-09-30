import { ExpoPushProvider } from './expo-push.provider';

function mockFetchOnce(ok = true, status = 200) {
  (global.fetch as jest.Mock).mockResolvedValueOnce({
    ok,
    status,
    json: () => Promise.resolve({ data: [] }),
  });
}

describe('ExpoPushProvider', () => {
  let provider: ExpoPushProvider;

  beforeEach(() => {
    provider = new ExpoPushProvider();
    global.fetch = jest.fn();
  });

  it("sends a single request to Expo's push API for a small batch", async () => {
    mockFetchOnce();

    await provider.sendAll([
      { to: 'ExponentPushToken[a]', title: 'Time to train', body: 'Push day' },
    ]);

    expect(global.fetch).toHaveBeenCalledTimes(1);
    const [url, init] = (global.fetch as jest.Mock).mock.calls[0] as [string, RequestInit];
    expect(url).toBe('https://exp.host/--/api/v2/push/send');
    const body = JSON.parse(init.body as string);
    expect(body).toEqual([
      { to: 'ExponentPushToken[a]', title: 'Time to train', body: 'Push day', sound: 'default' },
    ]);
  });

  it('splits more than 100 messages into separate batched requests', async () => {
    mockFetchOnce();
    mockFetchOnce();
    const messages = Array.from({ length: 150 }, (_, i) => ({
      to: `ExponentPushToken[${i}]`,
      title: 'Progresso',
      body: 'reminder',
    }));

    await provider.sendAll(messages);

    expect(global.fetch).toHaveBeenCalledTimes(2);
    const firstBatch = JSON.parse(
      (global.fetch as jest.Mock).mock.calls[0][1].body as string,
    ) as unknown[];
    const secondBatch = JSON.parse(
      (global.fetch as jest.Mock).mock.calls[1][1].body as string,
    ) as unknown[];
    expect(firstBatch).toHaveLength(100);
    expect(secondBatch).toHaveLength(50);
  });

  it('retries once on a 5xx and succeeds if the retry does', async () => {
    (global.fetch as jest.Mock)
      .mockResolvedValueOnce({ ok: false, status: 503 })
      .mockResolvedValueOnce({ ok: true, status: 200, json: () => Promise.resolve({ data: [] }) });

    await provider.sendAll([{ to: 'ExponentPushToken[a]', title: 't', body: 'b' }]);

    expect(global.fetch).toHaveBeenCalledTimes(2);
  });

  it('does not retry a non-5xx failure', async () => {
    (global.fetch as jest.Mock).mockResolvedValueOnce({ ok: false, status: 400 });

    await provider.sendAll([{ to: 'ExponentPushToken[a]', title: 't', body: 'b' }]);

    expect(global.fetch).toHaveBeenCalledTimes(1);
  });

  it('does not throw when the network call itself errors -- one bad batch should not break the job', async () => {
    (global.fetch as jest.Mock).mockRejectedValueOnce(new Error('network down'));

    await expect(
      provider.sendAll([{ to: 'ExponentPushToken[a]', title: 't', body: 'b' }]),
    ).resolves.toBeUndefined();
  });

  it('sends nothing (no request at all) for an empty message list', async () => {
    await provider.sendAll([]);

    expect(global.fetch).not.toHaveBeenCalled();
  });
});
