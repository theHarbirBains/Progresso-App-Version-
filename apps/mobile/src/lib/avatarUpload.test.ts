import { supabase } from './supabase';
import { avatarFileOf, removeAvatarFile, uploadAvatar } from './avatarUpload';
jest.mock('./imageResize', () => ({ resizeForUpload: async (uri: string) => uri }));

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

/** A photo's bytes as read from the phone -- uploaded as they are, never as a Blob. */
const fakeBytes = new ArrayBuffer(123);

beforeEach(() => {
  mockFrom.mockReset();
  global.fetch = jest.fn().mockResolvedValue({ arrayBuffer: () => Promise.resolve(fakeBytes) });
});

describe('uploadAvatar', () => {
  it("uploads each new picture to a new file in the user's own folder -- never over the old one", async () => {
    const { upload, getPublicUrl } = mockBucket();

    const url = await uploadAvatar('user-1', 'file:///tmp/photo.jpg');
    await uploadAvatar('user-1', 'file:///tmp/again.jpg');

    expect(mockFrom).toHaveBeenCalledWith('avatars');
    const [first, body, options] = upload.mock.calls[0];
    const [second] = upload.mock.calls[1];
    expect(first).toMatch(/^user-1\/[\w-]+\.jpg$/);
    expect(second).not.toBe(first);
    expect(body).toBe(fakeBytes);
    // A new address, so no CDN or phone can hand out the old picture in its place.
    expect(options).toEqual({ contentType: 'image/jpeg' });
    expect(getPublicUrl).toHaveBeenCalledWith(first);
    expect(url).toBe(
      'https://project.supabase.co/storage/v1/object/public/avatars/user-1/avatar.jpg',
    );
  });

  it('throws when the upload fails', async () => {
    mockBucket({ uploadError: { message: 'network error' } });

    await expect(uploadAvatar('user-1', 'file:///tmp/photo.jpg')).rejects.toThrow('network error');
  });
});

describe('removeAvatarFile', () => {
  it("removes the file a picture's link points at -- an old fixed one too", async () => {
    const { remove } = mockBucket();

    await removeAvatarFile(
      'user-1',
      'https://project.supabase.co/storage/v1/object/public/avatars/user-1/1795-ab12.jpg',
    );
    await removeAvatarFile(
      'user-1',
      'https://project.supabase.co/storage/v1/object/public/avatars/user-1/avatar.jpg?v=17',
    );

    expect(mockFrom).toHaveBeenCalledWith('avatars');
    expect(remove).toHaveBeenNthCalledWith(1, ['user-1/1795-ab12.jpg']);
    expect(remove).toHaveBeenNthCalledWith(2, ['user-1/avatar.jpg']);
  });

  it("never removes anything outside the user's own folder", async () => {
    const { remove } = mockBucket();
    const base = 'https://project.supabase.co/storage/v1/object/public/avatars/';

    await removeAvatarFile('user-1', `${base}user-2/avatar.jpg`);
    await removeAvatarFile('user-1', 'https://elsewhere.test/user-1/avatar.jpg');
    expect(remove).not.toHaveBeenCalled();
    expect(avatarFileOf('user-1', `${base}user-1/../user-2/x.jpg`)).toBeNull();
  });

  it('throws when removal fails', async () => {
    mockBucket({ removeError: { message: 'not found' } });

    await expect(
      removeAvatarFile(
        'user-1',
        'https://project.supabase.co/storage/v1/object/public/avatars/user-1/a.jpg',
      ),
    ).rejects.toThrow('not found');
  });
});
