import * as ImageManipulator from 'expo-image-manipulator';
import { resizeForUpload } from './imageResize';
import { supabase } from './supabase';

/**
 * A new, unguessable name in the person's own folder ("<userId>/<time>-<random>.jpg"), for a
 * bucket where they keep many photos -- one per food, machine or screenshot -- each its own file
 * (a montage's video with its own extension). Storage RLS only lets a person write under their own
 * folder.
 */
export function uniquePhotoPath(userId: string, extension = 'jpg'): string {
  const unique = `${Date.now()}-${Math.random().toString(36).slice(2, 10)}`;
  return `${userId}/${unique}.${extension}`;
}

/**
 * A file on the phone (a file:// URI), as its bytes, to upload with its content type. Never as a
 * Blob: Storage sends a Blob as a form part typed by the Blob alone, ignoring `contentType`, and a
 * Blob read from a file on the phone has no type -- so it arrived as text/plain, which a bucket
 * that takes only some types (the montage's, feedback screenshots') refuses.
 */
export async function localFileBytes(localUri: string): Promise<ArrayBuffer> {
  return (await fetch(localUri)).arrayBuffer();
}

/**
 * Puts a locally picked photo (a file:// URI from expo-image-picker) at `path` in `bucket`,
 * scaled down first (resizeForUpload), as a JPEG. `asJpeg` re-encodes it as JPEG even when it
 * needed no scaling, for a bucket that takes nothing else (a library photo can be HEIC); `upsert`
 * replaces what's at a fixed path. Throws with Storage's own message when the upload fails.
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
  const { error } = await supabase.storage.from(bucket).upload(path, await localFileBytes(uri), {
    contentType: 'image/jpeg',
    ...(options.upsert ? { upsert: true } : {}),
  });
  if (error) throw new Error(error.message);
}

/** A public bucket's link to the photo at `path`. */
export function publicPhotoUrl(bucket: string, path: string): string {
  return supabase.storage.from(bucket).getPublicUrl(path).data.publicUrl;
}
