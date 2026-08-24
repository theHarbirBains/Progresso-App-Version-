import { ValidationPipe, VersioningType } from '@nestjs/common';
import { FastifyAdapter, NestFastifyApplication } from '@nestjs/platform-fastify';
import { Test } from '@nestjs/testing';
import { AppModule } from '../src/app.module';
import { SupabaseJwtService } from '../src/auth/supabase-jwt.service';
import { AllExceptionsFilter } from '../src/common/filters/all-exceptions.filter';
import { SupabaseService } from '../src/supabase/supabase.service';

describe('User profile updates (e2e)', () => {
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
    app.useGlobalPipes(
      new ValidationPipe({ whitelist: true, forbidNonWhitelisted: true, transform: true }),
    );
    await app.init();
    await app.getHttpAdapter().getInstance().ready();

    verify.mockResolvedValue({ sub: 'user-1', email: 'athlete@example.com' });
    getAdminRole.mockResolvedValue(null);
  });

  afterEach(() => {
    getClient.mockReset();
  });

  afterAll(async () => {
    await app.close();
  });

  function mockUpdateChain(result: {
    data?: Record<string, unknown> | null;
    error?: { code?: string; message: string } | null;
  }) {
    const maybeSingle = jest
      .fn()
      .mockResolvedValue({ data: result.data ?? null, error: result.error ?? null });
    const select = jest.fn().mockReturnValue({ maybeSingle });
    const eq = jest.fn().mockReturnValue({ select });
    const update = jest.fn().mockReturnValue({ eq });
    const from = jest.fn().mockReturnValue({ update });
    getClient.mockReturnValue({ from });
    return { from, update, eq, select, maybeSingle };
  }

  it('updates display name, username, and unit preference', async () => {
    const chain = mockUpdateChain({
      data: { weight_unit: 'lb', display_name: 'New Name', username: 'newname' },
    });

    const response = await app.inject({
      method: 'PATCH',
      url: '/api/v1/users/me',
      headers: { authorization: 'Bearer good-token' },
      payload: { displayName: 'New Name', username: 'NewName', weightUnit: 'lb' },
    });

    expect(response.statusCode).toBe(200);
    expect(JSON.parse(response.payload)).toEqual({
      id: 'user-1',
      email: 'athlete@example.com',
      role: 'user',
      weightUnit: 'lb',
      displayName: 'New Name',
      username: 'newname',
    });
    // "NewName" was lowercased to "newname" before hitting the database.
    expect(chain.update).toHaveBeenCalledWith(
      expect.objectContaining({ username: 'newname', display_name: 'New Name', weight_unit: 'lb' }),
    );
  });

  it('rejects an invalid username format', async () => {
    const response = await app.inject({
      method: 'PATCH',
      url: '/api/v1/users/me',
      headers: { authorization: 'Bearer good-token' },
      payload: { username: 'no spaces or dashes!' },
    });

    expect(response.statusCode).toBe(400);
  });

  it('rejects a username shorter than the minimum length', async () => {
    const response = await app.inject({
      method: 'PATCH',
      url: '/api/v1/users/me',
      headers: { authorization: 'Bearer good-token' },
      payload: { username: 'ab' },
    });

    expect(response.statusCode).toBe(400);
  });

  it('rejects an invalid weightUnit value', async () => {
    const response = await app.inject({
      method: 'PATCH',
      url: '/api/v1/users/me',
      headers: { authorization: 'Bearer good-token' },
      payload: { weightUnit: 'stone' },
    });

    expect(response.statusCode).toBe(400);
  });

  it('rejects unknown fields (e.g. a spoofed id/userId in the body)', async () => {
    const response = await app.inject({
      method: 'PATCH',
      url: '/api/v1/users/me',
      headers: { authorization: 'Bearer good-token' },
      payload: { displayName: 'X', id: 'someone-else', userId: 'someone-else' },
    });

    expect(response.statusCode).toBe(400);
  });

  it('returns 409 when the username is already taken', async () => {
    mockUpdateChain({
      error: { code: '23505', message: 'duplicate key value violates unique constraint' },
    });

    const response = await app.inject({
      method: 'PATCH',
      url: '/api/v1/users/me',
      headers: { authorization: 'Bearer good-token' },
      payload: { username: 'taken' },
    });

    expect(response.statusCode).toBe(409);
    expect(response.payload).not.toContain('duplicate key value violates unique constraint');
  });

  it('requires authentication', async () => {
    const response = await app.inject({
      method: 'PATCH',
      url: '/api/v1/users/me',
      payload: { displayName: 'X' },
    });

    expect(response.statusCode).toBe(401);
  });

  it('reports username availability', async () => {
    const maybeSingle = jest.fn().mockResolvedValue({ data: null, error: null });
    const eq = jest.fn().mockReturnValue({ maybeSingle });
    const select = jest.fn().mockReturnValue({ eq });
    getClient.mockReturnValue({ from: jest.fn().mockReturnValue({ select }) });

    const response = await app.inject({
      method: 'GET',
      url: '/api/v1/users/username-availability?username=freehandle',
      headers: { authorization: 'Bearer good-token' },
    });

    expect(response.statusCode).toBe(200);
    expect(JSON.parse(response.payload)).toEqual({ available: true });
  });
});
