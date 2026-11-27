import { Controller, Get, Header, VERSION_NEUTRAL } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { Public } from '../common/decorators/public.decorator';
import type { EnvironmentVariables } from '../config/env.validation';
import { privacyPolicyHtml } from './privacy-policy';
import { TERMS_OF_SERVICE_HTML } from './terms-of-service';

/**
 * The Privacy Policy and Terms of Service as public web pages -- /legal/privacy and
 * /legal/terms, outside the /api prefix like /health -- for the app's Settings and App Store
 * Connect to link to.
 */
@Controller({ path: 'legal', version: VERSION_NEUTRAL })
export class LegalController {
  private readonly privacyPolicy: string;

  constructor(configService: ConfigService<EnvironmentVariables, true>) {
    // Says Apple Health data is kept in the account exactly when the server keeps it.
    this.privacyPolicy = privacyPolicyHtml(
      configService.get('HEALTH_DATA_ENABLED', { infer: true }),
    );
  }

  @Public()
  @Get('privacy')
  @Header('Content-Type', 'text/html; charset=utf-8')
  @Header('Cache-Control', 'public, max-age=3600')
  privacy(): string {
    return this.privacyPolicy;
  }

  @Public()
  @Get('terms')
  @Header('Content-Type', 'text/html; charset=utf-8')
  @Header('Cache-Control', 'public, max-age=3600')
  terms(): string {
    return TERMS_OF_SERVICE_HTML;
  }
}
