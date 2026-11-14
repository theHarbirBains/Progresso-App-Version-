import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import type { EnvironmentVariables } from '../config/env.validation';

const RESEND_EMAILS_URL = 'https://api.resend.com/emails';
const SEND_TIMEOUT_MS = 10_000;

export interface WelcomeEmail {
  to: string;
  userId: string;
  /** Their display name, if they gave one -- "Hi Harbir". */
  name: string | null;
  /** Their membership includes Nutrition: the email mentions logging meals. */
  nutrition: boolean;
}

function escapeHtml(text: string): string {
  return text
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');
}

/** The email itself: a plain welcome confirming the account is set up, as text and HTML. */
export function welcomeEmailContent(email: Pick<WelcomeEmail, 'name' | 'nutrition'>): {
  subject: string;
  text: string;
  html: string;
} {
  const firstName = email.name?.trim().split(/\s+/)[0] || null;
  const greeting = firstName ? `Hi ${firstName},` : 'Hi,';
  const steps = [
    'Start a workout from your split, or build one as you go.',
    'Every set you log counts toward your top sets and PRs.',
    ...(email.nutrition ? ['Log your meals to keep your calories and protein on track.'] : []),
  ];
  const closing =
    'Got an idea or found a bug? Tell us in Settings > Support & About > Feedback & Suggestions.';
  const text = [
    greeting,
    '',
    'Your Progresso account is set up and ready to go.',
    '',
    ...steps.map((step) => `- ${step}`),
    '',
    closing,
    '',
    'The Progresso team',
  ].join('\n');
  const html = [
    `<p>${escapeHtml(greeting)}</p>`,
    '<p>Your Progresso account is set up and ready to go.</p>',
    `<ul>${steps.map((step) => `<li>${escapeHtml(step)}</li>`).join('')}</ul>`,
    `<p>${escapeHtml(closing)}</p>`,
    '<p>The Progresso team</p>',
  ].join('\n');
  return { subject: 'Welcome to Progresso', text, html };
}

/**
 * Sends the welcome email, once, as someone finishes onboarding -- through Resend's REST API (no
 * SDK). It's an account email, not marketing, so it doesn't wait on `email_opt_in`. Until both
 * RESEND_API_KEY and EMAIL_FROM are set it does nothing; and it never throws -- a failure is
 * logged, and the profile save that set it off goes on as if it weren't there. Resend's
 * Idempotency-Key keeps a repeat of the same person's welcome from going out twice.
 */
@Injectable()
export class WelcomeEmailService {
  private readonly logger = new Logger(WelcomeEmailService.name);

  constructor(private readonly configService: ConfigService<EnvironmentVariables, true>) {}

  isConfigured(): boolean {
    return Boolean(
      this.configService.get('RESEND_API_KEY', { infer: true }) &&
      this.configService.get('EMAIL_FROM', { infer: true }),
    );
  }

  async send(email: WelcomeEmail): Promise<void> {
    const apiKey = this.configService.get('RESEND_API_KEY', { infer: true });
    const from = this.configService.get('EMAIL_FROM', { infer: true });
    if (!apiKey || !from) return;

    const { subject, text, html } = welcomeEmailContent(email);
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), SEND_TIMEOUT_MS);
    try {
      const response = await fetch(RESEND_EMAILS_URL, {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${apiKey}`,
          'Content-Type': 'application/json',
          'Idempotency-Key': `welcome-${email.userId}`,
        },
        body: JSON.stringify({ from, to: [email.to], subject, text, html }),
        signal: controller.signal,
      });
      if (!response.ok) {
        this.logger.warn(`Welcome email not sent: Resend answered ${response.status}`);
      }
    } catch (error) {
      this.logger.warn(
        `Welcome email not sent: ${error instanceof Error ? error.message : String(error)}`,
      );
    } finally {
      clearTimeout(timer);
    }
  }
}
