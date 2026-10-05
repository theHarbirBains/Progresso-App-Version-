import { Image } from 'react-native';
import * as ImageManipulator from 'expo-image-manipulator';

/** The longest edge of an uploaded photo. Plenty for a profile picture, a food or a machine. */
export const UPLOAD_MAX_EDGE_PX = 1600;
const UPLOAD_JPEG_QUALITY = 0.85;

/**
 * Scales a photo down so its longest edge is at most UPLOAD_MAX_EDGE_PX, keeping its aspect
 * ratio, and re-encodes it as JPEG. A photo already small enough is returned as it is, with no
 * re-encode. If the size can't be read, the original is returned, so a resize problem never
 * blocks an upload.
 */
export async function resizeForUpload(localUri: string): Promise<string> {
  const size = await readSize(localUri);
  if (!size) return localUri;

  const longest = Math.max(size.width, size.height);
  if (longest <= UPLOAD_MAX_EDGE_PX) return localUri;

  const scale = UPLOAD_MAX_EDGE_PX / longest;
  const result = await ImageManipulator.manipulateAsync(
    localUri,
    [
      {
        resize: {
          width: Math.round(size.width * scale),
          height: Math.round(size.height * scale),
        },
      },
    ],
    { compress: UPLOAD_JPEG_QUALITY, format: ImageManipulator.SaveFormat.JPEG },
  );
  return result.uri;
}

function readSize(uri: string): Promise<{ width: number; height: number } | null> {
  return new Promise((resolve) => {
    Image.getSize(
      uri,
      (width, height) => resolve({ width, height }),
      () => resolve(null),
    );
  });
}
