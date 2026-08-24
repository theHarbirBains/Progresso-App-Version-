import { ValidationPipe, VersioningType } from '@nestjs/common';
import { FastifyAdapter, NestFastifyApplication } from '@nestjs/platform-fastify';
import { Test } from '@nestjs/testing';
import { AppModule } from '../src/app.module';
import { SupabaseJwtService } from '../src/auth/supabase-jwt.service';
import { AllExceptionsFilter } from '../src/common/filters/all-exceptions.filter';
import { SupabaseService } from '../src/supabase/supabase.service';

describe('Exercises (e2e)', () => {
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

  const customExerciseRow = {
    id: 'ex-mine',
    name: 'My Curl Variation',
    muscle_group: 'biceps',
    is_active: true,
    created_by: 'user-1',
    created_at: '2026-01-02T00:00:00.000Z',
    updated_at: '2026-01-02T00:00:00.000Z',
  };

  function mockInsertChain(result: {
    data?: Record<string, unknown> | null;
    error?: { code?: string; message: string } | null;
  }) {
    const single = jest
      .fn()
      .mockResolvedValue({ data: result.data ?? null, error: result.error ?? null });
    const select = jest.fn().mockReturnValue({ single });
    const insert = jest.fn().mockReturnValue({ select });
    const from = jest.fn().mockReturnValue({ insert });
    getClient.mockReturnValue({ from });
    return { insert };
  }

  function mockSelectThenUpdateChain(
    selectResult: { data?: Record<string, unknown> | null; error?: { message: string } | null },
    updateResult?: {
      data?: Record<string, unknown> | null;
      error?: { code?: string; message: string } | null;
    },
  ) {
    const selectMaybeSingle = jest
      .fn()
      .mockResolvedValue({ data: selectResult.data ?? null, error: selectResult.error ?? null });
    const selectEq = jest.fn().mockReturnValue({ maybeSingle: selectMaybeSingle });
    const select = jest.fn().mockReturnValue({ eq: selectEq });

    const updateMaybeSingle = jest
      .fn()
      .mockResolvedValue({ data: updateResult?.data ?? null, error: updateResult?.error ?? null });
    const updateSelect = jest.fn().mockReturnValue({ maybeSingle: updateMaybeSingle });
    const updateEq = jest.fn().mockReturnValue({ select: updateSelect });
    const update = jest.fn().mockReturnValue({ eq: updateEq });

    const from = jest.fn().mockReturnValue({ select, update });
    getClient.mockReturnValue({ from });
    return { update };
  }

  describe('POST /exercises', () => {
    it('creates a custom exercise', async () => {
      mockInsertChain({ data: customExerciseRow });

      const response = await app.inject({
        method: 'POST',
        url: '/api/v1/exercises',
        headers: { authorization: 'Bearer good-token' },
        payload: { name: 'My Curl Variation', muscleGroup: 'biceps' },
      });

      expect(response.statusCode).toBe(201);
      expect(JSON.parse(response.payload)).toEqual({
        id: 'ex-mine',
        name: 'My Curl Variation',
        muscleGroup: 'biceps',
        isActive: true,
        createdBy: 'user-1',
        createdAt: '2026-01-02T00:00:00.000Z',
        updatedAt: '2026-01-02T00:00:00.000Z',
      });
    });

    it('rejects an empty name', async () => {
      const response = await app.inject({
        method: 'POST',
        url: '/api/v1/exercises',
        headers: { authorization: 'Bearer good-token' },
        payload: { name: '', muscleGroup: 'biceps' },
      });

      expect(response.statusCode).toBe(400);
    });

    it('rejects an invalid muscle group', async () => {
      const response = await app.inject({
        method: 'POST',
        url: '/api/v1/exercises',
        headers: { authorization: 'Bearer good-token' },
        payload: { name: 'X', muscleGroup: 'not-a-real-group' },
      });

      expect(response.statusCode).toBe(400);
    });

    it('rejects unknown fields (e.g. a spoofed createdBy/isActive)', async () => {
      const response = await app.inject({
        method: 'POST',
        url: '/api/v1/exercises',
        headers: { authorization: 'Bearer good-token' },
        payload: { name: 'X', muscleGroup: 'chest', createdBy: 'someone-else', isActive: true },
      });

      expect(response.statusCode).toBe(400);
    });

    it('returns 409 when the custom exercise name is already taken by this user', async () => {
      mockInsertChain({
        error: { code: '23505', message: 'duplicate key value violates unique constraint' },
      });

      const response = await app.inject({
        method: 'POST',
        url: '/api/v1/exercises',
        headers: { authorization: 'Bearer good-token' },
        payload: { name: 'Dupe', muscleGroup: 'chest' },
      });

      expect(response.statusCode).toBe(409);
      expect(response.payload).not.toContain('duplicate key value violates unique constraint');
    });

    it('requires authentication', async () => {
      const response = await app.inject({
        method: 'POST',
        url: '/api/v1/exercises',
        payload: { name: 'X', muscleGroup: 'chest' },
      });

      expect(response.statusCode).toBe(401);
    });
  });

  describe('PATCH /exercises/:id', () => {
    it('updates an owned custom exercise', async () => {
      mockSelectThenUpdateChain(
        { data: customExerciseRow },
        { data: { ...customExerciseRow, is_active: false } },
      );

      const response = await app.inject({
        method: 'PATCH',
        url: '/api/v1/exercises/11111111-1111-1111-1111-111111111111',
        headers: { authorization: 'Bearer good-token' },
        payload: { isActive: false },
      });

      expect(response.statusCode).toBe(200);
      expect(JSON.parse(response.payload)).toMatchObject({ isActive: false });
    });

    it('returns 403 when the exercise is a built-in', async () => {
      mockSelectThenUpdateChain({
        data: { ...customExerciseRow, created_by: null },
      });

      const response = await app.inject({
        method: 'PATCH',
        url: '/api/v1/exercises/11111111-1111-1111-1111-111111111111',
        headers: { authorization: 'Bearer good-token' },
        payload: { isActive: false },
      });

      expect(response.statusCode).toBe(403);
    });

    it('returns 403 when the exercise belongs to another user', async () => {
      mockSelectThenUpdateChain({
        data: { ...customExerciseRow, created_by: 'user-2' },
      });

      const response = await app.inject({
        method: 'PATCH',
        url: '/api/v1/exercises/11111111-1111-1111-1111-111111111111',
        headers: { authorization: 'Bearer good-token' },
        payload: { isActive: false },
      });

      expect(response.statusCode).toBe(403);
    });

    it('returns 404 when the exercise does not exist', async () => {
      mockSelectThenUpdateChain({ data: null });

      const response = await app.inject({
        method: 'PATCH',
        url: '/api/v1/exercises/00000000-0000-0000-0000-000000000000',
        headers: { authorization: 'Bearer good-token' },
        payload: { isActive: false },
      });

      expect(response.statusCode).toBe(404);
    });

    it('rejects a non-uuid id', async () => {
      const response = await app.inject({
        method: 'PATCH',
        url: '/api/v1/exercises/not-a-uuid',
        headers: { authorization: 'Bearer good-token' },
        payload: { isActive: false },
      });

      expect(response.statusCode).toBe(400);
    });

    it('rejects an invalid muscle group', async () => {
      const response = await app.inject({
        method: 'PATCH',
        url: '/api/v1/exercises/11111111-1111-1111-1111-111111111111',
        headers: { authorization: 'Bearer good-token' },
        payload: { muscleGroup: 'not-a-real-group' },
      });

      expect(response.statusCode).toBe(400);
    });

    it('requires authentication', async () => {
      const response = await app.inject({
        method: 'PATCH',
        url: '/api/v1/exercises/11111111-1111-1111-1111-111111111111',
        payload: { isActive: false },
      });

      expect(response.statusCode).toBe(401);
    });
  });
});
