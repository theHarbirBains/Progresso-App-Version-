import { Controller, Get, Header, VERSION_NEUTRAL } from '@nestjs/common';
import { Public } from '../common/decorators/public.decorator';
import { PRIVACY_POLICY_HTML } from './privacy-policy';
import { TERMS_OF_SERVICE_HTML } from './terms-of-service';

/**
 * The Privacy Policy and Terms of Service as public web pages -- /legal/privacy and
 * /legal/terms, outside the /api prefix like /health -- for the app's Settings and App Store
 * Connect to link to.
 */
@Controller({ path: 'legal', version: VERSION_NEUTRAL })
export class LegalController {
  @Public()
  @Get('privacy')
  @Header('Content-Type', 'text/html; charset=utf-8')
  @Header('Cache-Control', 'public, max-age=3600')
  privacy(): string {
    return PRIVACY_POLICY_HTML;
  }

  @Public()
  @Get('terms')
  @Header('Content-Type', 'text/html; charset=utf-8')
  @Header('Cache-Control', 'public, max-age=3600')
  terms(): string {
    return TERMS_OF_SERVICE_HTML;
  }
}
