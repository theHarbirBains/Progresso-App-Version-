import * as ImageManipulator from 'expo-image-manipulator';
import { resizeForUpload } from './imageResize';
import { supabase } from './supabase';

/**
 * A new, unguessable name in the person's own folder ("<userId>/<time>-<random>.jpg"), for a
 * bucket where they keep many photos -- one per food, machine or screenshot -- each its own file.
 * Storage RLS only lets a person write under their own folder.
 */
export function uniquePhotoPath(userId: string): string {
  const unique = `${Date.now()}-${Math.random().toString(36).slice(2, 10)}`;
  return `${userId}/${unique}.jpg`;
}

/**
 * Puts a locally picked photo (a file:// URI from expo-image-picker) at `path` in `bucket`,
 * scaled down first (resizeForUpload). `asJpeg` re-encodes it as JPEG even when it needed no
 * scaling, for a bucket that takes nothing else (a library photo can be HEIC); `upsert` replaces
 * what's at a fixed path. Throws with Storage's own message when the upload fails.
 */
export async function uploadPhoto(
  bucket: string,
  path: string,
  localUri: string,
  options: { asJpeg?: boolean; upsert?: boolean } = {},
): Promise<void> {
  let uri = await resizeForUpload(localUri);
  if (options.asJpeg) {
    uri = (
      await ImageManipulator.manipulateAsync(uri, [], {
        compress: 0.85,
        format: ImageManipulator.SaveFormat.JPEG,
      })
    ).uri;
  }
  const blob = await (await fetch(uri)).blob();
  const { error } = await supabase.storage.from(bucket).upload(path, blob, {
    contentType: 'image/jpeg',
    ...(options.upsert ? { upsert: true } : {}),
  });
  if (error) throw new Error(error.message);
}

/** A public bucket's link to the photo at `path`. */
export function publicPhotoUrl(bucket: string, path: string): string {
  return supabase.storage.from(bucket).getPublicUrl(path).data.publicUrl;
}
