import { ConflictException, ForbiddenException, NotFoundException } from '@nestjs/common';
import type { SupabaseService } from '../supabase/supabase.service';
import { ExercisesService } from './exercises.service';

function createMockClient(options: {
  insertData?: Record<string, unknown> | null;
  insertError?: { code?: string; message: string } | null;
  selectData?: Record<string, unknown> | null;
  selectError?: { message: string } | null;
  updateData?: Record<string, unknown> | null;
  updateError?: { code?: string; message: string } | null;
}) {
  const single = jest
    .fn()
    .mockResolvedValue({ data: options.insertData ?? null, error: options.insertError ?? null });
  const insertSelect = jest.fn().mockReturnValue({ single });
  const insert = jest.fn().mockReturnValue({ select: insertSelect });

  const selectMaybeSingle = jest
    .fn()
    .mockResolvedValue({ data: options.selectData ?? null, error: options.selectError ?? null });
  const selectEq = jest.fn().mockReturnValue({ maybeSingle: selectMaybeSingle });
  const select = jest.fn().mockReturnValue({ eq: selectEq });

  const updateMaybeSingle = jest
    .fn()
    .mockResolvedValue({ data: options.updateData ?? null, error: options.updateError ?? null });
  const updateSelect = jest.fn().mockReturnValue({ maybeSingle: updateMaybeSingle });
  const updateEq = jest.fn().mockReturnValue({ select: updateSelect });
  const update = jest.fn().mockReturnValue({ eq: updateEq });

  const from = jest.fn().mockReturnValue({ insert, select, update });
  return { from, insert, insertSelect, single, select, selectEq, update, updateEq, updateSelect };
}

function serviceWith(client: ReturnType<typeof createMockClient>): ExercisesService {
  const supabaseService = { getClient: () => client } as unknown as SupabaseService;
  return new ExercisesService(supabaseService);
}

const builtinRow = {
  id: 'ex-builtin',
  name: 'Barbell Bench Press',
  muscle_group: 'chest',
  is_active: true,
  created_by: null,
  created_at: '2026-01-01T00:00:00.000Z',
  updated_at: '2026-01-01T00:00:00.000Z',
};

const ownCustomRow = {
  id: 'ex-mine',
  name: 'My Curl Variation',
  muscle_group: 'biceps',
  is_active: true,
  created_by: 'user-1',
  created_at: '2026-01-02T00:00:00.000Z',
  updated_at: '2026-01-02T00:00:00.000Z',
};

const othersCustomRow = { ...ownCustomRow, id: 'ex-theirs', created_by: 'user-2' };

describe('ExercisesService', () => {
  describe('createCustom', () => {
    it('creates a custom exercise owned by the caller', async () => {
      const client = createMockClient({ insertData: ownCustomRow });
      const service = serviceWith(client);

      const result = await service.createCustom('user-1', {
        name: 'My Curl Variation',
        muscleGroup: 'biceps',
      });

      expect(client.insert).toHaveBeenCalledWith({
        name: 'My Curl Variation',
        muscle_group: 'biceps',
        created_by: 'user-1',
      });
      expect(result).toEqual({
        id: 'ex-mine',
        name: 'My Curl Variation',
        muscleGroup: 'biceps',
        isActive: true,
        createdBy: 'user-1',
        createdAt: '2026-01-02T00:00:00.000Z',
        updatedAt: '2026-01-02T00:00:00.000Z',
      });
    });

    it('translates a unique-violation into ConflictException', async () => {
      const client = createMockClient({ insertError: { code: '23505', message: 'duplicate key' } });
      const service = serviceWith(client);

      await expect(
        service.createCustom('user-1', { name: 'Dupe', muscleGroup: 'chest' }),
      ).rejects.toBeInstanceOf(ConflictException);
    });

    it('throws InternalServerErrorException on other database errors', async () => {
      const client = createMockClient({ insertError: { message: 'connection lost' } });
      const service = serviceWith(client);

      await expect(
        service.createCustom('user-1', { name: 'X', muscleGroup: 'chest' }),
      ).rejects.toThrow('Failed to create exercise');
    });
  });

  describe('updateCustom', () => {
    it('throws NotFoundException when the exercise does not exist', async () => {
      const client = createMockClient({ selectData: null });
      const service = serviceWith(client);

      await expect(
        service.updateCustom('user-1', 'missing', { isActive: false }),
      ).rejects.toBeInstanceOf(NotFoundException);
    });

    it('throws ForbiddenException when the exercise is a built-in', async () => {
      const client = createMockClient({ selectData: builtinRow });
      const service = serviceWith(client);

      await expect(
        service.updateCustom('user-1', 'ex-builtin', { isActive: false }),
      ).rejects.toBeInstanceOf(ForbiddenException);
      expect(client.update).not.toHaveBeenCalled();
    });

    it('throws ForbiddenException when the exercise belongs to another user', async () => {
      const client = createMockClient({ selectData: othersCustomRow });
      const service = serviceWith(client);

      await expect(
        service.updateCustom('user-1', 'ex-theirs', { isActive: false }),
      ).rejects.toBeInstanceOf(ForbiddenException);
      expect(client.update).not.toHaveBeenCalled();
    });

    it('updates only the provided fields on an owned custom exercise', async () => {
      const client = createMockClient({
        selectData: ownCustomRow,
        updateData: { ...ownCustomRow, is_active: false },
      });
      const service = serviceWith(client);

      const result = await service.updateCustom('user-1', 'ex-mine', { isActive: false });

      expect(client.update).toHaveBeenCalledWith({ is_active: false });
      expect(client.updateEq).toHaveBeenCalledWith('id', 'ex-mine');
      expect(result.isActive).toBe(false);
    });

    it('is a no-op read when the dto is empty', async () => {
      const client = createMockClient({ selectData: ownCustomRow });
      const service = serviceWith(client);

      const result = await service.updateCustom('user-1', 'ex-mine', {});

      expect(client.update).not.toHaveBeenCalled();
      expect(result.id).toBe('ex-mine');
    });

    it('translates a unique-violation on rename into ConflictException', async () => {
      const client = createMockClient({
        selectData: ownCustomRow,
        updateError: { code: '23505', message: 'duplicate key' },
      });
      const service = serviceWith(client);

      await expect(
        service.updateCustom('user-1', 'ex-mine', { name: 'Taken Name' }),
      ).rejects.toBeInstanceOf(ConflictException);
    });

    it('throws NotFoundException if the row disappears between lookup and update', async () => {
      const client = createMockClient({ selectData: ownCustomRow, updateData: null });
      const service = serviceWith(client);

      await expect(
        service.updateCustom('user-1', 'ex-mine', { name: 'Renamed' }),
      ).rejects.toBeInstanceOf(NotFoundException);
    });
  });
});
