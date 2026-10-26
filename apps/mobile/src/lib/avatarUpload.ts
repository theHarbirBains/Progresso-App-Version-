import { publicPhotoUrl, uploadPhoto } from './photoUpload';
import { supabase } from './supabase';

const AVATAR_BUCKET = 'avatars';

function avatarPath(userId: string): string {
  return `${userId}/avatar.jpg`;
}

/**
 * Uploads a locally-picked image (a file:// URI from expo-image-picker) to
 * this user's own folder in the avatars bucket. Always the same path per
 * user (upsert: true) so changing a picture overwrites the previous file
 * instead of leaving orphaned uploads behind -- storage RLS only allows a
 * user to write under their own "{userId}/..." folder (see the
 * profile_picture migration's avatar_insert_own/avatar_update_own
 * policies), so this can never overwrite another user's avatar.
 *
 * Returns the bucket's public URL with a cache-busting query param
 * appended: the storage path itself never changes across uploads, so
 * without this an <Image> (or any HTTP cache) that already loaded the old
 * picture would keep showing it after a change.
 */
export async function uploadAvatar(userId: string, localUri: string): Promise<string> {
  const path = avatarPath(userId);
  await uploadPhoto(AVATAR_BUCKET, path, localUri, { upsert: true });
  return `${publicPhotoUrl(AVATAR_BUCKET, path)}?v=${Date.now()}`;
}

/** Deletes this user's uploaded avatar file from storage. */
export async function removeAvatarFile(userId: string): Promise<void> {
  const { error } = await supabase.storage.from(AVATAR_BUCKET).remove([avatarPath(userId)]);
  if (error) throw new Error(error.message);
}
