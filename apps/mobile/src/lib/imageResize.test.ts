import { Image } from 'react-native';
import * as ImageManipulator from 'expo-image-manipulator';
import { resizeForUpload, UPLOAD_MAX_EDGE_PX } from './imageResize';

jest.mock('expo-image-manipulator', () => ({
  manipulateAsync: jest.fn(),
  SaveFormat: { JPEG: 'jpeg' },
}));

const mockManipulate = ImageManipulator.manipulateAsync as jest.Mock;

function mockSize(width: number, height: number) {
  jest
    .spyOn(Image, 'getSize')
    .mockImplementation((_uri: string, success: (w: number, h: number) => void) =>
      success(width, height),
    );
}

beforeEach(() => {
  mockManipulate.mockReset().mockResolvedValue({ uri: 'file:///resized.jpg' });
});

afterEach(() => {
  jest.restoreAllMocks();
});

describe('resizeForUpload', () => {
  it('caps a large landscape photo at the maximum edge, keeping its aspect ratio', async () => {
    mockSize(4000, 3000);

    const uri = await resizeForUpload('file:///big.jpg');

    expect(uri).toBe('file:///resized.jpg');
    expect(mockManipulate).toHaveBeenCalledWith(
      'file:///big.jpg',
      [{ resize: { width: UPLOAD_MAX_EDGE_PX, height: 1200 } }],
      expect.objectContaining({ format: 'jpeg' }),
    );
  });

  it('caps a large portrait photo by its height, so the longest edge is the limit', async () => {
    mockSize(3000, 4000);

    await resizeForUpload('file:///portrait.jpg');

    expect(mockManipulate).toHaveBeenCalledWith(
      'file:///portrait.jpg',
      [{ resize: { width: 1200, height: UPLOAD_MAX_EDGE_PX } }],
      expect.anything(),
    );
  });

  it('leaves a photo that is already small enough untouched, with no re-encode', async () => {
    mockSize(800, 600);

    await expect(resizeForUpload('file:///small.jpg')).resolves.toBe('file:///small.jpg');
    expect(mockManipulate).not.toHaveBeenCalled();
  });

  it('returns the original when the size cannot be read, so an upload is never blocked', async () => {
    jest
      .spyOn(Image, 'getSize')
      .mockImplementation((_uri: string, _success: unknown, failure?: (error: unknown) => void) =>
        failure?.(new Error('unreadable')),
      );

    await expect(resizeForUpload('file:///unknown.jpg')).resolves.toBe('file:///unknown.jpg');
    expect(mockManipulate).not.toHaveBeenCalled();
  });
});
