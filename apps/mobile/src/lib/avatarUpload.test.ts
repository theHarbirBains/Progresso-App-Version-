import { supabase } from './supabase';
import { removeAvatarFile, uploadAvatar } from './avatarUpload';

jest.mock('./supabase', () => ({
  supabase: { storage: { from: jest.fn() } },
}));

const mockFrom = supabase.storage.from as jest.Mock;

function mockBucket({
  uploadError = null,
  publicUrl = 'https://project.supabase.co/storage/v1/object/public/avatars/user-1/avatar.jpg',
  removeError = null,
}: {
  uploadError?: { message: string } | null;
  publicUrl?: string;
  removeError?: { message: string } | null;
} = {}) {
  const upload = jest.fn().mockResolvedValue({ data: {}, error: uploadError });
  const getPublicUrl = jest.fn().mockReturnValue({ data: { publicUrl } });
  const remove = jest.fn().mockResolvedValue({ data: {}, error: removeError });
  mockFrom.mockReturnValue({ upload, getPublicUrl, remove });
  return { upload, getPublicUrl, remove };
}

const fakeBlob = { size: 123 };

beforeEach(() => {
  mockFrom.mockReset();
  global.fetch = jest.fn().mockResolvedValue({ blob: () => Promise.resolve(fakeBlob) });
});

describe('uploadAvatar', () => {
  it('uploads to the user-specific path with upsert so re-uploading replaces the old file', async () => {
    const { upload } = mockBucket();

    await uploadAvatar('user-1', 'file:///tmp/photo.jpg');

    expect(mockFrom).toHaveBeenCalledWith('avatars');
    expect(upload).toHaveBeenCalledWith('user-1/avatar.jpg', fakeBlob, {
      contentType: 'image/jpeg',
      upsert: true,
    });
  });

  it('returns the public URL with a cache-busting query param appended', async () => {
    mockBucket({
      publicUrl: 'https://project.supabase.co/storage/v1/object/public/avatars/user-1/avatar.jpg',
    });

    const result = await uploadAvatar('user-1', 'file:///tmp/photo.jpg');

    expect(result).toMatch(
      /^https:\/\/project\.supabase\.co\/storage\/v1\/object\/public\/avatars\/user-1\/avatar\.jpg\?v=\d+$/,
    );
  });

  it('throws when the upload fails', async () => {
    mockBucket({ uploadError: { message: 'network error' } });

    await expect(uploadAvatar('user-1', 'file:///tmp/photo.jpg')).rejects.toThrow('network error');
  });
});

describe('removeAvatarFile', () => {
  it('removes the file at the user-specific path', async () => {
    const { remove } = mockBucket();

    await removeAvatarFile('user-1');

    expect(mockFrom).toHaveBeenCalledWith('avatars');
    expect(remove).toHaveBeenCalledWith(['user-1/avatar.jpg']);
  });

  it('throws when removal fails', async () => {
    mockBucket({ removeError: { message: 'not found' } });

    await expect(removeAvatarFile('user-1')).rejects.toThrow('not found');
  });
});
