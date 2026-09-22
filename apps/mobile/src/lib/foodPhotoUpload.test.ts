import { supabase } from './supabase';
import { uploadFoodPhoto } from './foodPhotoUpload';

jest.mock('./supabase', () => ({
  supabase: { storage: { from: jest.fn() } },
}));

const mockFrom = supabase.storage.from as jest.Mock;
const fakeBlob = { size: 123 };

function mockBucket({ uploadError = null }: { uploadError?: { message: string } | null } = {}) {
  const upload = jest.fn().mockResolvedValue({ data: {}, error: uploadError });
  const getPublicUrl = jest
    .fn()
    .mockReturnValue({ data: { publicUrl: 'https://project.supabase.co/food-photos/x.jpg' } });
  mockFrom.mockReturnValue({ upload, getPublicUrl });
  return { upload, getPublicUrl };
}

beforeEach(() => {
  mockFrom.mockReset();
  global.fetch = jest.fn().mockResolvedValue({ blob: () => Promise.resolve(fakeBlob) });
});

describe('uploadFoodPhoto', () => {
  it("uploads to a unique file in the user's own folder of the food-photos bucket", async () => {
    const { upload } = mockBucket();

    const url = await uploadFoodPhoto('user-1', 'file:///tmp/food.jpg');

    expect(mockFrom).toHaveBeenCalledWith('food-photos');
    const [path, blob, options] = upload.mock.calls[0];
    expect(path).toMatch(/^user-1\/[\w-]+\.jpg$/);
    expect(blob).toBe(fakeBlob);
    expect(options).toEqual({ contentType: 'image/jpeg' });
    expect(url).toBe('https://project.supabase.co/food-photos/x.jpg');
  });

  it('never reuses a path, so a replaced photo gets a new URL', async () => {
    const { upload } = mockBucket();

    await uploadFoodPhoto('user-1', 'file:///a.jpg');
    await uploadFoodPhoto('user-1', 'file:///b.jpg');

    expect(upload.mock.calls[0][0]).not.toBe(upload.mock.calls[1][0]);
  });

  it('throws when the upload fails', async () => {
    mockBucket({ uploadError: { message: 'nope' } });

    await expect(uploadFoodPhoto('user-1', 'file:///a.jpg')).rejects.toThrow('nope');
  });
});
