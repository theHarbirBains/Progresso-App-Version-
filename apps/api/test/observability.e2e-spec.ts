import { VersioningType } from '@nestjs/common';
import { FastifyAdapter, NestFastifyApplication } from '@nestjs/platform-fastify';
import { Test } from '@nestjs/testing';
import * as Sentry from '@sentry/node';
import { AppModule } from '../src/app.module';
import { SupabaseJwtService } from '../src/auth/supabase-jwt.service';
import { AllExceptionsFilter } from '../src/common/filters/all-exceptions.filter';
import { SupabaseService } from '../src/supabase/supabase.service';

jest.mock('@sentry/node');

// Verifies AllExceptionsFilter's Sentry wiring against a real route, not
// just the filter in isolation: a genuine 500 (an unexpected error inside
// RolesGuard, not one of our own thrown HttpExceptions) must be reported,
// while ordinary 401/403 responses — expected traffic — must not.
describe('Observability (e2e)', () => {
  let app: NestFastifyApplication;
  const verify = jest.fn();
  const getAdminRole = jest.fn();
  const mockScope = { setTag: jest.fn(), setContext: jest.fn(), setUser: jest.fn() };

  beforeAll(async () => {
    const moduleRef = await Test.createTestingModule({ imports: [AppModule] })
      .overrideProvider(SupabaseJwtService)
      .useValue({ verify })
      .overrideProvider(SupabaseService)
      .useValue({ getClient: jest.fn(), getAdminRole })
      .compile();

    app = moduleRef.createNestApplication<NestFastifyApplication>(new FastifyAdapter());
    app.setGlobalPrefix('api', { exclude: ['health'] });
    app.enableVersioning({ type: VersioningType.URI, defaultVersion: '1' });
    app.useGlobalFilters(new AllExceptionsFilter());
    await app.init();
    await app.getHttpAdapter().getInstance().ready();

    // Auto-mocked withScope is a no-op by default and never invokes its
    // callback; make it behave like the real thing against our fake scope.
    (Sentry.withScope as jest.Mock).mockImplementation((callback: (scope: unknown) => void) => {
      callback(mockScope);
    });
  });

  afterEach(() => {
    verify.mockReset();
    getAdminRole.mockReset();
    jest.clearAllMocks();
  });

  afterAll(async () => {
    await app.close();
  });

  it('reports a genuine unexpected error to Sentry with route/method/user context', async () => {
    verify.mockResolvedValue({ sub: 'user-9', email: 'athlete@example.com' });
    const boom = new Error('admin_users lookup failed unexpectedly');
    getAdminRole.mockRejectedValue(boom);

    const response = await app.inject({
      method: 'GET',
      url: '/api/v1/admin/ping',
      headers: { authorization: 'Bearer good-token' },
    });

    expect(response.statusCode).toBe(500);
    expect(Sentry.captureException).toHaveBeenCalledWith(boom);
    expect(mockScope.setTag).toHaveBeenCalledWith('route', '/api/v1/admin/ping');
    expect(mockScope.setTag).toHaveBeenCalledWith('method', 'GET');
    expect(mockScope.setUser).toHaveBeenCalledWith({ id: 'user-9' });
  });

  it('never sends the response body to Sentry as the captured exception', async () => {
    verify.mockResolvedValue({ sub: 'user-9', email: 'athlete@example.com' });
    getAdminRole.mockRejectedValue(new Error('boom'));

    const response = await app.inject({
      method: 'GET',
      url: '/api/v1/admin/ping',
      headers: { authorization: 'Bearer good-token' },
    });

    const body = JSON.parse(response.payload) as { message: unknown };
    expect(body.message).toBe('Internal server error');
  });

  it('does not report an ordinary 401 (missing token) to Sentry', async () => {
    const response = await app.inject({ method: 'GET', url: '/api/v1/admin/ping' });

    expect(response.statusCode).toBe(401);
    expect(Sentry.captureException).not.toHaveBeenCalled();
  });

  it('does not report an ordinary 403 (insufficient role) to Sentry', async () => {
    verify.mockResolvedValue({ sub: 'user-1', email: 'athlete@example.com' });
    getAdminRole.mockResolvedValue(null);

    const response = await app.inject({
      method: 'GET',
      url: '/api/v1/admin/ping',
      headers: { authorization: 'Bearer good-token' },
    });

    expect(response.statusCode).toBe(403);
    expect(Sentry.captureException).not.toHaveBeenCalled();
  });
});
