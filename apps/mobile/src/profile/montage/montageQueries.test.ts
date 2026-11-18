import { uploadPhoto } from '../../lib/photoUpload';
import { supabase } from '../../lib/supabase';
import {
  addToMontage,
  fetchOwnMontage,
  montageProblem,
  removeFromMontage,
  reorderMontage,
} from './montageQueries';

jest.mock('../../lib/photoUpload', () => ({
  ...jest.requireActual('../../lib/photoUpload'),
  uploadPhoto: jest.fn().mockResolvedValue(undefined),
}));
jest.mock('../../lib/supabase', () => ({
  supabase: { from: jest.fn(), rpc: jest.fn(), storage: { from: jest.fn() } },
}));

const mockFrom = supabase.from as jest.Mock;
const mockRpc = supabase.rpc as jest.Mock;
const mockBucket = supabase.storage.from as jest.Mock;

/** The bucket's methods, each resolving to what's given. */
function bucket(results: { upload?: object; remove?: object; sign?: object } = {}) {
  const methods = {
    upload: jest.fn().mockResolvedValue(results.upload ?? { data: {}, error: null }),
    remove: jest.fn().mockResolvedValue(results.remove ?? { data: [], error: null }),
    createSignedUrls: jest.fn().mockResolvedValue(results.sign ?? { data: [], error: null }),
  };
  mockBucket.mockReturnValue(methods);
  return methods;
}

/** The montage table: what an insert, a delete or a read comes back with. */
function table(result: { data?: unknown; error?: { message: string } | null }) {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const chain: any = {
    insert: jest.fn(() => Promise.resolve({ data: null, error: result.error ?? null })),
    delete: jest.fn(() => chain),
    select: jest.fn(() => chain),
    eq: jest.fn(() => chain),
    order: jest.fn(() => Promise.resolve({ data: result.data ?? [], error: result.error ?? null })),
    then: (ok: (value: unknown) => unknown) =>
      Promise.resolve({ data: null, error: result.error ?? null }).then(ok),
  };
  mockFrom.mockReturnValue(chain);
  return chain;
}

beforeEach(() => {
  jest.clearAllMocks();
  global.fetch = jest.fn().mockResolvedValue({ blob: () => Promise.resolve({ size: 4_000_000 }) });
});

describe('montageProblem', () => {
  it('takes photos, and videos up to a minute and 50 MB', () => {
    expect(montageProblem({ uri: 'a', type: 'image', width: 9000, height: 9000 })).toBeNull();
    expect(
      montageProblem({ uri: 'v', type: 'video', width: 1, height: 1, duration: 60_000 }),
    ).toBeNull();
    expect(
      montageProblem({ uri: 'v', type: 'video', width: 1, height: 1, duration: 75_000 }),
    ).toMatch(/up to a minute/);
    expect(
      montageProblem({ uri: 'v', type: 'video', width: 1, height: 1, fileSize: 60 * 1024 * 1024 }),
    ).toMatch(/50 MB/);
  });
});

describe('addToMontage', () => {
  it('adds a photo to your own folder as a JPEG, then its row at its uploaded size', async () => {
    bucket();
    const rows = table({});

    await addToMontage('me', { uri: 'file:///p.heic', type: 'image', width: 4032, height: 3024 });

    const [bucketName, path, uri, options] = (uploadPhoto as jest.Mock).mock.calls[0];
    expect([bucketName, uri, options]).toEqual([
      'profile-montage',
      'file:///p.heic',
      { asJpeg: true },
    ]);
    expect(path).toMatch(/^me\/[\w-]+\.jpg$/);
    expect(rows.insert).toHaveBeenCalledWith({
      user_id: 'me',
      kind: 'photo',
      storage_path: path,
      width: 1600,
      height: 1200,
      duration_seconds: null,
    });
  });

  it('adds a video as it is, with its length', async () => {
    const files = bucket();
    const rows = table({});

    await addToMontage('me', {
      uri: 'file:///clip.mp4',
      type: 'video',
      width: 1280,
      height: 720,
      duration: 12_400,
      mimeType: 'video/mp4',
    });

    const [path, , options] = files.upload.mock.calls[0];
    expect(path).toMatch(/^me\/[\w-]+\.mp4$/);
    expect(options).toEqual({ contentType: 'video/mp4' });
    expect(rows.insert).toHaveBeenCalledWith(
      expect.objectContaining({ kind: 'video', storage_path: path, duration_seconds: 12.4 }),
    );
  });

  it('takes back the file when the montage is already full, and says so', async () => {
    const files = bucket();
    table({ error: { message: 'A montage holds four photos or videos at most' } });

    await expect(
      addToMontage('me', { uri: 'file:///p.jpg', type: 'image', width: 100, height: 100 }),
    ).rejects.toThrow('Your montage already has four. Remove one to add another.');
    expect(files.remove).toHaveBeenCalledWith([expect.stringMatching(/^me\//)]);
  });

  it('never uploads a video that is too long', async () => {
    const files = bucket();
    await expect(
      addToMontage('me', { uri: 'v', type: 'video', width: 1, height: 1, duration: 90_000 }),
    ).rejects.toThrow(/up to a minute/);
    expect(files.upload).not.toHaveBeenCalled();
  });
});

describe('your montage', () => {
  it('is read in your order, each with a link', async () => {
    bucket({
      sign: {
        data: [
          { path: 'me/a.jpg', signedUrl: 'https://cdn.test/a', error: null },
          { path: 'me/b.mp4', signedUrl: 'https://cdn.test/b', error: null },
        ],
        error: null,
      },
    });
    const rows = table({
      data: [
        {
          id: 'a',
          kind: 'photo',
          storage_path: 'me/a.jpg',
          width: 10,
          height: 20,
          duration_seconds: null,
        },
        {
          id: 'b',
          kind: 'video',
          storage_path: 'me/b.mp4',
          width: 10,
          height: 20,
          duration_seconds: '9.50',
        },
      ],
    });

    const items = await fetchOwnMontage('me');

    expect(rows.order).toHaveBeenCalledWith('position');
    expect(items).toEqual([
      expect.objectContaining({ id: 'a', url: 'https://cdn.test/a', path: 'me/a.jpg' }),
      expect.objectContaining({ id: 'b', url: 'https://cdn.test/b', durationSeconds: 9.5 }),
    ]);
  });

  it('is put in order in one go, and loses one row first, then its file', async () => {
    mockRpc.mockResolvedValue({ data: null, error: null });
    await reorderMontage(['b', 'a']);
    expect(mockRpc).toHaveBeenCalledWith('reorder_profile_montage', { p_ids: ['b', 'a'] });

    const files = bucket();
    const rows = table({});
    await removeFromMontage({
      id: 'a',
      kind: 'photo',
      url: '',
      width: null,
      height: null,
      durationSeconds: null,
      path: 'me/a.jpg',
    });
    expect(rows.delete).toHaveBeenCalled();
    expect(rows.eq).toHaveBeenCalledWith('id', 'a');
    expect(files.remove).toHaveBeenCalledWith(['me/a.jpg']);
  });
});
