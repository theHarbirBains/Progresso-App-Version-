import { ConflictException, NotFoundException } from '@nestjs/common';
import type { SupabaseService } from '../supabase/supabase.service';
import { UsersService } from './users.service';

function createMockClient(options: {
  selectData?: Record<string, unknown> | null;
  selectError?: { message: string } | null;
  updateData?: Record<string, unknown> | null;
  updateError?: { code?: string; message: string } | null;
}) {
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

  const from = jest.fn().mockReturnValue({ select, update });
  return { from, select, selectEq, update, updateEq, updateSelect };
}

function serviceWith(client: ReturnType<typeof createMockClient>): UsersService {
  const supabaseService = { getClient: () => client } as unknown as SupabaseService;
  return new UsersService(supabaseService);
}

describe('UsersService', () => {
  describe('getProfile', () => {
    it('returns the profile when found', async () => {
      const client = createMockClient({
        selectData: { weight_unit: 'kg', display_name: 'Harbir', username: 'harbir' },
      });
      const service = serviceWith(client);

      await expect(service.getProfile('user-1')).resolves.toEqual({
        weightUnit: 'kg',
        displayName: 'Harbir',
        username: 'harbir',
      });
    });

    it('throws NotFoundException when no row exists', async () => {
      const client = createMockClient({ selectData: null });
      const service = serviceWith(client);

      await expect(service.getProfile('user-1')).rejects.toBeInstanceOf(NotFoundException);
    });
  });

  describe('updateProfile', () => {
    it('updates only the provided fields', async () => {
      const client = createMockClient({
        updateData: { weight_unit: 'lb', display_name: 'Harbir', username: null },
      });
      const service = serviceWith(client);

      await service.updateProfile('user-1', { weightUnit: 'lb' });

      expect(client.update).toHaveBeenCalledWith({ weight_unit: 'lb' });
      expect(client.updateEq).toHaveBeenCalledWith('id', 'user-1');
    });

    it('is a no-op read when the dto is empty (no fields to update)', async () => {
      const client = createMockClient({
        selectData: { weight_unit: 'kg', display_name: null, username: null },
      });
      const service = serviceWith(client);

      const result = await service.updateProfile('user-1', {});

      expect(client.update).not.toHaveBeenCalled();
      expect(result).toEqual({ weightUnit: 'kg', displayName: null, username: null });
    });

    it('translates a unique-violation into ConflictException', async () => {
      const client = createMockClient({ updateError: { code: '23505', message: 'duplicate key' } });
      const service = serviceWith(client);

      await expect(service.updateProfile('user-1', { username: 'taken' })).rejects.toBeInstanceOf(
        ConflictException,
      );
    });

    it('throws NotFoundException when the target row does not exist', async () => {
      const client = createMockClient({ updateData: null });
      const service = serviceWith(client);

      await expect(service.updateProfile('user-1', { displayName: 'X' })).rejects.toBeInstanceOf(
        NotFoundException,
      );
    });
  });

  describe('isUsernameAvailable', () => {
    it('is available when no row has that username', async () => {
      const client = createMockClient({ selectData: null });
      const service = serviceWith(client);

      await expect(service.isUsernameAvailable('newname', 'user-1')).resolves.toBe(true);
    });

    it('is available when the only match is the same user (keeping their own username)', async () => {
      const client = createMockClient({ selectData: { id: 'user-1' } });
      const service = serviceWith(client);

      await expect(service.isUsernameAvailable('myname', 'user-1')).resolves.toBe(true);
    });

    it('is unavailable when a different user already has it', async () => {
      const client = createMockClient({ selectData: { id: 'user-2' } });
      const service = serviceWith(client);

      await expect(service.isUsernameAvailable('taken', 'user-1')).resolves.toBe(false);
    });

    it('normalizes case before checking', async () => {
      const client = createMockClient({ selectData: null });
      const service = serviceWith(client);

      await service.isUsernameAvailable('Harbir', 'user-1');

      expect(client.selectEq).toHaveBeenCalledWith('username', 'harbir');
    });
  });
});
