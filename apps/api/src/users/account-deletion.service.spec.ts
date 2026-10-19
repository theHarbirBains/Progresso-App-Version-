import { InternalServerErrorException } from '@nestjs/common';
import type { SupabaseService } from '../supabase/supabase.service';
import { AccountDeletionService } from './account-deletion.service';

const ME = '11111111-1111-4111-8111-111111111111';
const GUEST = '22222222-2222-4222-8222-222222222222';

type Listing = {
  data: { id: string | null; name: string }[] | null;
  error: { message: string } | null;
};

/** Storage, the delete_account RPC and the auth admin API, each recording what it was asked. */
function setup(
  options: {
    listings?: Record<string, Listing[]>;
    rpc?: { data: unknown; error: { message: string } | null };
    deleteUserError?: (id: string) => { message: string } | null;
  } = {},
) {
  const steps: string[] = [];
  const listings = new Map(Object.entries(options.listings ?? {}));
  const storage = {
    from: jest.fn((bucket: string) => ({
      list: jest.fn(async (folder: string) => {
        steps.push(`list ${bucket}/${folder}`);
        return listings.get(bucket)?.shift() ?? { data: [], error: null };
      }),
      remove: jest.fn(async (paths: string[]) => {
        steps.push(`remove ${bucket} ${paths.join(',')}`);
        return { data: [], error: null };
      }),
    })),
  };
  const client = {
    storage,
    rpc: jest.fn(async (fn: string, args: unknown) => {
      steps.push(`rpc ${fn} ${JSON.stringify(args)}`);
      return options.rpc ?? { data: [ME], error: null };
    }),
    auth: {
      admin: {
        deleteUser: jest.fn(async (id: string) => {
          steps.push(`deleteUser ${id}`);
          return { data: {}, error: options.deleteUserError?.(id) ?? null };
        }),
      },
    },
  };
  const supabase = { getClient: () => client } as unknown as SupabaseService;
  return { steps, service: new AccountDeletionService(supabase) };
}

describe('AccountDeletionService', () => {
  it('removes photos, then the data, then the auth accounts -- theirs first, then their guests', async () => {
    const { steps, service } = setup({
      listings: {
        avatars: [{ data: [{ id: 'a', name: 'avatar.jpg' }], error: null }],
        'equipment-photos': [
          {
            data: [
              { id: 'b', name: 'one.jpg' },
              { id: null, name: 'a-folder' },
            ],
            error: null,
          },
        ],
      },
      rpc: { data: [ME, GUEST], error: null },
    });

    await service.deleteAccount(ME);

    expect(steps).toEqual([
      `list avatars/${ME}`,
      `remove avatars ${ME}/avatar.jpg`,
      `list equipment-photos/${ME}`,
      `remove equipment-photos ${ME}/one.jpg`,
      `list food-photos/${ME}`,
      `rpc delete_account {"p_user":"${ME}"}`,
      `deleteUser ${ME}`,
      `deleteUser ${GUEST}`,
    ]);
  });

  it('keeps taking the first page of a full folder until it is empty', async () => {
    const page = (prefix: string, count: number) => ({
      data: Array.from({ length: count }, (_, i) => ({
        id: `${prefix}${i}`,
        name: `${prefix}${i}.jpg`,
      })),
      error: null,
    });
    const { steps, service } = setup({
      listings: { 'food-photos': [page('x', 100), page('y', 3)] },
    });

    await service.deleteAccount(ME);

    expect(steps.filter((s) => s.startsWith('remove food-photos'))).toHaveLength(2);
  });

  it('stops before touching any data when photos cannot be listed', async () => {
    const { steps, service } = setup({
      listings: { avatars: [{ data: null, error: { message: 'storage down' } }] },
    });

    await expect(service.deleteAccount(ME)).rejects.toThrow(InternalServerErrorException);
    expect(steps.some((s) => s.startsWith('rpc'))).toBe(false);
  });

  it('keeps the auth account when deleting the data fails, so it can be tried again', async () => {
    const { steps, service } = setup({ rpc: { data: null, error: { message: 'boom' } } });

    await expect(service.deleteAccount(ME)).rejects.toThrow('Could not delete your account');
    expect(steps.some((s) => s.startsWith('deleteUser'))).toBe(false);
  });

  it("fails when their own auth account can't be deleted, but not for a guest's", async () => {
    const failing = setup({ deleteUserError: (id) => (id === ME ? { message: 'nope' } : null) });
    await expect(failing.service.deleteAccount(ME)).rejects.toThrow(InternalServerErrorException);

    const guestFails = setup({
      rpc: { data: [ME, GUEST], error: null },
      deleteUserError: (id) => (id === GUEST ? { message: 'nope' } : null),
    });
    await expect(guestFails.service.deleteAccount(ME)).resolves.toBeUndefined();
  });
});
