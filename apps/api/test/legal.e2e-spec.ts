import { VersioningType } from '@nestjs/common';
import { FastifyAdapter, NestFastifyApplication } from '@nestjs/platform-fastify';
import { Test } from '@nestjs/testing';
import { AppModule } from '../src/app.module';
import { SupabaseJwtService } from '../src/auth/supabase-jwt.service';
import { AllExceptionsFilter } from '../src/common/filters/all-exceptions.filter';
import { SupabaseService } from '../src/supabase/supabase.service';
import { LEGAL_DETAILS } from '../src/legal/legal-details';

// The legal pages are public web pages at the root, with the same prefix rules as main.ts.
describe('Legal pages (e2e)', () => {
  let app: NestFastifyApplication;

  beforeAll(async () => {
    const moduleRef = await Test.createTestingModule({ imports: [AppModule] })
      .overrideProvider(SupabaseJwtService)
      .useValue({ verify: jest.fn() })
      .overrideProvider(SupabaseService)
      .useValue({ getClient: jest.fn(), getAdminRole: jest.fn() })
      .compile();

    app = moduleRef.createNestApplication<NestFastifyApplication>(new FastifyAdapter());
    app.setGlobalPrefix('api', { exclude: ['health', 'legal/privacy', 'legal/terms'] });
    app.enableVersioning({ type: VersioningType.URI, defaultVersion: '1' });
    app.useGlobalFilters(new AllExceptionsFilter());
    await app.init();
    await app.getHttpAdapter().getInstance().ready();
  });

  afterAll(async () => {
    await app.close();
  });

  it.each([
    ['/legal/privacy', 'Privacy Policy'],
    ['/legal/terms', 'Terms of Service'],
  ])('serves %s as a web page, without signing in', async (url, title) => {
    const response = await app.inject({ method: 'GET', url });

    expect(response.statusCode).toBe(200);
    expect(response.headers['content-type']).toMatch(/^text\/html/);
    expect(response.payload).toMatch(/^<!doctype html>/);
    expect(response.payload).toContain(`<h1>${title}</h1>`);
    expect(response.payload).toContain(`Last updated ${LEGAL_DETAILS.lastUpdated}`);
  });

  it('describes account deletion as it actually works', async () => {
    const response = await app.inject({ method: 'GET', url: '/legal/privacy' });

    expect(response.payload).toContain('Settings &gt; Account &amp; Security &gt; Delete Account');
    expect(response.payload).toContain('30 days');
  });

  it('names who runs Progresso and how to reach them, with no prompt left unfilled', async () => {
    const [privacy, terms] = await Promise.all(
      ['/legal/privacy', '/legal/terms'].map((url) => app.inject({ method: 'GET', url })),
    );
    for (const page of [privacy!, terms!]) {
      expect(page.payload).toContain(`operated by ${LEGAL_DETAILS.operator}`);
      expect(page.payload).toContain(LEGAL_DETAILS.contactEmail);
      expect(page.payload).not.toMatch(/\[[^\]]*\]/);
    }
    expect(terms!.payload).toContain('Province of Ontario');
  });

  it('loads nothing from anywhere else', async () => {
    const pages = await Promise.all(
      ['/legal/privacy', '/legal/terms'].map((url) => app.inject({ method: 'GET', url })),
    );
    for (const page of pages) {
      expect(page.payload).not.toMatch(/<script|<link|src=/);
    }
  });
});
