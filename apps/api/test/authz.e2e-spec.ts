import { VersioningType } from '@nestjs/common';
import { FastifyAdapter, NestFastifyApplication } from '@nestjs/platform-fastify';
import { Test } from '@nestjs/testing';
import { AppModule } from '../src/app.module';
import { SupabaseJwtService } from '../src/auth/supabase-jwt.service';
import { AllExceptionsFilter } from '../src/common/filters/all-exceptions.filter';
import { Role } from '../src/common/enums/role.enum';
import { SupabaseService } from '../src/supabase/supabase.service';

// Exercises the real routing/guard wiring end to end (SupabaseAuthGuard +
// RolesGuard both fire for real), with only the two trust boundaries
// mocked: JWT verification (no live JWKS server here) and the
// admin_users lookup (no live database here).
describe('Authorization (e2e)', () => {
  let app: NestFastifyApplication;
  const verify = jest.fn();
  const getAdminRole = jest.fn();
  const getClient = jest.fn();

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
    await app.init();
    await app.getHttpAdapter().getInstance().ready();
  });

  afterEach(() => {
    verify.mockReset();
    getAdminRole.mockReset();
    getClient.mockReset();
  });

  afterAll(async () => {
    await app.close();
  });

  it('rejects a request to a protected route with no token', async () => {
    const response = await app.inject({ method: 'GET', url: '/api/v1/admin/ping' });
    expect(response.statusCode).toBe(401);
  });

  it('rejects a request with an invalid token', async () => {
    verify.mockRejectedValue(new Error('signature verification failed'));
    const response = await app.inject({
      method: 'GET',
      url: '/api/v1/admin/ping',
      headers: { authorization: 'Bearer not-a-real-token' },
    });
    expect(response.statusCode).toBe(401);
  });

  it('rejects a normal user (no admin_users row) from an admin-only route', async () => {
    verify.mockResolvedValue({ sub: 'user-1', email: 'athlete@example.com' });
    getAdminRole.mockResolvedValue(null);

    const response = await app.inject({
      method: 'GET',
      url: '/api/v1/admin/ping',
      headers: { authorization: 'Bearer good-token' },
    });

    expect(response.statusCode).toBe(403);
  });

  it('allows an authorized admin through the admin-only route', async () => {
    verify.mockResolvedValue({ sub: 'admin-1', email: 'admin@example.com' });
    getAdminRole.mockResolvedValue(Role.FULL_ADMIN);

    const response = await app.inject({
      method: 'GET',
      url: '/api/v1/admin/ping',
      headers: { authorization: 'Bearer good-token' },
    });

    expect(response.statusCode).toBe(200);
    expect(JSON.parse(response.payload)).toEqual({ ok: true, role: Role.FULL_ADMIN });
  });

  it('identifies the authenticated user strictly from the verified token, never a client-supplied id', async () => {
    verify.mockResolvedValue({ sub: 'user-42', email: 'real-user@example.com' });

    const response = await app.inject({
      method: 'GET',
      url: '/api/v1/admin/ping?userId=someone-else',
      headers: {
        authorization: 'Bearer good-token',
        // A malicious client trying to assert a different identity via a
        // header. The guard never reads this — only the verified JWT sub.
        'x-user-id': 'someone-else',
      },
    });

    // Rejected as a normal user (no admin role), proving the resolved
    // identity was 'user-42' from the token, not 'someone-else'.
    expect(response.statusCode).toBe(403);
    expect(getAdminRole).toHaveBeenCalledWith('user-42');
  });

  it('returns the authenticated user profile from /users/me', async () => {
    verify.mockResolvedValue({ sub: 'user-7', email: 'athlete@example.com' });
    getAdminRole.mockResolvedValue(null);
    const maybeSingle = jest.fn().mockResolvedValue({
      data: { weight_unit: 'kg', display_name: 'Athlete', username: 'athlete1' },
      error: null,
    });
    const eq = jest.fn().mockReturnValue({ maybeSingle });
    const select = jest.fn().mockReturnValue({ eq });
    getClient.mockReturnValue({ from: jest.fn().mockReturnValue({ select }) });

    const response = await app.inject({
      method: 'GET',
      url: '/api/v1/users/me',
      headers: { authorization: 'Bearer good-token' },
    });

    expect(response.statusCode).toBe(200);
    expect(JSON.parse(response.payload)).toEqual({
      id: 'user-7',
      email: 'athlete@example.com',
      role: Role.USER,
      weightUnit: 'kg',
      displayName: 'Athlete',
      username: 'athlete1',
    });
  });
});
