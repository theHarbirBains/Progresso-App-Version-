import * as ImageManipulator from 'expo-image-manipulator';
import { supabase } from '../lib/supabase';
import { removeUnsentScreenshot, uploadFeedbackScreenshot } from './screenshotUpload';

jest.mock('../lib/imageResize', () => ({ resizeForUpload: async (uri: string) => uri }));
jest.mock('../lib/supabase', () => ({ supabase: { storage: { from: jest.fn() } } }));

const mockFrom = supabase.storage.from as jest.Mock;
const fakeBlob = { size: 123 };

beforeEach(() => {
  mockFrom.mockReset();
  global.fetch = jest.fn().mockResolvedValue({ blob: () => Promise.resolve(fakeBlob) });
  (ImageManipulator.manipulateAsync as jest.Mock).mockClear();
});

describe('uploadFeedbackScreenshot', () => {
  it("uploads it as JPEG into the sender's own folder of the private bucket, and gives back its path", async () => {
    const upload = jest.fn().mockResolvedValue({ data: {}, error: null });
    mockFrom.mockReturnValue({ upload });

    const path = await uploadFeedbackScreenshot('user-1', 'file:///shot.heic');

    expect(ImageManipulator.manipulateAsync).toHaveBeenCalledWith('file:///shot.heic', [], {
      compress: 0.85,
      format: 'jpeg',
    });
    expect(mockFrom).toHaveBeenCalledWith('feedback-screenshots');
    expect(path).toMatch(/^user-1\/[A-Za-z0-9_-]+\.jpg$/);
    expect(upload).toHaveBeenCalledWith(path, fakeBlob, { contentType: 'image/jpeg' });
  });

  it('throws when the upload fails', async () => {
    mockFrom.mockReturnValue({
      upload: jest.fn().mockResolvedValue({ data: null, error: { message: 'too big' } }),
    });

    await expect(uploadFeedbackScreenshot('user-1', 'file:///shot.png')).rejects.toThrow('too big');
  });
});

describe('removeUnsentScreenshot', () => {
  it('takes it back, and never throws', async () => {
    const remove = jest.fn().mockRejectedValue(new Error('offline'));
    mockFrom.mockReturnValue({ remove });

    await expect(removeUnsentScreenshot('user-1/a.jpg')).resolves.toBeUndefined();
    expect(remove).toHaveBeenCalledWith(['user-1/a.jpg']);
  });
});
