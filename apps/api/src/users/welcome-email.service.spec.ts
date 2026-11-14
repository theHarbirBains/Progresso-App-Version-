import type { ConfigService } from '@nestjs/config';
import type { EnvironmentVariables } from '../config/env.validation';
import { WelcomeEmailService, welcomeEmailContent } from './welcome-email.service';

function serviceWith(env: Partial<Record<'RESEND_API_KEY' | 'EMAIL_FROM', string>>) {
  const config = {
    get: (key: 'RESEND_API_KEY' | 'EMAIL_FROM') => env[key] ?? '',
  } as unknown as ConfigService<EnvironmentVariables, true>;
  return new WelcomeEmailService(config);
}

const email = { to: 'harbir@example.com', userId: 'user-1', name: 'Harbir Bains', nutrition: true };

beforeEach(() => {
  global.fetch = jest.fn().mockResolvedValue({ ok: true, status: 200 });
});

describe('WelcomeEmailService', () => {
  it('does nothing until both the Resend key and the sender are set', async () => {
    for (const env of [{}, { RESEND_API_KEY: 'key' }, { EMAIL_FROM: 'Progresso <hi@x.com>' }]) {
      const service = serviceWith(env);
      expect(service.isConfigured()).toBe(false);
      await service.send(email);
    }
    expect(global.fetch).not.toHaveBeenCalled();
  });

  it("sends through Resend's API, once per person", async () => {
    const service = serviceWith({ RESEND_API_KEY: 're_test', EMAIL_FROM: 'Progresso <hi@x.com>' });
    expect(service.isConfigured()).toBe(true);

    await service.send(email);

    const [url, init] = (global.fetch as jest.Mock).mock.calls[0] as [string, RequestInit];
    expect(url).toBe('https://api.resend.com/emails');
    expect(init.method).toBe('POST');
    expect(init.headers).toEqual({
      Authorization: 'Bearer re_test',
      'Content-Type': 'application/json',
      'Idempotency-Key': 'welcome-user-1',
    });
    const body = JSON.parse(init.body as string) as Record<string, unknown>;
    expect(body).toMatchObject({
      from: 'Progresso <hi@x.com>',
      to: ['harbir@example.com'],
      subject: 'Welcome to Progresso',
    });
    expect(body.text).toMatch(/^Hi Harbir,/);
  });

  it('never throws -- a refusal or a network failure is only logged', async () => {
    const service = serviceWith({ RESEND_API_KEY: 're_test', EMAIL_FROM: 'Progresso <hi@x.com>' });
    (global.fetch as jest.Mock).mockResolvedValueOnce({ ok: false, status: 422 });
    await expect(service.send(email)).resolves.toBeUndefined();
    (global.fetch as jest.Mock).mockRejectedValueOnce(new Error('offline'));
    await expect(service.send(email)).resolves.toBeUndefined();
  });
});

describe('welcomeEmailContent', () => {
  it('mentions logging meals only with Nutrition in the membership', () => {
    expect(welcomeEmailContent({ name: null, nutrition: true }).text).toMatch(/Log your meals/);
    const workoutsOnly = welcomeEmailContent({ name: null, nutrition: false });
    expect(workoutsOnly.text).not.toMatch(/meals/);
    expect(workoutsOnly.text).toMatch(/^Hi,/);
  });

  it("escapes the person's name in the HTML", () => {
    expect(welcomeEmailContent({ name: '<b>Sam</b>', nutrition: false }).html).toContain(
      'Hi &lt;b&gt;Sam&lt;/b&gt;,',
    );
  });
});
