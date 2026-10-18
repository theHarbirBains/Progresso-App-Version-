import { ValidationPipe, VersioningType } from '@nestjs/common';
import { FastifyAdapter, NestFastifyApplication } from '@nestjs/platform-fastify';
import { Test } from '@nestjs/testing';
import { AppModule } from '../src/app.module';
import { SupabaseJwtService } from '../src/auth/supabase-jwt.service';
import { AllExceptionsFilter } from '../src/common/filters/all-exceptions.filter';
import { SupabaseService } from '../src/supabase/supabase.service';

// Request validation for blocking and reporting. Each refused request is refused before any
// database call, so getClient is never set up.
describe('Blocks and reports (e2e)', () => {
  let app: NestFastifyApplication;
  const verify = jest.fn();
  const getAdminRole = jest.fn();
  const getClient = jest.fn();
  const auth = { authorization: 'Bearer good-token' };

  beforeAll(async () => {
    const moduleRef = await Test.createTestingModule({ imports: [AppModule] })
      .overrideProvider(SupabaseJwtService)
      .useValue({ verify })
      .overrideProvider(SupabaseService)
      .useValue({ getClient, getAdminRole })
      .compile();

    app = moduleRef.createNestApplication<NestFastifyApplication>(new FastifyAdapter());
    app.setGlobalPrefix('api', { exclude: ['health'] });
    app.enableVersioning({ type: VersioningType.URI, defaultVersion: '1' });
    app.useGlobalFilters(new AllExceptionsFilter());
    app.useGlobalPipes(
      new ValidationPipe({ whitelist: true, forbidNonWhitelisted: true, transform: true }),
    );
    await app.init();
    await app.getHttpAdapter().getInstance().ready();

    verify.mockResolvedValue({ sub: 'user-1', email: 'athlete@example.com' });
    getAdminRole.mockResolvedValue(null);
  });

  afterAll(async () => {
    await app.close();
  });

  it('requires signing in to block, unblock, list blocks or report', async () => {
    const responses = await Promise.all([
      app.inject({ method: 'GET', url: '/api/v1/blocks' }),
      app.inject({
        method: 'POST',
        url: '/api/v1/blocks/22222222-2222-4222-8222-222222222222',
      }),
      app.inject({
        method: 'DELETE',
        url: '/api/v1/blocks/22222222-2222-4222-8222-222222222222',
      }),
      app.inject({ method: 'POST', url: '/api/v1/reports', payload: {} }),
    ]);
    expect(responses.map((r) => r.statusCode)).toEqual([401, 401, 401, 401]);
  });

  it('rejects a block target that is not a user id', async () => {
    const response = await app.inject({
      method: 'POST',
      url: '/api/v1/blocks/not-a-uuid',
      headers: auth,
    });
    expect(response.statusCode).toBe(400);
    expect(getClient).not.toHaveBeenCalled();
  });

  it('rejects a report without a listed reason, or with too much detail', async () => {
    const [noReason, badReason, tooLong] = await Promise.all([
      app.inject({
        method: 'POST',
        url: '/api/v1/reports',
        headers: auth,
        payload: { reportedUserId: '22222222-2222-4222-8222-222222222222' },
      }),
      app.inject({
        method: 'POST',
        url: '/api/v1/reports',
        headers: auth,
        payload: { reportedUserId: '22222222-2222-4222-8222-222222222222', reason: 'rude' },
      }),
      app.inject({
        method: 'POST',
        url: '/api/v1/reports',
        headers: auth,
        payload: {
          reportedUserId: '22222222-2222-4222-8222-222222222222',
          reason: 'other',
          details: 'x'.repeat(1001),
        },
      }),
    ]);
    expect([noReason.statusCode, badReason.statusCode, tooLong.statusCode]).toEqual([
      400, 400, 400,
    ]);
    expect(getClient).not.toHaveBeenCalled();
  });
});
