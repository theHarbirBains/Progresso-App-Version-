import { ValidationPipe, VersioningType } from '@nestjs/common';
import { FastifyAdapter, NestFastifyApplication } from '@nestjs/platform-fastify';
import { Test } from '@nestjs/testing';
import { AppModule } from '../src/app.module';
import { SupabaseJwtService } from '../src/auth/supabase-jwt.service';
import { AllExceptionsFilter } from '../src/common/filters/all-exceptions.filter';
import { Role } from '../src/common/enums/role.enum';
import { SupabaseService } from '../src/supabase/supabase.service';

// Who can reach Feedback & Suggestions and its inbox, through the real guards and validation --
// with only the sign-in check, the admin_users lookup and the database stood in for.
describe('Feedback (e2e)', () => {
  let app: NestFastifyApplication;
  const verify = jest.fn();
  const getAdminRole = jest.fn();
  const getClient = jest.fn();
  const auth = { authorization: 'Bearer good-token' };
  const SUBMISSION = '22222222-2222-4222-8222-222222222222';

  // A database that answers every query with nothing found, and every count with none.
  function emptyDatabase() {
    const builder: Record<string, unknown> = {};
    for (const method of [
      'select',
      'insert',
      'update',
      'eq',
      'gte',
      'lt',
      'in',
      'or',
      'order',
      'limit',
    ]) {
      builder[method] = jest.fn(() => builder);
    }
    builder.maybeSingle = jest.fn().mockResolvedValue({ data: null, error: null });
    builder.single = jest.fn().mockResolvedValue({
      data: {
        id: SUBMISSION,
        user_id: 'user-1',
        category: 'bug',
        title: 'Swipe skips a day',
        description: 'It went two days ahead.',
        screenshot_path: null,
        app_version: null,
        build_number: null,
        platform: null,
        os_version: null,
        status: 'new',
        status_changed_at: '2026-10-25T12:00:00Z',
        created_at: '2026-10-25T12:00:00Z',
      },
      error: null,
    });
    builder.then = (ok: (v: unknown) => unknown) =>
      Promise.resolve({ data: [], error: null, count: 0 }).then(ok);
    return { from: jest.fn(() => builder), builder };
  }

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
  });

  beforeEach(() => {
    verify.mockResolvedValue({ sub: 'user-1', email: 'athlete@example.com' });
    getAdminRole.mockResolvedValue(null);
    getClient.mockReturnValue(emptyDatabase());
  });

  afterEach(() => {
    verify.mockReset();
    getAdminRole.mockReset();
    getClient.mockReset();
  });

  afterAll(async () => {
    await app.close();
  });

  const send = (payload: object) =>
    app.inject({ method: 'POST', url: '/api/v1/feedback', headers: auth, payload });

  it('requires signing in to send feedback or open the inbox', async () => {
    const responses = await Promise.all([
      app.inject({ method: 'POST', url: '/api/v1/feedback', payload: {} }),
      app.inject({ method: 'GET', url: '/api/v1/admin/feedback' }),
    ]);
    expect(responses.map((r) => r.statusCode)).toEqual([401, 401]);
  });

  it('lets anyone signed in send feedback, as themselves', async () => {
    const database = emptyDatabase();
    getClient.mockReturnValue(database);

    const response = await send({
      category: 'bug',
      title: 'Swipe skips a day',
      description: 'It went two days ahead.',
      platform: 'ios',
    });

    expect(response.statusCode).toBe(201);
    expect(database.builder.insert).toHaveBeenCalledWith(
      expect.objectContaining({ user_id: 'user-1', category: 'bug' }),
    );
  });

  it("never takes a status, an owner or anyone else's screenshot from the request", async () => {
    const [withStatus, withOwner, theirShot, badCategory, blank] = await Promise.all([
      send({ category: 'bug', title: 'x', description: 'y', status: 'completed' }),
      send({ category: 'bug', title: 'x', description: 'y', userId: 'someone-else' }),
      send({ category: 'bug', title: 'x', description: 'y', screenshotPath: '../other/shot.png' }),
      send({ category: 'praise', title: 'x', description: 'y' }),
      send({ category: 'bug', title: '   ', description: 'y' }),
    ]);
    expect([withStatus, withOwner, theirShot, badCategory, blank].map((r) => r.statusCode)).toEqual(
      [400, 400, 400, 400, 400],
    );
  });

  it('keeps every inbox route from anyone who is not an admin', async () => {
    const responses = await Promise.all([
      app.inject({ method: 'GET', url: '/api/v1/admin/feedback', headers: auth }),
      app.inject({ method: 'GET', url: `/api/v1/admin/feedback/${SUBMISSION}`, headers: auth }),
      app.inject({
        method: 'PATCH',
        url: `/api/v1/admin/feedback/${SUBMISSION}/status`,
        headers: auth,
        payload: { status: 'completed' },
      }),
      app.inject({
        method: 'POST',
        url: `/api/v1/admin/feedback/${SUBMISSION}/notes`,
        headers: auth,
        payload: { body: 'Hello' },
      }),
    ]);
    expect(responses.map((r) => r.statusCode)).toEqual([403, 403, 403, 403]);
  });

  it.each([Role.SUPPORT_ADMIN, Role.FULL_ADMIN])('opens the inbox to a %s', async (role) => {
    verify.mockResolvedValue({ sub: 'admin-1', email: 'admin@example.com' });
    getAdminRole.mockResolvedValue(role);

    const response = await app.inject({
      method: 'GET',
      url: '/api/v1/admin/feedback?status=new&category=bug&q=swipe',
      headers: auth,
    });

    expect(response.statusCode).toBe(200);
    expect(response.json()).toMatchObject({ items: [], nextBefore: null });
  });

  it("checks an admin's request too: a listed status, and a real id", async () => {
    verify.mockResolvedValue({ sub: 'admin-1', email: 'admin@example.com' });
    getAdminRole.mockResolvedValue(Role.SUPPORT_ADMIN);

    const [badStatus, badId, badFilter, missing] = await Promise.all([
      app.inject({
        method: 'PATCH',
        url: `/api/v1/admin/feedback/${SUBMISSION}/status`,
        headers: auth,
        payload: { status: 'done' },
      }),
      app.inject({ method: 'GET', url: '/api/v1/admin/feedback/not-an-id', headers: auth }),
      app.inject({ method: 'GET', url: '/api/v1/admin/feedback?status=done', headers: auth }),
      app.inject({ method: 'GET', url: `/api/v1/admin/feedback/${SUBMISSION}`, headers: auth }),
    ]);
    expect([badStatus, badId, badFilter, missing].map((r) => r.statusCode)).toEqual([
      400, 400, 400, 404,
    ]);
  });
});
