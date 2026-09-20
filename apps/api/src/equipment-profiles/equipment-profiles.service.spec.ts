import { InternalServerErrorException, NotFoundException } from '@nestjs/common';
import type { SupabaseService } from '../supabase/supabase.service';
import { EquipmentProfilesService } from './equipment-profiles.service';

function createMockClient(options: {
  insertData?: Record<string, unknown> | null;
  insertError?: { code?: string; message: string } | null;
}) {
  const single = jest
    .fn()
    .mockResolvedValue({ data: options.insertData ?? null, error: options.insertError ?? null });
  const insertSelect = jest.fn().mockReturnValue({ single });
  const insert = jest.fn().mockReturnValue({ select: insertSelect });

  const from = jest.fn().mockReturnValue({ insert });
  return { from, insert, insertSelect, single };
}

function serviceWith(client: ReturnType<typeof createMockClient>): EquipmentProfilesService {
  const supabaseService = { getClient: () => client } as unknown as SupabaseService;
  return new EquipmentProfilesService(supabaseService);
}

const profileRow = {
  id: 'profile-1',
  exercise_id: 'ex-1',
  name: 'Cable Machine 3',
  gym: 'Downtown Gym',
  photo_url: 'https://example.com/photo.jpg',
  created_by: 'user-1',
  created_at: '2026-01-01T00:00:00.000Z',
  updated_at: '2026-01-01T00:00:00.000Z',
};

describe('EquipmentProfilesService', () => {
  describe('create', () => {
    it('creates an equipment profile owned by the caller', async () => {
      const client = createMockClient({ insertData: profileRow });
      const service = serviceWith(client);

      const result = await service.create('user-1', {
        exerciseId: 'ex-1',
        name: 'Cable Machine 3',
        gym: 'Downtown Gym',
        photoUrl: 'https://example.com/photo.jpg',
      });

      expect(client.insert).toHaveBeenCalledWith({
        exercise_id: 'ex-1',
        created_by: 'user-1',
        name: 'Cable Machine 3',
        gym: 'Downtown Gym',
        photo_url: 'https://example.com/photo.jpg',
      });
      expect(result).toEqual({
        id: 'profile-1',
        exerciseId: 'ex-1',
        name: 'Cable Machine 3',
        gym: 'Downtown Gym',
        photoUrl: 'https://example.com/photo.jpg',
        createdBy: 'user-1',
        createdAt: '2026-01-01T00:00:00.000Z',
        updatedAt: '2026-01-01T00:00:00.000Z',
      });
    });

    it('defaults gym and photoUrl to null when not provided', async () => {
      const minimalRow = { ...profileRow, gym: null, photo_url: null };
      const client = createMockClient({ insertData: minimalRow });
      const service = serviceWith(client);

      const result = await service.create('user-1', { exerciseId: 'ex-1', name: 'Leg Press A' });

      expect(client.insert).toHaveBeenCalledWith({
        exercise_id: 'ex-1',
        created_by: 'user-1',
        name: 'Leg Press A',
        gym: null,
        photo_url: null,
      });
      expect(result.gym).toBeNull();
      expect(result.photoUrl).toBeNull();
    });

    it('translates a foreign-key violation into NotFoundException', async () => {
      const client = createMockClient({
        insertError: { code: '23503', message: 'violates foreign key constraint' },
      });
      const service = serviceWith(client);

      await expect(
        service.create('user-1', { exerciseId: 'missing-exercise', name: 'X' }),
      ).rejects.toBeInstanceOf(NotFoundException);
    });

    it('throws InternalServerErrorException on other database errors', async () => {
      const client = createMockClient({ insertError: { message: 'connection lost' } });
      const service = serviceWith(client);

      await expect(service.create('user-1', { exerciseId: 'ex-1', name: 'X' })).rejects.toThrow(
        InternalServerErrorException,
      );
    });
  });
});
